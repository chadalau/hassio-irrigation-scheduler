# REVIEW-deepseek-pro.md — Revisão adversarial independente (deepseek-v4-pro)

**Revisor:** deepseek-v4-pro (DeepSeek API) · **Status: PRECISA DE ALTERAÇÃO**

Revisão independente do estado atual de `watergaia`. Não alterei código de
produção nem testes. Os números abaixo foram executados por mim.

## Testes executados

| Suite | Comando | Resultado |
|---|---|---|
| Backend completo (HA 2026.2.3 + PHCC) | `pytest tests -q` | **121 passed** |
| Backend puro | `pytest tests/test_next_run.py tests/test_schedules.py -q` | **28 passed** |
| Frontend | `npm run typecheck` / `npm run test` | **0 erros** / **107 passed** |
| Sintaxe | `py -m compileall -q custom_components` | **0 erros** |

## Achados (análise própria, confirmada lendo o código)

### MÉDIO — Parada externa do alvo não é registrada no histórico

**Arquivo:** `scheduler.py`, `_async_target_state_changed` (1317) e
`_async_finish_run` (930).

Quando o alvo é desligado externamente (fora do card/automação), o listener
chama `_async_finish_run(turn_off=False, ...)`. Dentro dele,
`history_actuated = self._async_target_is_actuated()` é avaliado no instante do
fim — mas nesse caminho o alvo **já está desligado**, então
`history_actuated=False` e o registro NÃO é gravado.

O resultado é que uma rega que **realmente entregou água** (ligou, regou por um
tempo e foi desligada externamente) some do histórico. O check atual não
consegue distinguir "nunca atuou" de "atuou e depois foi desligado
externamente". É um falso-negativo da feature de histórico.

**Sugestão:** rastrear "atuou em algum momento" como flag de estado (setada
assim que o alvo sai de off, ou capturada do próprio run), em vez de avaliar o
estado apenas no fim.

### MÉDIO — Falha de I/O no `async_save_entry` deixa a zona presa em "Regando"

**Arquivo:** `scheduler.py`, `_async_start_run` (793).

`await self.store.async_save_entry(...)` ocorre após `self._is_watering = True`
(780) e **antes** de armar o timer de parada (865) e do `turn_on` (812). Se a
gravação lançar exceção (disco/Store), a exceção propaga para fora de
`_async_start_run` sem `try/except`. O estado em memória fica `_is_watering=True`
sem timer e sem nunca ligar o alvo.

Consequência: o alvo permanece **desligado** (não há risco físico), mas a zona
fica presa exibindo "Regando", e o próximo disparo agendado é pulado (vê
`_is_watering=True`). A exceção aparece como "Task exception was never
retrieved" no callback do timer.

**Sugestão:** envolver a gravação em `try/except` e reverter o estado
(`_is_watering=False` etc.) em caso de falha, ou gravar o estado do run de
forma não-bloqueante/recuperável, sem deixar a zona em estado incoerente.

### BAIXO — Run retomado após restart não restaura snapshot de pH/EC

**Arquivo:** `scheduler.py`, `_async_recover_state` (1474-1482).

No resume (finishes_at futuro), o código restaura `source`, `schedule_id` e
`duration`, mas **não** restaura `_active_ph_value`/`_active_ec_value`/unidade
(e contrapartes R2) que estão gravadas no store. Quando essa rega termina, o
`_async_finish_run` captura esses campos como `None` e o histórico grava `null`,
mesmo tendo os valores persistidos.

**Sugestão:** restaurar também `ph_value`/`ec_value`/`ec_unit` (e R2) do
`run_state` no caminho de resume.

### BAIXO — Atributo de estado `history` pode ficar grande

**Arquivo:** `binary_sensor.py`, `extra_state_attributes` (65).

`history` é exposto integralmente como atributo de estado (até
`HISTORY_MAX_ENTRIES` registros). Com o limite alto, são dezenas de KB
serializados e escritos no state machine a cada `async_write_ha_state()`. Não
é bug de correção, mas escala mal e polui o estado.

**Sugestão:** limitar o atributo exposto (ex.: últimos N=5) e expor o histórico
completo por serviço, ou reduzir o limite default.

### BAIXO — Recovery de run não-atuado remove store sem confirmação de off

**Arquivo:** `scheduler.py`, `_async_recover_state` (1511-1513).

O caminho "resumido mas não atuado" chama
`_async_finish_run(turn_off=False, remove_state=True, log_history=False)`.
Se o alvo estiver `unavailable` (o `turn_off` defensivo falha), o store é
removido mesmo sem confirmação de `off`. É coerente com o alvo já estar off,
mas difere do rigor de `_async_abort_run`, que preserva o store quando o off
não é confirmado.

**Sugestão:** usar a mesma política de confirmação de off antes de remover o
registro, por consistência.

### BAIXO — `_prune_history`/recovery assumem `started_at` aware

**Arquivo:** `store.py` (52) e `scheduler.py` (1432-1444).

`started_at < cutoff` compara um datetime parseado com `dt_util.utcnow()`. Se o
store for corrompido com um `started_at` naive (sem timezone), a comparação
levanta `TypeError`. Só ocorre com store adulterado; baixo impacto, mas
desejável normalizar/assumir UTC.

## Falsos positivos / pontos verificados como corretos

- **`nan` no gate de pH:** corrigido com `math.isfinite` (1267); `nan`/`inf`
  agora bloqueiam corretamente. ✓
- **`_async_schedule_fired` com `try/finally`:** `_reschedule_next()` sempre
  executa, fechando a lacuna que matava a cadeia de agendamento. ✓
- **Recovery com `duration` corrompida:** `_coerce_stored_duration` +
  timer de parada armado contra `finishes_at` (não `duration`); setup não
  derruba mais. ✓
- **Inversão parcial da faixa de pH:** validação considera R1/R2 com
  `_check_ph_range` por reservatório; não reproduzi a inversão parcial relatada
  anteriormente. ✓
- **Timer de parada armado imediatamente + grace de atuação + token `_run_id` +
  retry de turn_off + preservação do store:** núcleo de segurança sólido. ✓
- **`_async_abort_run` preserva store sem confirmação de off:** correto. ✓

## Conclusão

O núcleo de segurança da válvula e as correções das rodadas anteriores estão
corretos. Restam o falso-negativo do histórico em parada externa (MÉDIO), o
estado preso em falha de I/O do store (MÉDIO) e quatro itens baixos de
robustez/escopo. Nenhum deles representa risco físico, mas os dois médios
comprometem a feature central desta rodada (histórico) e a consistência de
estado. **PRECISA DE ALTERAÇÃO.**
