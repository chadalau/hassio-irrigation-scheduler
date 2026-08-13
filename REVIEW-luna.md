# Revisão adversarial final — watergaia

## Escopo e arquivos revisados

Revisei o estado atual do working tree, incluindo as alterações não commitadas
em `FUNCTIONS.md`, `frontend-src/src/card.ts`,
`frontend-src/tests/card.test.ts` e no artefato frontend gerado.

Backend: `custom_components/irrigation_scheduler/__init__.py`, `const.py`,
`config_flow.py`, `scheduler.py`, `store.py`, `next_run.py`, `schedules.py`,
`switch.py`, `sensor.py` e `binary_sensor.py`.

Frontend: `frontend-src/src/card.ts`, `editor.ts`, `utils.ts`, `types.ts`,
`const.ts`, `styles.ts`; testes em `frontend-src/tests/card.test.ts`,
`editor.test.ts` e `utils.test.ts`.

Testes backend: `tests/test_next_run.py`, `tests/test_schedules.py` e todos os
testes sob `tests/integration/` (incluindo recuperação, reservatório, serviços,
config flow, pH e frontend).

## Achados por severidade

### Alta — PRECISA DE ALTERAÇÃO

- **`custom_components/irrigation_scheduler/scheduler.py:1182-1197` e
  `:1199-1215`; `store.py:97-110`** — as marcações `actuated` e
  `history_logged` não são operações atômicas de read-modify-write.
  `_async_store_mark_actuated()` e `_async_store_mark_history_logged()` fazem
  `async_load()` sob o lock, liberam-no, modificam o dicionário e depois chamam
  `async_save_entry()`, que faz outro load/save sob um novo lock. Cenário:
  duas zonas começam/confirmam atuação simultaneamente; ambas carregam o mesmo
  payload, cada uma altera sua própria entrada e a segunda grava seu snapshot,
  apagando a marcação/entrada adicionada pela primeira. No restart, a zona
  perdida pode ser interpretada como não atuada (perde histórico/dedução) ou
  continuar sem a atualização de recuperação esperada. A mesma janela existe
  para `history_logged`, podendo permitir re-log/dedução duplicada após falha de
  `turn_off`. Os testes atuais cobrem cada fluxo isoladamente, mas não o
  interleaving de duas zonas no mesmo arquivo compartilhado. A correção deve
  oferecer uma operação de atualização atômica no `RuntimeStore` (ou manter
  todo o ciclo sob o mesmo lock).

## Verificação dos dois achados anteriores

1. **`SERVICE_REFILL_RESERVOIR` no unregister:** corrigido. O serviço é
   registrado em `__init__.py:442` e removido em `__init__.py:449-457`.
2. **Recovery durante downtime sem evidência:** corrigido. Em
   `scheduler.py:1657-1697`, o histórico/dedução só ocorre com
   `run_state["actuated"]` verdadeiro e sem `history_logged`; o teste de
   regressão em `tests/integration/test_recovery.py:627-665` cobre o caso sem
   evidência, e `test_reservoir.py:222-261` cobre o caso com evidência.

## Falsos positivos percebidos

- A ausência de `actuated` em registros antigos não é um achado novo: o
  comportamento intencional é não inventar uma rega nem deduzir reservatório.
- `unavailable`/`unknown` não serem aceitos como confirmação de desligamento é
  deliberadamente fail-safe, não falha de recovery.
- A alteração de `showRow1`/rótulos R1-R2 no frontend é coerente com os testes
  adicionados e não foi classificada como defeito.
- Os avisos de modo de desenvolvimento do Lit durante os testes não indicam
  falha funcional.

## Sugestões

- Implementar `async_update_entry(entry_id, mutator)` no `RuntimeStore`, com
  load, mutação e save dentro de um único `asyncio.Lock`; usar essa operação
  para as duas marcações. Adicionar teste concorrente com duas entradas e
  interleaving forçado entre load e save, além de verificar preservação de
  `history_logged` após recovery.
- Manter os testes de regressão dos dois achados anteriores no conjunto final.

## Comandos executados

- `$env:TEMP\opencode\irr-venv\Scripts\python.exe -m pytest tests/test_next_run.py tests/test_schedules.py -q` — **28 passed**.
- `$env:TEMP\opencode\ha-venv\Scripts\python.exe -m pytest tests -q` — **141 passed**.
- `cd frontend-src; npm run typecheck` — **sucesso**.
- `cd frontend-src; npm run test` — **135 passed (3 arquivos)**.
- `cd frontend-src; npm run build` — **sucesso**.
- `git status --short` — working tree já continha alterações em `FUNCTIONS.md`,
  frontend fonte/teste e artefato gerado; nenhum código de produção ou teste
  foi intencionalmente editado para a revisão.

## Status final

**PRECISA DE ALTERAÇÃO** — há um risco concorrente de perda de estado no
runtime store compartilhado, relevante para segurança de recovery e integridade
do histórico/reservatório.
