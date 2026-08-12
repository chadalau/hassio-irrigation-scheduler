# REVIEW-deepseek.md — Reverificação adversarial (deepseek-v4-flash)

**Status final: PRECISA DE ALTERAÇÃO**
**Data:** 2026-08-12 · **Ambiente:** Windows; venv puro `%TEMP%\opencode\irr-venv` (pytest 9.1.1) e venv HA `%TEMP%\opencode\ha-venv` (HA 2026.2.3, PHCC 0.13.316, Python 3.13.14); frontend Node 24 + TypeScript 5.6.3 / Vitest 2.1.9 / Rollup 4.

Reverificação adversarial **independente** do working tree (alterações não commitadas + testes novos
`tests/integration/test_history.py`, `test_ph_gate_r2.py`, `test_review_fixes.py`, `test_review_fixes_2.py`,
`frontend-src/tests/editor.test.ts`). **Não li nem alterei nenhum outro `REVIEW-*.md`** e **não alterei código
de produção nem testes** (o `npm run build` pedido regenerou `frontend/irrigation-schedule-card.js`, que já
estava ` M` no working tree antes desta revisão; o conteúdo é o build determinístico do mesmo TS de origem).
Verificações adversariais empíricas foram feitas com testes temporários **fora do repositório**
(`%TEMP%\opencode\`, apagados em seguida) para não tocar na árvore de testes.

---

## Achados da revisão anterior — verificação item a item

### (1) Parada externa sumindo do histórico — **CORRIGIDO**
O flag STICKY `_active_actuated` resolve o caso: é setado pelo listener quando o alvo se reporta atuado
(`scheduler.py:1388`), pela checagem de atuação deferida (`:1194`) e no resume (`:1587`). Em
`_async_finish_run`, `history_actuated = self._active_actuated or self._async_target_is_actuated()`
(`:979`) → uma run que realmente regou e foi parada por ator externo (alvo já `off` na hora do finish)
ainda é gravada; uma run que nunca atuou **não** é gravada (`:1066`).
Evidência de teste: `test_external_stop_after_real_watering_is_logged_to_history`,
`test_normal_completed_run_is_still_logged_to_history`, `test_run_that_never_actuates_is_not_logged_to_history`,
`test_short_run_dead_target_race_not_logged_to_history`, `test_manual_stop_logs_actual_elapsed_duration_not_the_requested_one`.

### (2) Zona presa em "Regando" em falha de I/O no store — **CORRIGIDO**
`_async_start_run` agora envolve `store.async_save_entry` em `try/except` (`scheduler.py:811-853`) e reverte
**todo** o estado em memória antes do `turn_on`, devolvendo a zona a um estado limpo (o `turn_on` nem é
enviado). Evidência de teste: `test_start_run_reverts_state_when_store_save_fails` (inclui `water_now`
subsequente funcionando normalmente).

### (3) Snapshot pH/EC não restaurado no resume — **CORRIGIDO**
`_async_recover_state` restaura `_active_ph_value/_active_ec_value/_active_ec_unit` e os pares R2 a partir do
payload persistido (`scheduler.py:1551-1556`); o resume que termina normalmente grava os valores originais.
Evidência de teste: `test_resumed_run_that_finishes_normally_logs_restored_ph_ec` (verifica R1 e R2).

### (4) Atributo `history` grande — **CORRIGIDO (limitado)**
Limites `HISTORY_RETENTION_DAYS = 30` / `HISTORY_MAX_ENTRIES = 200` (`const.py:88-89`), aplicados na carga
(`store.py async_load_history`) e no append (`async_append_history`), sempre via `_prune_history` (que ainda
normaliza `started_at` naive e descarta registros malformados). O atributo do binary_sensor (`binary_sensor.py:65`)
é, portanto, limitado. Evidência de teste: `test_history_caps_at_max_entries` (teto de 200, mais novo primeiro),
`test_history_survives_restart`, `test_prune_history_normalizes_naive_started_at_instead_of_raising`.
Observação residual (aceitável): 200 registros × ~13 campos ainda pesam ~40–60 KB por zona no atributo de
estado, reescrito no DB a cada mudança — delimitado e intencional, mas um teto menor ou exposição por
websocket seria mais leve.

### (5) Recovery removendo store sem confirmação de off — **CORRIGIDO**
A política `confirmed_off_states` (só `off`/`closed`; `unavailable`/`unknown` NÃO contam) é aplicada em todos
os caminhos: downtime (`scheduler.py:1492` — só remove se `_async_target_is_off()`), abort (`:1155-1169`),
`_async_finish_run` com retry + retenção (`:1039-1052`) e `_async_actuation_check_fired` delegando ao
`_async_finish_run` (`:1209-1221`). O resume não-atuado também delega (`:1583-1585`).
Evidência de teste: `test_recovery_keeps_store_when_defensive_turn_off_fails`,
`test_grace_abort_preserves_store_when_target_never_confirms_off`,
`test_abort_run_preserves_store_when_defensive_turn_off_unconfirmed`,
`test_recovery_resumed_not_actuated_preserves_store_when_target_unavailable`,
`test_failed_turn_off_keeps_store_for_restart_recovery`.

### (6) `started_at` naive — **NÃO CORRIGIDO COMPLETAMENTE** (ver abaixo)

---

## Achados NOVOS desta revisão (por severidade)

### MÉDIA-ALTA · (6, incompleto) `started_at` naive ainda quebra recovery/finish
**Arquivo:** `custom_components/irrigation_scheduler/scheduler.py`

`finishes_at` foi normalizado com `dt_util.as_utc()` em `_async_recover_state` (`:1469`), mas **`started_at`
não**: o resume usa `started_at = dt_util.parse_datetime(run_state.get("started_at"))` (`:1532`) **sem**
`as_utc`, e o caminho downtime usa `recovered_started_at = dt_util.parse_datetime(...)` (`:1496`) idem.
`parse_datetime` devolve datetime **naive** para string sem offset (confirmado no venv HA). Consequências,
todas confirmadas empiricamente com teste temporário fora do repo:

1. **Caminho downtime (fim da run durante o desligamento):** `_async_log_history` calcula
   `duration = max(0, int((finished_at - started_at).total_seconds()))` (`:1109`) **fora** do `try` →
   `TypeError: can't subtract offset-naive and offset-aware datetimes` → propaga por `_async_recover_state`
   → `async_setup_entry` → **`Error setting up entry Garden for irrigation_scheduler`** — a zona inteira
   falha ao carregar (entidades nem são criadas, agendamento morto).
2. **Caminho resume:** o setup passa, mas (a) ao disparar o stop timer, o mesmo `TypeError` escapa do
   callback (`Task exception was never retrieved`, histórico perdido, e `_reschedule_next()`/`_async_dispatch_update()`
   em `:1081-1082` não rodam → a zona para de agendar silenciosamente); (b) qualquer evento de estado do alvo
   durante a run estoura a comparação de grace `dt_util.utcnow() < self._started_at + timedelta(...)` (`:1402`)
   → detecção de parada externa quebrada.

Fix sugerido: normalizar com `dt_util.as_utc(...)` quando não-None em **ambos** os pontos
(`started_at` no resume e `recovered_started_at` no downtime), exatamente como `finishes_at` já é.

### MÉDIA · Parada externa por `unavailable`/`unknown` encerra a run SEM turn_off e REMOVE o store sem confirmação
**Arquivo:** `custom_components/irrigation_scheduler/scheduler.py:1380-1414` (`_async_target_state_changed`)

O listener decide pela presença em `off_states()`, que **inclui** `unavailable`/`unknown`
(`next_run.py:47-48`). Se o alvo for a `unavailable` após o grace, o listener chama
`_async_finish_run(turn_off=False, remove_state=True)`:
- nenhum `turn_off` é sequer tentado (o alvo pode estar fisicamente aberto);
- o registro de recovery do store é **descartado sem confirmação** — a exata política que o achado (5)
  estabeleceu em todos os outros caminhos (stop timer, abort, recovery, grace check usam
  `confirmed_off_states`/retenção).

Confirmado empiricamente (teste temporário, HA venv): alvo `switch.zone1` → `unavailable` durante a run
após o grace → `is_watering=False`, **0 chamadas de turn_off**, **store entry removido**, estado `unavailable`.

Cenário real: válvula Z-Wave/Zigbee/MQTT cai offline no meio da rega (bateria, mesh, reboot). A run termina,
nada fecha a válvula e nenhum boot futuro re-tenta — a `confirmed_off_states` documenta que "um device que
parou de reportar não é prova de que a válvula fechou", mas este único caminho viola isso.

Fix sugerido: tratar como parada externa legítima **somente** estados em `confirmed_off_states(domain)`
(`turn_off=False, remove_state=True`); para `unavailable`/`unknown`, ignorar o evento e deixar o stop timer
encerrar com `turn_off=True` + retry + retenção do store (comportamento seguro já existente nos outros caminhos).

### BAIXA · `store.async_remove_entry` sem proteção em `_async_finish_run`
**Arquivo:** `scheduler.py:1063-1064` (e `:1081-1082`)

Se a escrita de remoção falhar no fim da run, a exceção escapa do callback do stop timer/listener e
`_reschedule_next()`/`_async_dispatch_update()` são pulados — a zona deixa de agendar até restart/mudança de
opções (o estado da run já foi limpo, então **não** fica "Regando"; apenas o agendamento e o refresh morrem).
Inconsistente com o `try/except` que protege `async_append_history` logo em seguida (`:1125-1135`) e com o
`try/except` do achado (2). Sugestão: envolver a remoção em `try/except` com `_LOGGER.exception`.

---

## Falsos positivos percebidos (itens que pareciam suspeitos e NÃO são problemas)

- **`_async_abort_run` mantendo o store** quando o turn_off defensivo não confirma — comportamento correto e
  consistente com a política (5); testado em `test_abort_run_preserves_store_when_defensive_turn_off_unconfirmed`.
- **Race de run curta (< grace) entre stop timer e checagem de atuação** — o registro da checagem antes do stop
  timer decide corretamente (comentário `:885-895`); testado em `test_short_run_dead_target_race_not_logged_to_history`.
- **`_run_id` incrementado no início de `_async_start_run` mesmo com falha de save** — inofensivo (token
  monotônico; nenhum callback antigo pode casar).
- **`history` com 200 entradas** — teto intencional e testado (achado 4).
- **Editor `setConfig()`** (`editor.ts`) — correção legítima do contrato do editor do Lovelace; testada em
  `frontend-src/tests/editor.test.ts`.
- **Listener decidir pelo estado atual e não pelo `new_state` do evento** (`:1374-1389`) — correto para
  dispositivos async (echo defasado de `turn_off`); coberto por `deliver_stale_off`/testes de race.
- **`test_prune_history_normalizes_naive_started_at_instead_of_raising`** — bom, mas cobre só o pruning do
  store; **não** cobre os caminhos de recovery do scheduler (é exatamente a lacuna do achado 6).

---

## Testes executados

| Suíte | Comando | Resultado |
|---|---|---|
| Backend puro | `irr-venv python -m pytest tests/test_schedules.py tests/test_next_run.py -q` | **28 passed** |
| Backend HA (integração) | `ha-venv python -m pytest tests/integration -q` | **99 passed** (9.8s) |
| Novos testes de regressão | `ha-venv python -m pytest tests/integration/test_history.py test_ph_gate_r2.py test_review_fixes.py test_review_fixes_2.py -q` | **35 passed** |
| Frontend typecheck | `npm run typecheck` | **OK** (tsc --noEmit, 0 erros) |
| Frontend tests | `npm run test` | **110 passed** (3 arquivos: editor 3, utils 70, card 37) |
| Frontend build | `npm run build` | **OK** (rollup gerou `frontend/irrigation-schedule-card.js`) |
| Verificação adversarial (temp, fora do repo, apagado) | `test_naive_started_at.py` (2 casos) | **Ambos falharam** — confirma os 2 caminhos do achado (6) |
| Verificação adversarial (temp, fora do repo, apagado) | `test_unavailable_stop.py` | Confirmou o comportamento do achado novo (unavailable → run encerrada, 0 turn_off, store removido) |

Observação de ambiente: os testes puros **não** rodam no venv HA (o plugin PHCC ativa o guard
`pytest_socket` que bloqueia sockets no Windows); por isso usei o venv `irr-venv` dedicado, como o conftest
projeta. Os testes temporários de verificação exigiram os shims de socketpair e frontend do conftest do
projeto (replicados no arquivo temporário, sem tocar no repositório).

---

## Arquivos revisados

- `custom_components/irrigation_scheduler/scheduler.py` (integração, diffs e estado atual)
- `custom_components/irrigation_scheduler/store.py` · `const.py` · `sensor.py` · `binary_sensor.py`
- `custom_components/irrigation_scheduler/__init__.py` · `config_flow.py` · `next_run.py` · `schedules.py`
- `frontend-src/src/types.ts` · `utils.ts` · `card.ts` · `editor.ts`
- Testes: `tests/integration/test_history.py`, `test_ph_gate_r2.py`, `test_review_fixes.py`,
  `test_review_fixes_2.py`, `test_recovery.py`, `conftest.py`, `pytest.ini`

---

## Status final: **PRECISA DE ALTERAÇÃO**

5 dos 6 achados anteriores foram efetivamente corrigidos e estão cobertos por testes que passam. O achado (6)
(`started_at` naive) foi corrigido **apenas pela metade** (`finishes_at` sim, `started_at`/`recovered_started_at`
não), com consequências comprovadas de crash de setup e de fim-de-run + agendamento morto em store corrompido.
A revisão adversarial também encontrou um problema novo de segurança (médio): eventos externos de
`unavailable`/`unknown` encerram a run sem tentar `turn_off` e descartam o registro de recovery sem
confirmação, violando a própria política `confirmed_off_states` adotada em todos os outros caminhos.
