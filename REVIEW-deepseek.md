# REVIEW-deepseek.md — Revisão adversarial independente e final (2026-08-12)

Revisão completa e final do working tree de `watergaia` (estado atual, com
alterações não commitadas). Nenhum arquivo de produção ou de teste foi
alterado. Não foram lidos/alterados os demais `REVIEW-*.md`. O `npm run build`
regenerou `custom_components/irrigation_scheduler/frontend/irrigation-schedule-card.js`
(artefato buildado, parte esperada da bateria de testes do frontend).

---

## 1. Arquivos revisados

### Backend (`custom_components/irrigation_scheduler`)
- `__init__.py` (schemas, registro/unregistro de serviços, resolução de alvos, frontend wiring)
- `const.py`
- `config_flow.py` (config + options flow)
- `scheduler.py` (máquina de rega, `_async_recover_state`, pH gate R1/R2, histórico, reservatório)
- `next_run.py` (cálculo puro do próximo disparo — módulo "zero imports")
- `schedules.py` (serialização/merge/generation de ids)
- `store.py` (RuntimeStore compartilhado, lock, pruning)
- `sensor.py`, `binary_sensor.py`, `switch.py`
- `manifest.json`, `services.yaml`, `strings.json`, `translations/en.json`, `translations/pt-BR.json`
- `frontend/irrigation-schedule-card.js` (bundle IIFE, conferido pós-build)

### Frontend (`frontend-src`)
- `src/card.ts`, `src/editor.ts`, `src/styles.ts`, `src/types.ts`, `src/utils.ts`, `src/const.ts`
- `rollup.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `package.json`, `smoke.mjs`

### Testes
- `tests/test_next_run.py`, `tests/test_schedules.py`, `tests/pure_loader.py`
- `tests/integration/`: `conftest.py`, `test_init.py`, `test_services.py`,
  `test_config_flow.py`, `test_async_device.py`, `test_frontend.py`,
  `test_recovery.py`, `test_ph_gate.py`, `test_ph_gate_r2.py`,
  `test_history.py`, `test_reservoir.py`, `test_review_fixes.py`,
  `test_review_fixes_2.py`
- `frontend-src/tests/`: `card.test.ts`, `utils.test.ts`, `editor.test.ts`

---

## 2. Verificação dos dois achados da rodada anterior (obrigatórios)

### ✅ CORRIGIDO — (1) `SERVICE_REFILL_RESERVOIR` ausente no unregister
- `custom_components/irrigation_scheduler/__init__.py:447-460`
  (`_async_unregister_services`): a tupla agora inclui `SERVICE_REFILL_RESERVOIR`
  (linha 457), alinhada ao registro em `_async_register_services` (linha 442).
- `tests/integration/test_init.py:34-43`: `ALL_SERVICES` agora inclui
  `SERVICE_REFILL_RESERVOIR`, então
  `test_unload_removes_entities_and_services_only_with_last_entry` cobre o caso
  (serviços presentes com 2 entries, removidos após o unload da última).
- **Evidência:** execução da suíte HA — teste verde; análise estática do par
  registro/unregistro agora sem nenhum serviço faltando.

### ✅ CORRIGIDO — (2) downtime recovery registrava/deduzia sem evidência de atuação
- `custom_components/irrigation_scheduler/scheduler.py:1672-1697` (branch
  `finishes_at <= utcnow()` em `_async_recover_state`): o histórico/dedução só
  ocorre com `run_state.get("actuated")` **E** `not run_state.get("history_logged")`.
- `_async_start_run` persiste `"actuated": False` (linha 915) e
  `_async_store_mark_actuated` (linhas 1182-1197) o flipa para `True` nos mesmos
  pontos em que o flag sticky em memória é setado; `_async_finish_run` marca
  `history_logged` (linhas 1156-1162, 1199-1215) quando o registro sobrevive a
  um `turn_off` não confirmado.
- **Evidência/testes de regressão novos:** `test_recovery.py:627-664`
  (`test_downtime_recovery_does_not_log_run_with_no_actuation_evidence` — sem a
  chave `actuated`, não loga e não deduz) e `test_recovery.py:518-624`
  (`test_failed_turn_off_then_restart_does_not_double_log_or_double_deduct` —
  run logada + deduzida exatamente UMA vez, `history_logged=True` persistido).
  Ambas passam.

---

## 3. Achados por severidade (novos desta rodada)

### MÉDIA

**M1 — Editor visual do card nunca propaga alterações: `_valueChanged` lê
`detail.name`, mas o `ha-form` do HA emite `detail = { value: <objeto completo> }`**
- `frontend-src/src/editor.ts:63-77`.
- **Cenário:** ao editar qualquer campo (entity/name/show_next_run/show_water_now/
  compact) na UI do Lovelace, o editor renderiza o `ha-form` mas a chamada
  `detail?.name` é sempre `undefined`, caindo no `return` da linha 67 — o evento
  `config-changed` **nunca** é disparado. O usuário salva e o dashboard mantém a
  configuração antiga; só YAML funciona.
- **Evidência:** contrato real do `ha-form` (fonte de `home-assistant/frontend`
  `src/components/ha-form/ha-form.ts`, alvo do manifest 2026.2.3):
  `addValueChangedListener` interrompe o evento do filho e refaz
  `fireEvent(this, "value-changed", { value: this.data })` — ou seja, o detail
  traz apenas `{ value: {...} }`, sem campo `name`. O padrão correto (usado
  pelos cards do ecossistema) é mesclar `ev.detail.value` em `_config` e
  disparar `config-changed` com `{ config }`. `editor.test.ts` cobre apenas
  `setConfig`/render, não o `_valueChanged` — por isso o defeito passou.
- **Impacto:** funcionalidade de editor visual inoperante (somente YAML), sem
  efeito no runtime do card nem no backend.

### BAIXA

**B1 — `days` de tipos inválidos (string/int/None) derruba `find_next_run` e
pode quebrar o setup inteiro da zona**
- `custom_components/irrigation_scheduler/scheduler.py:237-256` (propriedade
  `schedules`) + `custom_components/irrigation_scheduler/next_run.py:124`
  (`weekday not in schedule.get(_KEY_DAYS, [])`).
- **Cenário:** o filtro de `schedules` valida apenas `duration` (documentado
  como proteção "para que options corrompidos nunca derrubem
  `_reschedule_next`/`find_next_run`"), mas `days` malformado não é filtrado.
  Reproduzido em execução direta: `days='0,1'`, `days=0`, `days=None` levantam
  `TypeError` (`'in <string>' requires string as left operand, not int` /
  `argument of type 'int' is not a container`). Como `_reschedule_next()` roda
  em `async_setup` (linha 575) sem try, um options corrompido à mão derruba o
  `async_setup_entry` (a zona não carrega); no `finally` de
  `_async_schedule_fired` (linha 1421) o mesmo raise escapa do timer one-shot,
  e `_cancel_next()` já limpou `_next_run` — a zona para de agendar
  silenciosamente até restart/edição.
- **Evidência:** script com `pure_loader` reproduzindo os três tipos inválidos
  (`days='0,1'`, `days=0`, `days=None` → TypeError). Probabilidade baixa
  (caminhos de serviço validam via schema `cv.ensure_list` + `Coerce(int)`; só
  edição manual do `.storage` alcança isso), mas é uma brecha exatamente na
  classe de corrupção que o próprio código declara defender (há testes de
  regressão para `duration` corrompido, `started_at` naive, item não-dict).
- **Sugestão:** em `schedules`, aceitar apenas itens cujo `days` seja uma lista
  (ou reusar uma normalização tipo `sanitizeSchedules` do frontend), no mesmo
  nível do filtro de `duration`.

**B2 — Registros antigos de histórico sem `ph_value`/`ec_value` renderizam
"· ? PH" no card**
- `frontend-src/src/card.ts:1104-1115` (`_renderHistoryEntry`).
- **Cenário:** a guarda `_isHistoryRun` (linhas 1282-1288) exige só
  `started_at` + `duration`; um registro gravado antes da adição dos campos de
  pH/EC não possui a chave, então `entry.ph_value !== null` é `true` (undefined
  ≠ null) e `formatSensorReading(undefined)` retorna `"?"` — o histórico mostra
  "· ? PH" para runs legítimos. Cosmético (nenhum crash), mas é dado errado
  silencioso na UI.
- **Sugestão:** checar `typeof entry.ph_value === "number"` (padrão já usado
  para R2 nas linhas 1110-1115).

**B3 — `frontend-src/smoke.mjs:62` — checagem "day chips (Seg/Qua)" sempre falsa**
- O card renderiza iniciais (`dayInitials()`: S/T/Q/Q/S/S/D), não "Seg"/"Qua".
  O smoke imprime `day chips (Seg/Qua): false` por expectativa desatualizada do
  próprio script (não falha; o throw só valida outros textos). Ajustar a
  checagem para as iniciais. Sem impacto em produção.

### Ainda abertos da rodada anterior (reverificados, baixa severidade)

- **B1-rodada-anterior** — `config_flow.py:245-252` (`int(...) // 60`): o
  options flow continua truncando durações subminuto (ex.: 90s exibidos como
  "1 min" → gravados 60s se o usuário salvar) e `int()/float()` direto sobre
  options corrompido pode quebrar o options flow. Não alterado (baixa
  probabilidade).
- **B2-rodada-anterior** — `scheduler.py:1759` (`_async_target_is_actuated` no
  resume): um entry de alvo com domínio não suportado (via edição manual) ainda
  sobe `ValueError` na recuperação de run ativo, derrubando o `async_setup_entry`.
  Não alterado (requer `.storage` editado à mão + run residual).
- **B3-rodada-anterior** — `store.py`: `async_load_history` poda na leitura mas
  não persiste a poda (cosmético, arquivo até o próximo append).

---

## 4. Falsos positivos percebidos (verificados e considerados OK)

- **`_valueChanged` "double-fire" / event shape alternativo:** descartado —
  o `ha-form` atual (2026.x) só emite `{ value: data }`; nenhum outro evento com
  `name` chega ao editor.
- **`SERVICE_REFILL_RESERVOIR` em `_async_unregister_services`:** agora correto,
  confirmado por teste (`test_init.py::test_unload_removes_entities_and_services_only_with_last_entry`).
- **`actuated`/`history_logged` no store:** sem falsos negativos — run com
  `actuated: True` (alvo realmente ON durante downtime) continua sendo logada e
  deduzida (`test_history.py:284-323`, `test_reservoir.py:222-261`, ambos passam).
- **`ha-switch` mestre via `switch.turn_on/off` do próprio domínio** em vez do
  serviço do DOMAIN — correto (SwitchEntity do componente; `_async_set_enabled`).
- **Race stop-timer × actuation-check no mesmo instante (duration < grace):**
  callbacks em tempo igual disparam em ordem de registro; o check de atuação é
  registrado antes do stop timer — comportamento intencional e ancorado em
  `test_review_fixes.py:167-230`.
- **`unavailable`/`unknown` nunca contam como "confirmado off"** — política
  correta, bem testada (`test_review_fixes_2.py:301-360`).
- **Badges R1/R2 com volume/estimativa/refill duplicados** — design deliberado,
  coberto por `test_reservoir.py`/`card.test.ts`.
- **`float(state.state)` do gate pH rejeitando "6,2" (vírgula)** — fail-safe
  intencional (nunca regar com leitura ambígua).
- **Mojibake aparente em `translations/pt-BR.json`:** falso alarme — arquivo é
  UTF-8 válido (bytes `C3 A7`/`C3 A3` presentes); a distorção era só do console
  do PowerShell.
- **`NaN`/`inf` de pH** — tratados via `math.isfinite` (gate fail-safe e
  snapshot), cobertos por `test_ph_gate.py:258-290`.
- **Vazamento do static path após último unload** — intencional e documentado
  (só `extra_js_url` é removido; `test_frontend.py:65-82` passa).

---

## 5. Sugestões (resumo acionável)

1. **Corrigir M1:** em `editor.ts`, substituir o handler por
   `const value = (ev.detail as { value?: Record<string, unknown> })?.value;`
   mesclando em `_config` e disparando `config-changed` com `{ config }`
   (manter `bubbles/composed`). Adicionar teste unitário simulando o
   `value-changed` do `ha-form` (`detail = { value: { compact: true } }`) e
   verificando o `config-changed` emitido.
2. **Corrigir B1:** filtrar em `IrrigationScheduler.schedules` itens cujo
   `days` não seja `list`/`tuple` (ou delegar a uma normalização compartilhada),
   espelhando o filtro de `duration`.
3. **B2/B3:** trocar as guardas de `ph_value`/`ec_value` para `typeof === "number"`
   e atualizar a checagem de dias no smoke.

---

## 6. Testes executados

| Suite | Comando | Resultado |
|---|---|---|
| Backend puro | `$env:TEMP\opencode\irr-venv\Scripts\python.exe -m pytest tests/test_next_run.py tests/test_schedules.py -q` | **28 passed** (0.02s) |
| Backend HA (suíte completa) | `$env:TEMP\opencode\ha-venv\Scripts\python.exe -m pytest tests -q` | **141 passed** (14.31s) |
| Sub-suite foco (recovery/review fixes/reservoir/history) | `$env:TEMP\opencode\ha-venv\Scripts\python.exe -m pytest tests/integration/test_recovery.py tests/integration/test_review_fixes.py tests/integration/test_review_fixes_2.py tests/integration/test_reservoir.py tests/integration/test_history.py -q` | **46 passed** (10.96s) |
| Frontend typecheck | `npm run typecheck` | **OK** (tsc --noEmit sem erros) |
| Frontend tests | `npm run test` | **135 passed** (3 arquivos: card 50, utils 82, editor 3) |
| Frontend build | `npm run build` | **OK** (rollup gerou o bundle IIFE em `custom_components/.../frontend/irrigation-schedule-card.js`) |
| Smoke do bundle | `node smoke.mjs` | **SMOKE OK** (apenas `day chips (Seg/Qua): false` — ver B3) |
| Verificação adversarial extra (puro) | `find_next_run` com `days` corrompido (`'0,1'`, `0`, `None`, `'all'`) | **TypeError reproduzido** (confirmou B1) |
| Verificação do par registro/unregistro de serviços | extração das constantes `SERVICE_*` | **Alinhado: nenhum serviço faltando** (achado anterior corrigido) |
| Verificação do contrato do `ha-form` | fonte `home-assistant/frontend` `ha-form.ts` | `value-changed` emite `{ value: data }` (confirmou M1) |
| Encoding de `translations/pt-BR.json` | leitura dos bytes | UTF-8 válido (`C3 A7`, `C3 A3` presentes); JSON parseável |

Total automatizado: **304 testes verdes** (28 puros + 141 HA + 135 frontend),
typecheck, build e smoke OK.

---

## 7. Status final

**PRECISA DE ALTERAÇÃO**

Os dois achados obrigatórios da rodada anterior foram **corrigidos e
verificados com testes de regressão** (ambos os testes novos passam). Toda a
bateria (backend puro, backend HA, typecheck, testes e build do frontend) está
verde. Porém a revisão adversarial final encontrou **um defeito funcional
genuíno e não coberto por teste no editor visual do card**:

- **M1 (média)** — `editor.ts::_valueChanged` lê `detail.name`, que o
  `ha-form` do Home Assistant 2026.2.3 (target do manifest) nunca emite;
  o evento `config-changed` nunca é disparado e o editor visual do card não
  salva nenhuma alteração (somente YAML funciona).

Além dele, um gap de robustez no backend (B1 — `days` malformado derruba
`find_next_run`/setup da zona) e dois itens cosméticos (B2, B3), mais os
baixos da rodada anterior que permanecem. Nenhum achado afeta a segurança
física da rega (o gate `history_actuated`/`confirmed_off_states` e o turn_off
defensivo seguem íntegros) nem o ciclo de vida do serviço `refill_reservoir`.

Recomendação: corrigir **M1** (e idealmente B1) com testes de regressão antes
do release; os demais são cosméticos/robustez e podem ser tratados juntos.
