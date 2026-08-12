# Revisão adversarial — rodada pós-correções

## Arquivos revisados

- `custom_components/irrigation_scheduler/scheduler.py`
- `custom_components/irrigation_scheduler/store.py`
- `custom_components/irrigation_scheduler/binary_sensor.py`
- `custom_components/irrigation_scheduler/sensor.py`
- `custom_components/irrigation_scheduler/const.py`
- `custom_components/irrigation_scheduler/__init__.py`
- `custom_components/irrigation_scheduler/frontend/irrigation-schedule-card.js`
- `frontend-src/tests/editor.test.ts`
- Testes de backend em `tests/` e `tests/integration/` (sem alteração)

## Achados

### ALTA — `started_at` naive ainda pode quebrar recovery e histórico

**Status do achado anterior: não corrigido integralmente.**

Em `scheduler.py:1458-1469`, somente `finishes_at` é normalizado com
`dt_util.as_utc()`. Em `:1532-1541`, um `started_at` parseável mas naive é
atribuído diretamente a `_started_at`. Depois, ao finalizar, `_async_log_history`
faz `finished_at - started_at` (`:1109`), misturando datetime aware e naive e
levantando `TypeError`. O mesmo risco existe no caminho de recovery expirado,
quando `recovered_started_at` naive é passado ao logger (`:1496-1505`).

Cenários afetados: store editado/legado com `started_at` sem timezone, tanto
com run ainda futuro quanto expirado durante downtime. O teste existente
`test_prune_history_normalizes_naive_started_at_instead_of_raising` cobre apenas
`_prune_history`, não esses caminhos de recovery.

**Sugestão:** normalizar `started_at` com `dt_util.as_utc()` após o parse, antes
de armazená-lo/usar em `_coerce_stored_duration` e no logging; tratar valor
inválido de modo consistente sem permitir exceção na inicialização.

### MÉDIA — o atributo de estado `history` continua potencialmente grande

Em `binary_sensor.py:56-66`, `extra_state_attributes` ainda publica a lista
completa em `"history"`. O limite de `HISTORY_MAX_ENTRIES = 200` e a poda em
`store.py:41-64` evitam crescimento ilimitado, mas 200 objetos (com timestamps,
snapshots e metadados) continuam sendo serializados em cada state update,
duplicados no histórico/recorder e enviados a consumidores do estado. Isso não
elimina o problema original de payload grande; apenas o torna limitado.

O frontend usa essa lista em `irrigation-schedule-card.js` (`_historyAttr`),
portanto a mudança precisa preservar a UX (por exemplo, expor somente uma
janela pequena no atributo ou migrar a consulta detalhada para outro mecanismo).
O teste `test_history_caps_at_max_entries` comprova o teto de 200, mas não
mede tamanho do atributo nem custo de publicação.

## Verificação dos seis pontos solicitados

- **Parada externa sumindo do histórico:** corrigido. O listener marca
  `_active_actuated` quando observa o alvo ligado (`scheduler.py:1380-1389`),
  e `_async_finish_run` usa esse marcador antes de limpar o estado
  (`:969-979`, `:1066-1078`). O teste `test_external_stop_after_real_watering_is_logged_to_history`
  passou.
- **Zona presa em “Regando” após falha de I/O no store:** corrigido para falha
  em `async_save_entry`. O estado é revertido integralmente em
  `scheduler.py:811-853`, antes de qualquer `turn_on`; o teste
  `test_start_run_reverts_state_when_store_save_fails` passou.
- **Snapshot pH/EC perdido no resume:** corrigido. Os campos são persistidos
  no início (`:812-825`) e restaurados no recovery (`:1547-1556`); o teste
  `test_resumed_run_that_finishes_normally_logs_restored_ph_ec` passou.
- **Atributo `history` grande:** apenas parcialmente mitigado. Há retenção de
  30 dias e teto de 200, mas a lista inteira ainda é atributo do binary sensor.
- **Recovery removendo store sem confirmação de off:** corrigido. O caminho
  expirado só remove após `_async_target_is_off()` (`:1487-1493`), e falha,
  `unknown` ou `unavailable` preserva o registro (`:1515-1522`). Os testes de
  falha de turn-off e de alvo indisponível passaram.
- **`started_at` naive:** corrigido somente na poda de histórico
  (`store.py:51-60`); permanece vulnerável no recovery, conforme achado ALTA.

## Falsos positivos percebidos

- A ausência de uma segunda tentativa de actuation-grace no resume não é, por
  si só, falha: o código verifica o estado imediatamente e mantém o timer de
  parada.
- A remoção do store após `turn_off` não é insegura quando o estado atual é
  explicitamente `off`/`closed`; `unknown`/`unavailable` são corretamente
  tratados como não confirmados.
- O teste de cap de histórico não demonstra que o atributo é pequeno; ele
  demonstra apenas que não cresce sem limite. Não foi contado como correção
  completa do payload grande.

## Testes e comandos executados

- `python -m pytest tests --ignore=tests/integration` — **26 passed, 2 skipped**
- `& "$env:TEMP\opencode\ha-venv\Scripts\python.exe" -m pytest tests/integration` — **99 passed**
- `npm run typecheck` — **passou**
- `npm run test` — **110 passed (3 arquivos)**
- `npm run build` — **passou**

## Status final

# PRECISA DE ALTERAÇÃO

Corrigir a normalização de `started_at` em todos os caminhos de recovery antes
de aprovar. Também é recomendável reduzir/remover a lista completa do atributo
de estado; o limite atual evita crescimento infinito, mas não resolve
integralmente o achado de payload grande.
