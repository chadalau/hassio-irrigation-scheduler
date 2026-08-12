# REVIEW-deepseek.md — Revisão adversarial independente (deepseek-v4-flash)

**Status final: PRECISA DE ALTERAÇÃO**
**Data:** 2026-08-12 · **Ambiente:** Windows, HA 2026.2.3 + PHCC (venv `%TEMP%\opencode\ha-venv`), Python 3.13/3.14, Node 24 + Vitest/Rollup

Revisão independente do código **atual** (working tree), sem comparar com outros
reviewers e sem ler os demais `REVIEW*.md`. Nenhum arquivo de produção/teste foi
alterado; os testes adversariais foram executados a partir de diretório temporário
fora do workspace e removidos em seguida.

---

## 1. Arquivos revisados

### Backend `custom_components/irrigation_scheduler/`
| Arquivo | Papel |
|---|---|
| `__init__.py` (468) | Setup, 7 serviços, frontend wiring, resolução de alvos, schemas voluptuous |
| `scheduler.py` (1440) | Motor de agendamento, lifecycle da rega, gate de pH, recovery, history |
| `next_run.py` (176) | Cálculo puro do próximo horário (zero imports HA) |
| `schedules.py` (65) | Serialização / imutabilidade de id |
| `store.py` (141) | Persistência volátil (runtime + history, lock compartilhado) |
| `sensor.py` (152) | Sensor `next_run` + contrato de atributos do card |
| `switch.py` (73) | Switch `schedule_enabled` |
| `binary_sensor.py` (81) | Binary sensor `watering` + atributos de history |
| `config_flow.py` (355) | Config/options flow (durations, vazão, vasos, reservatório, pH, EC) |
| `const.py`, `manifest.json`, `services.yaml`, `strings.json`, `translations/{en,pt-BR}.json`, `frontend/irrigation-schedule-card.js` | Contratos e metadados |

### Frontend `frontend-src/`
`src/{card.ts (1291), editor.ts, utils.ts (338), types.ts, const.ts, styles.ts}`, `rollup.config.mjs`, `smoke.mjs`, `package.json`, `tsconfig.json`, `vitest.config.ts`, `tests/{utils,editor,card}.test.ts`.

### Testes
`tests/{test_next_run.py, test_schedules.py, pure_loader.py}`, `tests/integration/{conftest.py, test_init.py, test_services.py, test_recovery.py, test_async_device.py, test_config_flow.py, test_frontend.py, test_ph_gate.py, test_history.py}`.

### Documentação
`README.md`, `FUNCTIONS.md`, `hacs.json`, `pytest.ini`, `requirements-test.txt`.

---

## 2. Achados por severidade

### ALTO

#### A1. Options flow apaga silenciosamente o `ph_entity_id`/`ec_entity_id` configurado ao salvar só as durações
- **Arquivo:** `config_flow.py`, `IrrigationSchedulerOptionsFlow.async_step_init` (linhas 247-262).
- **Cenário/evidência (reproduzido no harness PHCC):** com uma zona configurada com
  `ph_entity_id="sensor.reservoir_ph"`, `ph_min=5.5`, `ph_max=6.5` e
  `ec_entity_id="sensor.reservoir_ec"`, abrir o options flow e salvar **apenas** as
  durações (campos pH/EC não tocados — chaves ausentes em `user_input`, como o frontend
  se comporta para campos `vol.Optional` sem `default`) resulta em:
  `ph_entity_id=''` e `ec_entity_id=''` persistidos (teste adversarial confirmou). A
  causa é `user_input.get(CONF_PH_ENTITY_ID) or DEFAULT_PH_ENTITY_ID` (e o mesmo para EC):
  a chave ausente vira `""`, sobrescrevendo a opção existente. O teste existente
  (`test_options_flow_changes_durations_without_reload_or_interrupt`) **não** assere a
  preservação de pH/EC e, portanto, não pega a regressão.
- **Impacto:** o gate de pH é desabilitado silenciosamente (regas agendadas passam a
  ocorrer fora da faixa de pH sem nenhum aviso) e o badge de EC desaparece. Perda de
  configuração sem feedback.
- **Sugestão:** preservar o valor atual quando a chave está ausente, ex.:
  `user_input.get(CONF_PH_ENTITY_ID, current_ph_entity)` (sem o `or DEFAULT`, que é o
  que destrói `""` legítimo); adicionar teste que salva sem tocar nos campos de pH/EC e
  assere a preservação.

#### A2. Alvo que atua DEPOIS do aborto por grace fica ligado para sempre (sem safety net)
- **Arquivo:** `scheduler.py`, `_async_actuation_check_fired` (985-1032) e `_async_finish_run` (781-918).
- **Cenário/evidência (reproduzido):** `water_now` em device assíncrono lento; o
  `turn_on` é despachado; ao fim do grace (15 s) o alvo ainda está `off` →
  `_async_actuation_check_fired` envia turn_off defensivo, chama `_async_finish_run(
  turn_off=False, remove_state=True, log_history=False)` e cancela todos os timers. Se o
  dispositivo atuar **depois** do aborto (ex.: em t=+20 s, após retry de rota/mesh), o
  alvo fica **ON com nenhum timer, nenhuma entrada no store e nenhum listener reagindo**
  (`_async_target_state_changed` retorna pois `_is_watering` é False). Avançando o relógio
  em 1 h, o estado permanece `on` com 0 turn_off adicionais. Violação da invariante
  documentada: *"There must never be a window in which a turn_on was sent without a timer
  that will turn the target off"* — a janela existe para atuações tardias.
- **Impacto:** válvula aberta indefinidamente (rega ininterrupta) em dispositivos com
  atuação >15 s após o comando, sem qualquer recuperação (nem restart: store vazio).
- **Sugestão:** após o aborto por grace, manter uma janela de vigilância estendida que
  observe o alvo (ex.: re-armar um "watchdog" curto que reenvie turn_off enquanto o alvo
  estiver ON sem run ativo), ou manter o estado no store até o alvo ser **confirmado**
  `off`/`closed` (consistente com a filosofia de `_async_finish_run`/`_async_recover_state`).

### MÉDIO

#### M1. Rega que nunca atuou é registrada no history como "concluída"
- **Arquivo:** `scheduler.py`, `_async_finish_run` (log_history padrão `True`, linhas 781-918), `_async_stop_timer_fired` (981-983), armadura dos timers em `_async_start_run` (750-769).
- **Cenário/evidência (reproduzido):** dois gatilhos confirmados:
  1. **Rega curta (duração < `ACTUATION_GRACE`, ex. 5 s) com alvo morto:** o stop timer é
     armado **antes** do actuation check e ambos disparam no mesmo instante
     (`grace == finishes_at`). O stop timer vence a corrida, chama
     `_async_finish_run(turn_off=True, remove_state=True)` com `log_history=True` e
     **cancela** o actuation check → um registro `{duration: 0, ...}` entra no history
     mesmo sem uma gota ter sido entregue.
  2. **`stop` manual durante a janela de grace** de um alvo que nunca atuou:
     `_async_stop` → `_async_finish_run(turn_off=True, remove_state=True)` → registro
     `{duration: 0}` confirmado.
- **Impacto:** viola a invariante documentada ("a run that never actuates ... is
  deliberately NOT logged") e polui o histórico/card (linha "Última rega" e estatísticas
  com entradas falsas de 0 s/0 ml).
- **Sugestão:** em `_async_finish_run`, logar history apenas quando a atuação foi
  confirmada em algum momento (ex.: checar `_async_target_is_actuated()` ou guardar um
  flag `_actuation_confirmed` setado pelo actuation check); para regas curtas, agendar o
  actuation check **antes** do stop timer ou tratá-lo como o decisor.

### BAIXO

| ID | Achado | Evidência |
|---|---|---|
| B1 | O card engole erros de validação do backend | `card.ts` `_callService` (1122-1135) só faz `console.error`; `_saveDialog` (1207-1221) e `_saveSettings` fecham o diálogo sem feedback. Ex.: duração > 86400 s no diálogo, ou `default_duration > max_duration` no painel de settings → `ServiceValidationError`/`MultipleInvalid` no servidor, silenciosos para o usuário. O input de minutos do diálogo não tem `max` (linha 886), permitindo valores inválidos que o cliente não valida. |
| B2 | `_async_abort_run` remove o store incondicionalmente, mesmo se o turn_off defensivo falhar | `scheduler.py` 966-979: se `turn_on` lançar (parcialmente atuado) e o turn_off defensivo também falhar, o registro é apagado — inconsistente com `_async_finish_run`/`_async_recover_state`, que **preservam** o store quando o off não é confirmado (safety net de restart). |
| B3 | Domínio alvo não suportado (config corrompida) deixa a zona "watering" travada | `scheduler.py` 714: `resolve_target_services(self.target_domain)` lança `ValueError` **depois** do save no store (700-712) e **antes** do `try/except` do turn_on → `_is_watering=True` sem timers; zona fica "Regando" até restart. Apenas com `entry.data` editada à mão (config flow restringe os 4 domínios). |
| B4 | Comentário incorreto sobre schemas "estritos" | `__init__.py` 158-160: "the schemas are strict and reject extra keys" — `vol.Schema` usa `ALLOW_EXTRA` por padrão; campos desconhecidos (ex.: `ph_minn: 7` em `set_zone_options`) são **ignorados silenciosamente** (vira no-op). Sugestão: `extra=vol.PREVENT_EXTRA` ou corrigir o comentário. |

---

## 3. Falsos positivos percebidos / pontos verificados e aprovados

- **pH `nan`/`NaN`/`-nan` liberando a rega (CRÍTICO da rodada anterior):** **CORRIGIDO**.
  `_check_ph_gate` exige `math.isfinite(value)` (1106-1114) e o teste parametrizado
  cobre `nan`, `NaN`, `-nan`, `inf`, `-inf`. Verificado em runtime.
- **Recovery com `duration` corrompido derrubando o setup (A1 anterior):** **CORRIGIDO**.
  `_coerce_stored_duration` (1359-1387) recalcula/clampa; o stop timer é armado contra
  `finishes_at`, nunca contra `duration`. `test_corrupt_duration_in_store_does_not_abort_setup` passa.
- **Horário com `duration` corrompida matando a cadeia de agendamento (M1 anterior):**
  **CORRIGIDO**. `schedules` filtra duration não-int/fora de faixa (233-248) e
  `_async_schedule_fired` roda `_reschedule_next()` em `finally` (1080-1081).
- **`set_zone_options` parcial invertendo a faixa de pH (M2 anterior):** **CORRIGIDO**.
  Validação do **estado efetivo** (548-555); teste de regressão presente.
- **`set_schedules` sem `schedules` / item não-dict (B1 anterior):** **CORRIGIDO**.
  `ServiceValidationError` nomeando o índice; teste presente.
- **`update_schedule`/`remove_schedule` no-ops silenciosos (B8 anterior) e ids
  duplicados (B7 anterior):** **CORRIGIDOS** — agora lançam erro e geram id fresco.
- **Timer de desligamento armado imediatamente após o turn_on:** correto e testado
  (stop timer antes do actuation check; `test_stop_timer_armed_before_deferred_actuation_check`).
- **Listener decide pelo estado atual + token de geração `_run_id` + janela de grace:**
  correto e bem testado (stale off echo, slow device, nunca-atuante, corrida stop/turn_off).
- **Turn_off não confirmado preserva o store (restart recovery):** correto e testado.
- **`RuntimeStore` único compartilhado com lock:** correto; duas zonas simultâneas não se clobberam.
- **Gate de pH só em regas agendadas; `water_now` é override explícito:** por design e testado.
- **`ph_entity_id=""` explícito ≠ `None` (não altera):** correto e testado.
- **`merge_schedule_update` preserva o id:** correto e testado.
- **Bundle frontend consistente com o fonte:** o artefato buildado contém os marcadores
  do código atual (badges pH/EC, `schedule_warnings`, settings panel); smoke test OK.
- **Traduções `en`/`pt-BR` e `strings.json`/`services.yaml`:** consistentes entre si.

---

## 4. Testes executados

### Backend puro (venv `irr-venv`, sem HA)
| Comando | Resultado |
|---|---|
| `pytest tests/test_next_run.py tests/test_schedules.py -q` | **28 passed** |

### Backend + HA (venv `ha-venv`, HA 2026.2.3 + PHCC)
| Comando | Resultado |
|---|---|
| `pytest tests -q` | **100 passed** |

### Frontend (`frontend-src/`)
| Comando | Resultado |
|---|---|
| `npm run typecheck` | **0 erros** |
| `npm run test` (vitest) | **87 passed** (3 arquivos) |
| `node smoke.mjs` (bundle buildado) | **SMOKE OK** |

### Testes adversariais (temporários, em `%TEMP%\opencode\adv_review`, removidos após a execução)
| Cenário testado | Resultado |
|---|---|
| Rega curta (5 s) + alvo que nunca atua → history | **FALHA confirmada** — registro `duration:0` gravado (M1.1) |
| `stop` manual durante o grace de alvo nunca-atuante → history | **FALHA confirmada** — registro `duration:0` gravado (M1.2) |
| Alvo atua após o aborto por grace → safety net | **FALHA confirmada** — alvo fica `on` para sempre, 0 turn_off, store vazio (A2) |
| Options flow salvando só durações → pH/EC | **FALHA confirmada** — `ph_entity_id`/`ec_entity_id` apagados para `''` (A1) |
| `turn_on` lança + turn_off defensivo falha → store | Comportamento confirmado (store removido; flag B2) |

O workspace não foi alterado por esta revisão (nenhum arquivo de produção/teste tocado;
apenas este `REVIEW-deepseek.md` foi sobrescrito).

---

## 5. Sugestões priorizadas

1. **A1 (config_flow.py):** preservar a opção existente quando a chave está ausente no
   options flow (`user_input.get(CONF_PH_ENTITY_ID, current_ph_entity)` e idem EC) e
   adicionar teste de regressão.
2. **A2 (scheduler.py):** vigiar o alvo após um aborto por grace até confirmar
   `off`/`closed`, ou manter o store como safety net até a confirmação — e testar a
   atuação tardia (t > grace).
3. **M1 (scheduler.py):** só logar history quando a atuação foi confirmada; para regas
   com `duration < ACTUATION_GRACE`, ordenar timers de forma que o actuation check
   decida antes do stop timer.
4. **B1 (card.ts):** expor erro do backend ao usuário (estado `_formError`/`_settingsError`
   em vez de `console.error`) e limitar o input de minutos ao máximo permitido.
5. **B2/B3/B4:** alinhar `_async_abort_run` à política de preservação do store; tratar
   `ValueError` de domínio antes do save; `extra=vol.PREVENT_EXTRA` ou corrigir comentário.

---

## 6. Comandos reproduzíveis

```powershell
# Backend puro
& "$env:TEMP\opencode\irr-venv\Scripts\python.exe" -m pytest tests/test_next_run.py tests/test_schedules.py -q

# Backend + HA (PHCC)
& "$env:TEMP\opencode\ha-venv\Scripts\python.exe" -m pytest tests -q

# Frontend
cd frontend-src
npm run typecheck
npm run test
node smoke.mjs
```

---

## 7. Conclusão

**PRECISA DE ALTERAÇÃO.** O núcleo do scheduler está sólido e as falhas críticas
apontadas na rodada anterior (pH `nan`, recovery com duration corrompida, schedule com
duration corrompida) foram **corrigidas e cobertas por testes**. Porém esta revisão
confirmou em runtime três problemas novos: (A1) o options flow apaga silenciosamente o
gate de pH/EC configurado ao salvar apenas durações; (A2) um alvo que atua após o aborto
por grace fica ligado indefinidamente, sem timer, store ou listener (violação da
invariante de segurança da válvula); e (M1) regas que nunca atuaram entram no history
como concluídas (rega curta + alvo morto, ou stop durante o grace). Recomenda-se corrigir
A1/A2/M1 com testes de regressão adversarial antes da aprovação; B1-B4 são melhorias de
UX/robustez de baixo custo.
