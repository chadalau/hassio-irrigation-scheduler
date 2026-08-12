# REVIEW-deepseek-pro.md — Revisão completa (deepseek-v4-pro)

**Revisor:** deepseek-v4-pro (DeepSeek API) · **Status: PRECISA DE ALTERAÇÃO**

Revisão completa do estado atual de `watergaia`. Não alterei código de produção
nem testes. Números executados por mim.

## Testes executados

| Suite | Resultado |
|---|---|
| Backend completo (HA 2026.2.3 + PHCC) | **137 passed** |
| Backend puro | **28 passed** |
| Frontend typecheck / vitest | **0 erros** / **132 passed** |
| `compileall custom_components` | **0 erros** |

## Achados anteriores — status

| # | Achado | Veredito |
|---|---|---|
| 1 | Parada externa some do histórico | ✅ corrigido (`_active_actuated`) |
| 2 | Zona presa em "Regando" (falha I/O store) | ✅ corrigido |
| 3 | Snapshot pH/EC no resume | ✅ corrigido |
| 4 | Atributo `history` grande | ✅ corrigido (prune) |
| 5 | Recovery sem confirmação de off | ✅ corrigido (`confirmed_off_states`) |
| 6 | `started_at` naive | ✅ **agora corrigido** — `dt_util.as_utc` no downtime (1582) e no resume (1629) |

## Achados confirmados nesta rodada

### MÉDIO — `SERVICE_REFILL_RESERVOIR` não é desregistrado no unload

**Arquivo:** `__init__.py`, `_async_unregister_services` (447-459).

O serviço `refill_reservoir` é registrado em `_async_register_services`
(442), mas a lista de `_async_unregister_services` (450-456) **não o inclui**.
Quando a última entry é descarregada, os outros 7 serviços são removidos e
`refill_reservoir` permanece órfão (o HA loga "unknown service" se chamado
depois). É um vazamento de registro, sem impacto funcional enquanto alguma
entry estiver ativa. (Coincide com DeepSeek M1 e Qwen M1.)

**Sugestão:** adicionar `SERVICE_REFILL_RESERVOIR` à lista de unregister e
cobrir no `ALL_SERVICES` do `test_init.py`.

### MÉDIO — Downtime recovery registra rega completa + deduz reservatório sem evidência de atuação

**Arquivo:** `scheduler.py`, `_async_recover_state` downtime (1570-1598) e
`_async_log_history` (1199-1200).

O caminho "expirado durante downtime" chama `_async_log_history`
**incondicionalmente** quando o alvo está off (1570), registrando uma rega
completa e deduzindo `flow_rate_lph × pots × duration` do reservatório. Porém o
`async_save_entry` roda **antes** do `turn_on` em `_async_start_run`; um crash
nessa janela deixa um run no store cujo alvo nunca ligou. No boot seguinte esse
caminho o trata como concluído, criando histórico e dedução falsos — justamente
o que o gate `history_actuated`/`_active_actuated` evita nos demais caminhos.

**Sugestão:** no downtime, só registrar/deduzir quando houver evidência de
atuação; sem ela, apenas remover o store (sem histórico nem dedução). O store
não carrega essa evidência hoje, então a opção mais simples é **não** registrar
nem deduzir no downtime (dado que não há como confirmar que chegou a regar).

## Baixos confirmados

- `config_flow.py` options flow trunca durações subminuto (`// 60`) — perde
  segundos ao salvar opções.
- `store.py` `async_load_history` poda em memória sem persistir a poda
  (cosmético).
- `smoke.mjs` tem uma checagem de "day chips" que sempre imprime `false`
  (espera rótulos por extenso, a UI usa iniciais).

## Falsos positivos / itens corretos

- Política `confirmed_off_states`, flag `_active_actuated`, tratamento
  `nan`/`inf` no gate de pH, revert de estado em falha de `async_save_entry`,
  listener decidindo por estado atual, normalização `as_utc` de `started_at`/
  `finishes_at` — todos verificados corretos no código.
- `refill_reservoir` e `_deduct_reservoir_volume` estão cobertos por
  `test_reservoir.py`.

## Conclusão

Todos os 6 achados da rodada anterior foram corrigidos, incluindo a
normalização completa de `started_at` naive. Restam dois médios novos: o
desregistro ausente de `refill_reservoir` (simples) e a dedução de reservatório/
histórico sem evidência de atuação no downtime (inconsistência com a política
do resto do código). Ambos sem risco físico. **PRECISA DE ALTERAÇÃO.**
