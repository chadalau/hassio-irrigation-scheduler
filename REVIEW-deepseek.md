# REVIEW-deepseek.md — Revisão adversarial independente (2026-08-12)

Revisão completa do working tree de `watergaia` (estado atual, com alterações
não commitadas e novos testes). Não foram alterados código de produção nem
testes. Não foram lidos os demais `REVIEW-*.md`. A execução do `npm run build`
(pedida como parte da bateria de testes) regenerou
`custom_components/irrigation_scheduler/frontend/irrigation-schedule-card.js`
de forma idêntica ao conteúdo pré-existente do working tree (diff inalterado
frente ao HEAD: 624+/156-), ou seja, não introduziu mudanças novas.

---

## 1. Arquivos revisados

### Backend (custom_components/irrigation_scheduler)
- `__init__.py` (serviços, frontend wiring, resolução de alvos, schemas)
- `const.py`
- `config_flow.py` (config + options flow)
- `scheduler.py` (máquina de rega, recuperação, pH gate R1/R2, histórico, reservatório)
- `next_run.py` (cálculo puro do próximo disparo)
- `schedules.py` (serialização/merge de schedules)
- `store.py` (RuntimeStore compartilhado, histórico persistido)
- `sensor.py`, `binary_sensor.py`, `switch.py`
- `manifest.json`, `services.yaml`, `strings.json`, `translations/en.json`, `translations/pt-BR.json`

### Frontend (frontend-src)
- `src/card.ts`, `src/editor.ts`, `src/styles.ts`, `src/types.ts`, `src/utils.ts`, `src/const.ts`
- `src/irrigation-schedule-card.js` (artefato buildado, conferido pós-build)
- `rollup.config.mjs`, `vitest.config.ts`, `smoke.mjs`, `package.json`

### Testes
- `tests/test_next_run.py`, `tests/test_schedules.py`, `tests/pure_loader.py`
- `tests/integration/`: `conftest.py`, `test_init.py`, `test_services.py`,
  `test_config_flow.py`, `test_async_device.py`, `test_frontend.py`,
  `test_recovery.py`, `test_ph_gate.py`, `test_ph_gate_r2.py`,
  `test_history.py`, `test_reservoir.py`, `test_review_fixes.py`,
  `test_review_fixes_2.py`
- `frontend-src/tests/`: `card.test.ts`, `utils.test.ts`, `editor.test.ts`

---

## 2. Achados por severidade

### MÉDIA

**M1 — Serviço `refill_reservoir` nunca é removido no unload da última entry**
- `custom_components/irrigation_scheduler/__init__.py:447-459`
  (`_async_unregister_services`) vs `__init__.py:434-444` (`_async_register_services`).
- **Cenário:** `_async_register_services` registra 8 serviços (incluindo
  `SERVICE_REFILL_RESERVOIR`, linha 442), mas a tupla de unregister no
  `_async_unregister_services` (linhas 449-458) contém apenas 7 — sem
  `SERVICE_REFILL_RESERVOIR`. Após descarregar a última config entry, o serviço
  `irrigation_scheduler.refill_reservoir` permanece registrado no `hass` e
  aparece na UI de serviços, mas qualquer chamada a ele levanta
  `ServiceValidationError` ("No irrigation_scheduler entity matched").
- **Evidência:** análise estática do par registro/unregistro (script Python
  reproduzindo a extração das constantes: `MISSING from unregister:
  ['SERVICE_REFILL_RESERVOIR']`). O teste existente
  `tests/integration/test_init.py:33-41` define `ALL_SERVICES` **sem**
  `SERVICE_REFILL_RESERVOIR`, portanto `test_unload_removes_entities_and_services_only_with_last_entry`
  não cobre o vazamento. Impacto funcional limitado (re-setup volta a registrar
  tudo), mas é inconsistência real de ciclo de vida e superfície pública.

**M2 — Recuperação de run "expirado durante downtime" registra histórico e
deduz volume sem nenhuma evidência de que o alvo chegou a atuar**
- `custom_components/irrigation_scheduler/scheduler.py:1569-1598`
  (branch `finishes_at <= utcnow()` em `_async_recover_state`) + `_async_log_history`
  (linhas 1138-1200, dedução em 1199-1200).
- **Cenário:** o payload do store é persistido em `_async_start_run` (linha 866)
  **antes** do `turn_on` (linha 911). Se o HA morre nessa janela (ou após
  despachar o `turn_on` mas antes de um dispositivo assíncrono reportar ON),
  e a downtime cobre `finishes_at`, na recuperação o alvo está OFF →
  `_async_target_is_off()` é True → o entry é removido e `_async_log_history`
  é chamado **incondicionalmente**, registrando uma rega "completa" e deduzindo
  água do reservatório para um run que nunca entregou nada.
- **Evidência:** contraste com o restante do código — `_async_finish_run` usa o
  gate `history_actuated` (linha 1033) e os callers passam `log_history=False`
  quando o alvo nunca atuou (linhas 1281-1286, 1675-1677). O store **não**
  persiste nenhum flag de "actuated" que permita ao branch de downtime distinguir.
  `tests/integration/test_history.py:284-319` só cobre o caso "alvo estava ON"
  (rega legítima), não o caso "nunca atuou". Janela estreita e sem impacto de
  segurança física (o turn_off defensivo ainda ocorre), mas gera dado incorreto
  silencioso (histórico fantasma + dedução de volume).

### BAIXA

**B1 — Options flow perde/trunca durações subminuto e não degrada options corrompidas**
- `custom_components/irrigation_scheduler/config_flow.py:245-295`.
- **Cenário:** `int(options[...]) // 60` trunca para exibição: uma
  `default_duration` de 90s (gravável via `set_zone_options`) é mostrada como
  "1 min" e, ao salvar, vira 60s (perda de dados silenciosa). Além disso, um
  `int()`/`float()` direto sobre um valor corrompido no options (ex. `"abc"`)
  levanta `ValueError` e quebra o options flow, enquanto as propriedades do
  scheduler degradam com warning. Baixa probabilidade (valores vêm validados
  do schema), mas assimetria real de robustez.

**B2 — Domínio de alvo não suportado (config corrompida) quebra o setup na
recuperação de run ativo**
- `custom_components/irrigation_scheduler/scheduler.py:1660` e `:1077`
  (`_async_target_is_actuated`/`_async_target_is_off` chamam `off_states`/
  `confirmed_off_states`, que levantam `ValueError` para domínios fora dos 4
  suportados).
- **Cenário:** o caminho `water_now` protege-se (resolve antes de mutar estado,
  teste `test_review_fixes.py:410-433`), mas o caminho de **resume** em
  `_async_recover_state` não chama `resolve_target_services`: com um entry de
  alvo `fan.broken` (só via edição manual do `.storage`) e um run pendente no
  store, `async_setup_entry` sobe `ValueError` e a entry falha a carga. Requer
  combinação de edição manual + entry residual; improvável, mas viola a política
  de "degradar em vez de crashar" usada no resto do módulo.

**B3 — `async_load_history` poda na leitura mas não persiste a poda**
- `custom_components/irrigation_scheduler/store.py:106-120`.
- **Cenário:** entradas fora da janela de retenção são filtradas no retorno,
  mas permanecem no arquivo até o próximo append. Sem impacto funcional (o
  load seguinte volta a podar); apenas cosmético/tamanho do arquivo.

**B4 — `frontend-src/smoke.mjs:63` — checagem "day chips (Seg/Qua)" sempre falsa**
- O card renderiza **iniciais** (`dayInitials()`: S/T/Q/Q/S/S/D) nas linhas de
  schedule, não os rótulos "Seg"/"Qua". O smoke imprime `false` por expectativa
  incorreta do próprio script (não falha — o throw só valida outros textos).
  Corrigir a checagem para as iniciais. Não afeta produção.

---

## 3. Falsos positivos percebidos (verificados e considerados OK)

- **Schedule com `time` inválido (`"25:00"`)** é silenciosamente ignorado por
  `find_next_run` — degradação intencional documentada; o schema usa `cv.time`
  e o frontend valida via `parseTimeParts`.
- **Truncamento `int(duration)` em `_async_start_run`** — seguro porque todo
  caminho de entrada passa por schema `vol.Coerce(int)`.
- **`_active_actuated` (flag sticky)** e a decisão por estado atual (não pelo
  snapshot do evento) no listener — corretos; cobertos por `test_async_device.py`.
- **`unavailable`/`unknown` nunca contam como "confirmado off"** (política
  `confirmed_off_states`) — correta e bem testada (`test_review_fixes_2.py:301-360`).
- **Badges R1/R2 duplicam volume/estimativa/refill** — design deliberado,
  ancorado por testes (`test_reservoir.py:746-760`).
- **`NaN`/`inf` de pH** — tratados via `math.isfinite` no gate (fail-safe) e
  nos snapshots; cobertos por `test_ph_gate.py:258-290`.
- **Salvar store falha no início do run** — o revert completo (sem reschedule
  desnecessário, timer de schedule preservado) está correto
  (`test_review_fixes_2.py:168-197`).
- **`dayLabelFor` com "now − 24h"** — edge de DST é cosmético (rótulo
  Hoje/Ontem/DD/MM), sem impacto funcional.
- **Vazamento do `.js` servido após último unload** — o static path é
  intencionalmente vitalício; só o `extra_js_url` é removido (correto,
  `test_frontend.py:65-82`).

---

## 4. Testes executados

| Suite | Comando | Resultado |
|---|---|---|
| Backend puro | `$env:TEMP\opencode\irr-venv\Scripts\python.exe -m pytest tests/test_next_run.py tests/test_schedules.py -q` | **28 passed** (0.02s) |
| Backend HA | `$env:TEMP\opencode\ha-venv\Scripts\python.exe -m pytest tests -q` | **137 passed** (12.17s) |
| Frontend typecheck | `npm run typecheck` | **OK** (tsc --noEmit sem erros) |
| Frontend tests | `npm run test` | **132 passed** (3 arquivos: card 47, utils 82, editor 3) |
| Frontend build | `npm run build` | **OK** (rollup gerou o bundle IIFE) |
| Smoke do bundle | `node smoke.mjs` | **SMOKE OK** (apenas `day chips (Seg/Qua): false` — ver B4) |
| Verificação adversarial extra (puro) | edge cases de `find_next_run` (candidato == now excluído, dias fora do range tolerados, hora 1 dígito, time inválido → None, days vazio → None, now naive) | **Todos corretos** |
| Verificação estática do par registro/unregistro de serviços | extração das constantes `SERVICE_*` de `_async_register_services` vs `_async_unregister_services` | `MISSING: ['SERVICE_REFILL_RESERVOIR']` (confirmou M1) |

---

## 5. Status final

**PRECISA DE ALTERAÇÃO**

Todos os 297 testes automatizados (28 puros + 137 HA + 132 frontend) passam,
o typecheck, o build e o smoke do bundle também. Porém a revisão adversarial
encontrou dois problemas genuínos não cobertos por teste:

1. **M1** — `refill_reservoir` permanece registrado após o unload da última
   entry (vazamento de ciclo de vida; o teste `ALL_SERVICES` não o inclui).
2. **M2** — a recuperação de run expirado durante downtime registra histórico e
   deduz água do reservatório sem evidência de atuação real do alvo
   (inconsistente com o gate `history_actuated` usado em todo o restante do
   código), podendo gerar histórico/medição de volume falsos num crash em
   janela estreita.

Os demais achados (B1–B4) são baixos/robustez. Recomenda-se corrigir M1 (incluir
`SERVICE_REFILL_RESERVOIR` no unregister e em `ALL_SERVICES`) e M2 (persistir
um flag `actuated` no payload do store ou exigir confirmação antes de logar na
recuperação), com testes de regressão correspondentes.
