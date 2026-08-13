# REVIEW-deepseek-pro.md — Revisão completa final (deepseek-v4-pro)

**Revisor:** deepseek-v4-pro (DeepSeek API) · **Status: PRECISA DE ALTERAÇÃO**

Revisão completa final de `watergaia` (código encerrado pelo usuário). Não
alterei código de produção nem testes. Números executados por mim.

## Testes executados

| Suite | Resultado |
|---|---|
| Backend completo (HA 2026.2.3 + PHCC) | **141 passed** |
| Backend puro | **28 passed** |
| Frontend typecheck / vitest | **0 erros** / **135 passed** |
| `compileall custom_components` | **0 erros** |

## Achados da rodada anterior — status

| # | Achado | Veredito |
|---|---|---|
| 1 | `SERVICE_REFILL_RESERVOIR` ausente no unregister | ✅ **CORRIGIDO** — incluído em `_async_unregister_services` (`__init__.py:456`) e em `ALL_SERVICES` |
| 2 | Downtime recovery registrando/deduzindo sem evidência de atuação | ✅ **CORRIGIDO** — gate `run_state.get("actuated")` + `not run_state.get("history_logged")` (`scheduler.py:1672`) |

## Achado confirmado nesta rodada

### MÉDIO — Editor visual do card não salva alterações (`config-changed` nunca dispara)

**Arquivo:** `frontend-src/src/editor.ts`, `_valueChanged` (63-77).

O handler lê `ev.detail.name` e `ev.detail.value` como se o evento viesse de um
seletor individual. Porém o `ha-form` do Home Assistant emite `value-changed`
com `detail = { value: <objeto completo da config> }` (o `ha-form` já consolida
os campos internos e reemite um único evento com todo o `_data`). Como
`detail.name` é `undefined`, o guard `if (!name ...) return` encerra a função e
o evento `config-changed` **nunca é despachado**.

Consequência: ao editar o card pelo editor visual, nenhuma alteração é salva
(só funciona via YAML). O `setConfig` (41) está correto — é o handler de
mudança que está errado. Não há teste cobrindo o dispatch de `config-changed`
(`editor.test.ts` só verifica `setConfig` e a presença de `ha-form`).

**Sugestão:** tratar `ev.detail.value` como a config completa:
```ts
private _valueChanged(ev: CustomEvent): void {
  const value = ev.detail?.value;
  if (!value || !this._config) return;
  this.dispatchEvent(new CustomEvent("config-changed", {
    detail: { config: { ...this._config, ...(value as object) } },
    bubbles: true, composed: true,
  }));
}
```
E adicionar teste que simule o evento do `ha-form` e asserção de
`config-changed` com a config mesclada.

## Baixos confirmados

- `schedules` filtra `duration` corrompida mas não `days`; um `days` com
  string/int/None chega a `find_next_run` e pode levantar `TypeError`
  (`next_run.py` itera `weekday in schedule.get("days", [])`).
- Registro antigo de histórico sem `ph_value` renderiza "· ? PH" no card.
- `smoke.mjs` ainda tem checagem desatualizada de "day chips".

## Falsos positivos / itens corretos

- Núcleo de segurança (timer imediato, grace, `_run_id`, retry,
  `confirmed_off_states`) — correto.
- Gate de pH com `math.isfinite`; `_active_actuated`; normalização `as_utc` de
  `started_at`/`finishes_at`; revert em falha de `async_save_entry` — corretos.
- `refill_reservoir` / `_deduct_reservoir_volume` cobertos por `test_reservoir.py`.
- Editor implementa `setConfig` (contrato do Lovelace) — correto.

## Conclusão

Os dois achados da rodada anterior estão corrigidos e testados. Resta um bug
funcional real no editor visual (MÉDIO): o handler de `value-changed` usa a
forma de evento errada, então edições visuais não são salvas. Não afeta a
segurança física nem o backend, mas torna o editor visual inoperante. Os demais
são baixos de robustez/cosmética. **PRECISA DE ALTERAÇÃO.**
