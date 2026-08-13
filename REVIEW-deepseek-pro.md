# REVIEW-deepseek-pro.md — Auditoria (deepseek-v4-pro)

**Revisor:** deepseek-v4-pro (DeepSeek API) · **Status: APROVADO**

Auditoria do estado atual de `watergaia`. Não alterei código de produção nem
testes. Números executados por mim.

## Testes executados

| Suite | Resultado |
|---|---|
| Backend completo (HA 2026.2.3 + PHCC) | **164 passed** |
| Backend puro | **35 passed** |
| Frontend typecheck / vitest | **0 erros** / **153 passed** |
| `compileall custom_components` | **0 erros** |

## Achado da rodada anterior — corrigido

**Editor visual** (`frontend-src/src/editor.ts:71-85`): `_valueChanged` agora lê
`ev.detail.value` (a config completa que o `ha-form` emite) em vez de
`ev.detail.name`. O `config-changed` volta a disparar e as edições visuais são
salvas. Confirmado no fonte e no teste de regressão (`editor.test.ts`).

## Achados desta rodada (apenas BAIXO, sem risco físico)

1. **BAIXO** — `scheduler.py:1102-1170`: se uma rega nova começa exatamente
   durante o backoff de 1 s do `turn_off`, o `return` abandona o registro do
   histórico da rega que acabou (informacional; janela de 1-2 s).

2. **BAIXO** — `scheduler.py:1614-1622`: parada externa dentro do
   `ACTUATION_GRACE` é ignorada pelo listener (correto para eco atrasado), mas
   o run pode ser contabilizado com duração/volume completos se o alvo já tinha
   atuado.

3. **BAIXO** — `scheduler.py:577-588`: detecção de desligamento externo só via
   evento de mudança de estado, sem varredura no boot de alvo já atuado.

4. **INFO** — validação de pH no cliente mais fraca que no backend; comentário
   ambíguo sobre a linha R2 no `card.ts`; asserção morta no `smoke.mjs`.

## Pontos verificados como corretos

- Núcleo de segurança: timer imediato pós-`turn_on`, grace de atuação,
  `_run_id`, retry com confirmação, `confirmed_off_states`, preservação do
  store quando o off não é confirmado.
- Gate de pH/EC com `math.isfinite`; `_active_actuated`; normalização `as_utc`
  de `started_at`/`finishes_at`; revert em falha de `async_save_entry`.
- `refill_reservoir` (com unregister correto) e `_deduct_reservoir_volume`
  (dedução só após atuação confirmada).
- Editor implementa `setConfig` e agora emite `config-changed` corretamente.

## Conclusão

Todos os achados das rodadas anteriores foram corrigidos, incluindo o editor
visual. Restam apenas itens de baixa prioridade (histórico/contagem em janelas
de corrida muito estreitas e cosméticos), sem impacto na segurança da rega nem
no backend. **APROVADO.**
