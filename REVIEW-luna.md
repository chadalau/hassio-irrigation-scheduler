# Revisão adversarial independente — Luna

## Escopo e working tree

Revisado o estado atual do working tree, sem consultar os demais arquivos `REVIEW-*.md` e sem comparar com outros reviewers. O tree já estava amplamente alterado e contém, entre outros novos arquivos, `tests/integration/test_history.py`, `tests/integration/test_ph_gate_r2.py`, `tests/integration/test_review_fixes.py` e `frontend-src/tests/editor.test.ts`. Também há alterações não commitadas no backend, bundle frontend, fontes, testes, documentação e metadados.

Não foram feitas alterações deliberadas em código de produção ou testes. O comando de build solicitado reescreveu o artefato bundle em `custom_components/irrigation_scheduler/frontend/irrigation-schedule-card.js`; ele já fazia parte das alterações do working tree e não foi editado manualmente.

## Arquivos revisados

- Backend: `custom_components/irrigation_scheduler/__init__.py`, `binary_sensor.py`, `config_flow.py`, `const.py`, `next_run.py`, `scheduler.py`, `schedules.py`, `sensor.py`, `store.py`, `switch.py`, `services.yaml`, `manifest.json`.
- Frontend fonte: `frontend-src/src/card.ts`, `editor.ts`, `styles.ts`, `types.ts`, `utils.ts`, `const.ts`; bundle `custom_components/irrigation_scheduler/frontend/irrigation-schedule-card.js`.
- Testes: `tests/test_schedules.py`, `tests/test_next_run.py`, `tests/integration/conftest.py`, todos os testes em `tests/integration/`, incluindo os novos acima; `frontend-src/tests/card.test.ts`, `utils.test.ts`, `editor.test.ts`.
- Contratos/documentação/configuração: `README.md`, `FUNCTIONS.md`, `hacs.json`, `pytest.ini`, `requirements-test.txt`, `frontend-src/package.json`, `frontend-src/package-lock.json`, `frontend-src/tsconfig.json`, `frontend-src/vitest.config.ts`, `frontend-src/rollup.config.mjs`, `strings.json` e traduções.

## Achados

### Alta — histórico perde as leituras capturadas quando a execução atravessa um restart

- **Arquivo:linha:** `custom_components/irrigation_scheduler/scheduler.py:1474-1482`.
- **Cenário/evidência:** `_async_start_run` persiste `ph_value`, `ec_value`, unidades e os valores R2 no runtime store (`:793-807`). Porém, ao recuperar uma execução ainda ativa, `_async_recover_state` restaura apenas `started_at`, `finishes_at`, duração, source e schedule id; não restaura nenhum dos seis campos de leitura para `_active_*`. Quando o timer termina depois do restart, `_async_finish_run` captura esses atributos já nulos (`:918-923`) e grava um histórico sem as leituras que existiam no início da rega. Isso contradiz o contrato documentado de snapshot no início e torna o histórico dependente de restart.
- **Sugestão:** restaurar todos os snapshots persistidos durante a recuperação, validando tipos/unidades como dados informativos, e cobrir explicitamente “restart durante execução -> finish -> histórico”.

### Média — execução desligada externamente não é registrada no histórico

- **Arquivo:linha:** `custom_components/irrigation_scheduler/scheduler.py:1344-1353` e `:924-930,1016-1028`.
- **Cenário/evidência:** ao receber uma mudança externa para `off`/`closed`, o listener chama `_async_finish_run(turn_off=False)`. Antes de desligar o estado, `_async_finish_run` define `history_actuated = self._async_target_is_actuated()`. Como o alvo já está off no evento, o valor é falso e a condição `log_history and history_actuated` impede o append. Assim, uma válvula que regou por 10 minutos e depois foi desligada por automação, dispositivo ou usuário desaparece do histórico; o histórico não representa todas as regas concluídas.
- **Sugestão:** distinguir “nunca atuou” (somente falha na janela de actuation) de “atuou e depois desligou externamente”; no caminho do listener, preservar a evidência de que a execução estava ativa e registrar a duração real, sem enfraquecer a proteção contra logar uma tentativa que nunca atuou.

### Baixa — datas do histórico são agrupadas no fuso do navegador, enquanto o próximo disparo usa o fuso do servidor

- **Arquivo:linha:** `frontend-src/src/utils.ts:320-367` e `frontend-src/src/card.ts:1006-1011,1314-1332`.
- **Cenário/evidência:** `_nextRunText` usa `hass.config.time_zone`, mas `dayLabelFor`, `groupHistoryByDay` e os horários de histórico usam implicitamente o fuso local do browser (`Date.toDateString()`/`Intl` sem `timeZone`). Um usuário em outro fuso pode ver uma execução agrupada no dia errado e uma hora diferente da hora operacional do HA.
- **Sugestão:** escolher e aplicar consistentemente o fuso do servidor ao agrupar e formatar o histórico, ou documentar explicitamente que o histórico é local do visualizador e testar essa decisão em browsers com fusos distintos.

## Falsos positivos percebidos

- O `async_track_point_in_time` antes do stop timer e o `ACTUATION_GRACE` não constituem, por si só, uma janela sem watchdog: o timer é armado logo após o comando de ligar (`scheduler.py:840-867`).
- O uso de `turn_off=False` no listener não é uma falha de segurança por si só: o listener só entra quando o estado atual já é off/closed; o problema apontado é a perda de histórico.
- `next_run.py` usa oito dias de busca (`range(8)`), o que cobre o dia atual e o próximo ciclo semanal; não encontrei erro de wrap semanal nesse ponto.
- A ausência de leituras durante recuperação após uma execução que terminou durante o downtime não é o mesmo defeito: esse caminho usa diretamente os valores persistidos (`scheduler.py:1438-1449`).

## Testes executados

- `python -m pytest tests/test_schedules.py tests/test_next_run.py -q` — **26 passed, 2 skipped**.
- `& "$env:TEMP\opencode\ha-venv\Scripts\python.exe" -m pytest tests/integration -q` — **93 passed**.
- `npm run typecheck` em `frontend-src` — **passou**.
- `npm run test` em `frontend-src` — **3 arquivos, 107 testes passed**.
- `npm run build` em `frontend-src` — **passou**, gerando o bundle no diretório da integração.

## Status final

# PRECISA DE ALTERAÇÃO

Há perda de dados funcional no histórico após restart e ao desligar externamente, além da inconsistência de fuso no frontend. Os testes existentes passam, mas não cobrem adequadamente esses cenários adversariais.
