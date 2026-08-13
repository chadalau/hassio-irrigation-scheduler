# Auditoria adversarial — estado atual

## Arquivos revisados

- Backend: `custom_components/irrigation_scheduler/{__init__.py,binary_sensor.py,config_flow.py,const.py,next_run.py,scheduler.py,schedules.py,sensor.py,store.py,switch.py}`.
- Frontend fonte: `frontend-src/src/{card.ts,const.ts,editor.ts,styles.ts,types.ts,utils.ts}`.
- Testes backend: `tests/test_next_run.py`, `tests/test_schedules.py` e todos os testes em `tests/integration/`.
- Testes frontend: `frontend-src/tests/{card.test.ts,editor.test.ts,utils.test.ts}`.
- Estado considerado: working tree atual, incluindo alterações não commitadas e arquivos não rastreados relevantes.

## Achados por severidade

### MÉDIO — entrada de histórico malformada pode derrubar a renderização do card

- **Arquivo/linha:** `frontend-src/src/card.ts:1311-1317` e `frontend-src/src/utils.ts:567-570`.
- **Cenário/evidência:** `_isHistoryRun` aceita qualquer `started_at` string, sem verificar se ela é uma data parseável. Quando a ocorrência de hoje já passou, `scheduleStatusToday` chama `dayKey(new Date(entry.started_at), timeZone)` para cada entrada. Uma string inválida produz `Invalid Date`; `Intl.DateTimeFormat(...).format()` lança `RangeError`. Esse erro sobe para `render()`, que substitui o card inteiro pela mensagem genérica de falha. Uma entidade com atributo `history` parcialmente corrompido (migração, restore ou estado publicado por outro componente) portanto torna o card inutilizável, embora `groupHistoryByDay` já trate esse mesmo tipo de entrada como descartável.
- **Correção sugerida:** validar `Date.parse(started_at)` em `_isHistoryRun`, ou filtrar entradas inválidas antes de `dayKey`/proteger `scheduleStatusToday` contra datas inválidas. Adicionar teste de renderização com `history: [{ started_at: "not-a-date", ... }]` e horário de hoje já passado.

Não foram identificados outros problemas reproduzíveis de severidade alta ou crítica no backend, frontend ou testes revisados.

## Verificação do achado da rodada anterior

**Corrigido.** `frontend-src/src/editor.ts:64-77` lê `ev.detail.value`, trata o valor como a configuração completa, mescla com `_config` e dispara `config-changed`. O teste de regressão em `frontend-src/tests/editor.test.ts:66-112` usa o formato real `{ value: ... }` e passou. Não há leitura de `ev.detail.name` no caminho.

## Falsos positivos percebidos

- O `build` atualiza o bundle gerado em `custom_components/irrigation_scheduler/frontend/`; a alteração já fazia parte do estado do working tree e não foi interpretada como defeito independente do código-fonte.
- O retorno `null` de `scheduleStatusToday` após um horário passado sem histórico não é tratado como erro: é deliberadamente estado ambíguo, conforme o contrato documentado.
- `unavailable`/`unknown` não encerra nem inicia cegamente uma rega; isso é comportamento fail-safe intencional, não uma falha de detecção.
- A ausência de detecção de um alvo que já estava ligado antes do setup não foi classificada como defeito: a implementação rastreia mudanças externas observadas pelo listener, não faz inferência retroativa sobre um estado anterior.

## Testes executados

- `$env:TEMP\opencode\irr-venv\Scripts\python.exe -m pytest tests/test_next_run.py tests/test_schedules.py -q` — **35 passed**.
- `$env:TEMP\opencode\ha-venv\Scripts\python.exe -m pytest tests -q` — **164 passed**.
- `cd frontend-src; npm run typecheck` — **passou**.
- `cd frontend-src; npm run test` — **153 passed (3 arquivos)**.
- `cd frontend-src; npm run build` — **passou**.

## Status final

**PRECISA DE ALTERAÇÃO**
