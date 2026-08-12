# Revisão adversarial — estado atual do working tree

## Arquivos revisados

- Backend: `custom_components/irrigation_scheduler/__init__.py`, `binary_sensor.py`, `config_flow.py`, `const.py`, `next_run.py`, `schedules.py`, `scheduler.py`, `sensor.py`, `store.py`, `services.yaml`, `manifest.json`, strings/traduções.
- Frontend: `frontend-src/src/card.ts`, `editor.ts`, `styles.ts`, `types.ts`, `utils.ts`, `const.ts`, configuração Rollup/Vitest e o artefato servido `custom_components/irrigation_scheduler/frontend/irrigation-schedule-card.js`.
- Testes: `tests/test_next_run.py`, `tests/test_schedules.py`, todos os testes em `tests/integration/`, e `frontend-src/tests/*.test.ts`.

## Achados

### Alta

1. **Histórico e consumo podem ser duplicados após falha de desligamento.**
   - **Arquivo/linhas:** `custom_components/irrigation_scheduler/scheduler.py:1093-1122` e `:1549-1598`.
   - **Cenário/evidência:** se as três tentativas de `turn_off` não confirmarem `off`, o código deliberadamente mantém o runtime store (`remove_state = False`), mas ainda registra o histórico e deduz o reservatório. No boot seguinte, a recuperação de uma execução expirada remove o store e registra a mesma execução novamente, deduzindo o volume outra vez. Isso produz duas regas no histórico e reduz o reservatório duas vezes para uma única execução (além de poder reaparecer como histórico após reinícios repetidos conforme o estado for preservado). O store precisa distinguir “histórico já registrado”/“consumo já deduzido” de “desligamento ainda pendente”, ou a recuperação não deve registrar novamente.

### Média

1. **Execução persistida antes do `turn_on` pode virar rega fantasma durante recovery.**
   - **Arquivo/linhas:** `scheduler.py:865-880` e `:1565-1587`.
   - **Cenário/evidência:** o runtime é salvo antes do comando de acionamento. Se HA cair entre o `async_save_entry` e o `turn_on` (ou o comando falhar e o processo cair antes do cleanup), o boot encontra o registro expirado, observa o alvo desligado, e registra a execução como concluída/deduz volume sem evidência de que houve água. O caminho normal possui `_active_actuated`, mas esse fato não é persistido. O registro deve conter um estado de acionamento confirmado, ou a recuperação deve tratar registros nunca confirmados como abortados.

2. **`refill_reservoir` não é removido ao descarregar a última entry.**
   - **Arquivo/linhas:** `custom_components/irrigation_scheduler/__init__.py:447-460`.
   - **Cenário/evidência:** o serviço é registrado na tupla de `:434-444`, mas a lista de `_async_unregister_services` omite `SERVICE_REFILL_RESERVOIR`. Depois de descarregar a última zona, o serviço continua exposto e seu handler antigo permanece registrado; chamadas posteriores falham com “nenhuma entidade”/não têm uma zona válida, em vez de o serviço desaparecer como os demais. Isso deixa estado global obsoleto e quebra o ciclo setup/unload.

3. **Consumo do reservatório fica permanentemente zero quando `number_of_pots == 0`.**
   - **Arquivo/linhas:** `scheduler.py:1192-1200`.
   - **Cenário/evidência:** a configuração documenta zero como “não configurado” (`scheduler.py:347-360`, `FUNCTIONS.md`), e o frontend trata zero como multiplicador 1 em `frontend-src/src/utils.ts:234-245`. Porém o backend calcula `flow_rate_lph / 3600 * duration * self.number_of_pots`, logo uma zona válida com vazão, reservatório e número de vasos padrão 0 nunca reduz `reservoir_remaining_l`. O cálculo de consumo deve usar pelo menos um vaso quando a quantidade é desconhecida, ou impedir rastreamento até a quantidade ser informada; a semântica precisa ser igual no backend e frontend.

### Baixa

1. **Rótulo “Ontem” incorreto em transições de horário de verão.**
   - **Arquivo/linhas:** `frontend-src/src/utils.ts:417-422`.
   - **Cenário/evidência:** “ontem” é calculado subtraindo exatamente 24 horas do instante atual. Em uma zona com DST, o dia civil anterior pode estar a 23 ou 25 horas; uma execução do dia civil anterior pode ser rotulada como uma data (`DD/MM`) em vez de `Ontem`, ou o agrupamento semanticamente esperado fica inconsistente. A comparação deve fazer aritmética de calendário no timezone alvo, não aritmética de milissegundos.

## Falsos positivos percebidos

- Os testes novos de duração corrompida, NaN/Infinity de pH, atualizações parciais de faixa, conflitos de IDs, recovery defensivo, histórico, reservatório e erros do backend passam; não tratei esses caminhos já cobertos como defeitos sem evidência adicional.
- A validação do card aceitar inicialmente apenas `sensor.` não é, sozinha, um bypass: o render também exige `switch_entity_id` e `binary_sensor_entity_id` em `card.ts:233-243`.
- O uso de `turn_off` com retry e retenção do runtime quando o alvo não confirma `off` é uma proteção correta; o defeito é registrar/deduzir antes de resolver a pendência, não a retenção em si.

## Sugestões

- Persistir no runtime flags idempotentes de acionamento confirmado, histórico e dedução, e tornar recovery/finish transações idempotentes.
- Incluir `SERVICE_REFILL_RESERVOIR` na rotina de unregister e adicionar teste de unload/reload verificando todos os serviços.
- Centralizar a regra de multiplicador de vasos em helper compartilhado (ou definir explicitamente zero como “um vaso desconhecido”) e cobrir o caso no backend.
- Adicionar testes com `America/New_York` nos limites de DST para `dayLabelFor`/`groupHistoryByDay`.

## Testes executados

- `$env:TEMP\opencode\irr-venv\Scripts\python.exe -m pytest tests/test_next_run.py tests/test_schedules.py -q` — **28 passed**.
- `$env:TEMP\opencode\ha-venv\Scripts\python.exe -m pytest tests -q` — **137 passed**.
- `frontend-src: npm run typecheck` — **passou**.
- `frontend-src: npm run test` — **132 passed (3 arquivos)**; apenas avisos esperados de Lit em modo dev.
- `frontend-src: npm run build` — **passou**; artefato gerado em `custom_components/irrigation_scheduler/frontend/irrigation-schedule-card.js`.

## Status final

# PRECISA DE ALTERAÇÃO
