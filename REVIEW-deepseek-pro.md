# REVIEW-deepseek-pro.md — Reverificação (deepseek-v4-pro)

**Revisor:** deepseek-v4-pro (DeepSeek API) · **Status: PRECISA DE ALTERAÇÃO (1 item incompleto + 1 achado novo)**

Reverificação do estado atual de `watergaia` após a rodada de correções. Não
alterei código de produção nem testes. Números executados por mim.

## Testes executados

| Suite | Resultado |
|---|---|
| Backend completo (HA 2026.2.3 + PHCC) | **127 passed** |
| Backend puro | **28 passed** |
| Frontend typecheck / vitest | **0 erros** / **110 passed** |
| `compileall custom_components` | **0 erros** |

## Verificação dos achados anteriores

| # | Achado | Veredito |
|---|---|---|
| 1 | Parada externa some do histórico | ✅ **CORRIGIDO** — flag `_active_actuated` (linhas 180/809/991/1154/1194/1388/1587) + `history_actuated = self._active_actuated or self._async_target_is_actuated()` (979) |
| 2 | Zona presa em "Regando" em falha de I/O no store | ✅ **CORRIGIDO** — `try/except` em `async_save_entry` com revert do estado (811-853) |
| 3 | Snapshot pH/EC não restaurado no resume | ✅ **CORRIGIDO** — restauração explícita (1551-1556) |
| 4 | Atributo `history` grande | ✅ **CORRIGIDO** — `_prune_history` com cap de idade/entradas em load e append |
| 5 | Recovery removendo store sem confirmação | ✅ **CORRIGIDO** — `turn_off=True` no resume (1583) + `confirmed_off_states` |
| 6 | `started_at` naive em store corrompido | ⚠️ **INCOMPLETO** — ver abaixo |

## Achado 6 incompleto — `started_at` naive ainda pode quebrar o setup

**Arquivo:** `scheduler.py`.

`finishes_at` foi normalizado com `dt_util.as_utc(finishes_at)` (1469), mas
`started_at` **não**. Dois caminhos ainda podem lançar `TypeError` com um store
contendo `started_at` naive:

1. **Downtime (fim durante parada):** `recovered_started_at` (1496-1498) é
   passado direto para `_async_log_history`, cujo cálculo
   `duration = max(0, int((finished_at - started_at).total_seconds()))` (1109)
   fica **fora** do `try/except` (que só envolve `async_append_history`, 1125).
   `aware - naive` → `TypeError` propagando até `async_setup` → "Error setting
   up entry".

2. **Resume:** `_coerce_stored_duration` (1614) faz
   `finishes_at - fallback_start`; se `fallback_start` for o `started_at` naive
   (com `duration` inválido no store), também levanta `TypeError`.

É robustez defensiva (só ocorre com store adulterado), mas é exatamente o que o
achado 6 pedia; a correção tratou só `finishes_at`.

**Sugestão:** normalizar `started_at` com `dt_util.as_utc` logo após o parse
(nos dois caminhos), ou envolver o cálculo de `duration` de `_async_log_history`
em `try/except`.

## Achado novo — evento externo `unavailable`/`unknown` remove store sem confirmação

**Arquivo:** `scheduler.py`, `_async_target_state_changed` (1369-1414).

O listener decide por `current.state not in off_states(...)` (1381), e
`off_states` inclui `unavailable`/`unknown`. Quando o alvo vira `unavailable`
(ou `unknown`) durante a rega, o código cai no caminho de "parada externa" e
chama `_async_finish_run(turn_off=False, remove_state=True)` (1412-1414):

- `turn_off=False` → **nenhum** desligamento é tentado.
- `remove_state=True` → o store é **removido sem confirmação** de off.

Um `unavailable` é, por definição, "parou de reportar", não "fechou". Se a
válvula física continuar aberta e voltar a reportar depois, não sobra timer nem
registro de recovery. Isso contraria a política `confirmed_off_states` recém
aplicada aos demais caminhos (abort/finish/grace), que preservam o store quando
o off não é confirmado.

**Sugestão:** no listener, quando o estado atual for `unavailable`/`unknown`
(não confirmado off), não remover o store e tentar desligamento defensivo —
consistente com `_async_abort_run`/`_async_finish_run`.

## Falsos positivos / itens confirmados

- `nan` no gate de pH com `math.isfinite` — correto.
- `_async_schedule_fired` com `try/finally` — `_reschedule_next` sempre executa.
- Núcleo de segurança (timer imediato, grace, `_run_id`, retry, `confirmed_off_states`) — correto.
- Restauração de pH/EC, `_active_actuated` para histórico de parada externa, e
  cap/prune do histórico — corretos e testados.

## Conclusão

5 dos 6 achados foram integralmente corrigidos. O item 6 (`started_at` naive)
está corrigido pela metade e ainda pode derrubar o setup em store adulterado
(downtime) ou no resume. Além disso, o listener de estado trata
`unavailable`/`unknown` como off confirmado, removendo o store sem desligamento
defensivo — uma inconsistência com a política nova. Nenhum é risco imediato em
uso normal, mas ambos ferem o rigor defensivo do restante do código.

**PRECISA DE ALTERAÇÃO.**
