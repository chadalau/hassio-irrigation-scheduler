# REVIEW-qwen37.md — Auditoria Adversarial Independente

**Data**: 2026-08-13  
**Escopo**: Working tree completo (backend, frontend, testes)  
**Modelo**: qwen3.7-max  
**Status final**: **APROVADO**

---

## Arquivos Revisados

### Backend (`custom_components/irrigation_scheduler/`)
| Arquivo | Linhas |
|---|---|
| `__init__.py` | 507 |
| `scheduler.py` | 2060 |
| `store.py` | 183 |
| `next_run.py` | 205 |
| `schedules.py` | 65 |
| `config_flow.py` | 467 |
| `const.py` | 126 |
| `sensor.py` | 160 |
| `switch.py` | 73 |
| `binary_sensor.py` | 81 |

### Frontend (`frontend-src/src/`)
| Arquivo | Linhas |
|---|---|
| `card.ts` | 1682 |
| `editor.ts` | 86 |
| `utils.ts` | 572 |
| `types.ts` | 143 |
| `styles.ts` | 720 |
| `const.ts` | 9 |

### Testes
| Arquivo | Linhas |
|---|---|
| `tests/test_next_run.py` | 250 |
| `tests/test_schedules.py` | 126 |
| `tests/pure_loader.py` | 32 |
| `frontend-src/tests/editor.test.ts` | 143 |
| `frontend-src/tests/card.test.ts` | 1302 |
| `frontend-src/tests/utils.test.ts` | 728 |

---

## Verificação do Achado da Rodada Anterior

### Editor visual: `_valueChanged` lendo `ev.detail.value` (CORRIGIDO)

**Arquivo**: `frontend-src/src/editor.ts:71-85`

O código atual lê corretamente `ev.detail.value` (a config completa emitida pelo `ha-form`):

```typescript
private _valueChanged(ev: CustomEvent): void {
    const value = (ev.detail as { value?: Record<string, unknown> } | undefined)
      ?.value;
    if (!value || !this._config) { return; }
    const config = { ...this._config, ...value } as CardConfig;
    this.dispatchEvent(new CustomEvent("config-changed", { ... }));
}
```

O comentário nas linhas 63-69 documenta explicitamente a correção. O teste de regressão em `editor.test.ts:66-112` dispara um evento `value-changed` com `{ detail: { value: { entity: ..., compact: true } } }` e verifica que `config-changed` é disparado com a config mergeada corretamente. **Teste passa.**

---

## Achados por Severidade

### CRÍTICO — Nenhum

### ALTO — Nenhum

### MÉDIO — Nenhum

### BAIXO (observações, não bugs)

#### 1. Duplo dispatch em `_deduct_reservoir_volume` → `async_options_updated`
- **Arquivo**: `scheduler.py:757-771` + `scheduler.py:1198-1199`
- **Cenário**: `_deduct_reservoir_volume` atualiza `entry.options`, o que dispara o update listener → `async_options_updated()` → `_reschedule_next()` + `_async_dispatch_update()`. Imediatamente depois, `_async_finish_run` chama os mesmos métodos novamente nas linhas 1198-1199.
- **Impacto**: Operações idempotentes; sem efeito funcional. Custo desprezível (um cancel+rearm de timer e um dispatcher_send extra).
- **Classificação**: Ineficiência cosmética, não bug.

#### 2. `_suppress_state_listener = True` redundante na linha 974
- **Arquivo**: `scheduler.py:974`
- **Cenário**: No caminho de abort do turn_on failure, `_suppress_state_listener` já está `True` (setado na linha 958). A reatribuição na linha 974 é redundante.
- **Impacto**: Nenhum. O `finally` da linha 982 e o `finally` externo da linha 992 garantem cleanup correto.
- **Classificação**: Redundância inofensiva.

---

## Falsos Positivos Percebidos

| # | Descrição | Por que não é bug |
|---|---|---|
| 1 | `_async_register_services` chamado em `async_setup` E `async_setup_entry` | Guard `has_service` na linha 336 torna idempotente |
| 2 | `setdefault("store", RuntimeStore(hass))` com entries concorrentes | `setdefault` é atômico sob GIL; uma única instância é criada |
| 3 | `_stringAttr` retorna `undefined` para string vazia `""` | Callers fazem `?? ""` convertendo de volta; `""` significa "não configurado" |
| 4 | `_async_finish_run` com `turn_off=False` no stop externo | O target já está confirmed-off; enviar turn_off seria desnecessário |
| 5 | `_openAdd` seta `_formTime` para `"00:00"` (meia-noite) | Meia-noite é um horário válido; backend aceita |
| 6 | `_callService` mira o sensor entity, não o switch/target | Backend resolve sensor → config_entry → scheduler via `_async_resolve_schedulers` |
| 7 | Grace period = 0 quando `_active_duration` é None | `_active_duration` é sempre setado antes de grace ser consultado; o `else 0` é defensivo |

---

## Testes Executados

| Suite | Comando | Resultado |
|---|---|---|
| Backend puro | `python -m pytest tests/test_next_run.py tests/test_schedules.py -q` | **35 passed** (0.03s) |
| Backend HA | `python -m pytest tests -q` | **164 passed** (14.64s) |
| Frontend typecheck | `npm run typecheck` | **OK** (tsc --noEmit sem erros) |
| Frontend testes | `npm run test` | **153 passed** (3 test files, 792ms) |
| Frontend build | `npm run build` | **OK** (rollup criou irrigation-schedule-card.js em 842ms) |

**Total: 352 testes, 0 falhas.**

---

## Análise de Segurança e Robustez

### Pontos fortes verificados
- **Run generation token** (`_run_id`): previne re-entrância e callbacks stale em todo o lifecycle
- **pH gate fail-safe**: sensor ausente/indisponível/inválido/NaN bloqueia a rega (nunca rega às cegas)
- **Store lock**: `asyncio.Lock` único protege read-modify-write de todas as zonas concorrentes
- **`async_update_entry` atômico**: previne race entre `_async_store_mark_actuated` e `_async_store_mark_history_logged`
- **Restart recovery**: distingue run que realmente regou (`actuated=True`) de run que crashou antes do turn_on
- **`history_logged`**: previne double-logging e double-deduction no recovery
- **DST policy**: spring-forward gap skip + fall-back fold=0 documentados e testados
- **Malformed days**: degrade gracefully (TypeError-free) via `isinstance(days, (list, tuple))`
- **Frontend entity contract**: card valida `switch_entity_id`/`binary_sensor_entity_id` antes de renderizar
- **Backend error surfacing**: dialog/settings mantêm painel aberto e mostram erro do backend
- **Editor `config-changed`**: corrigido e coberto por teste de regressão

### Cobertura de testes adversariais
- Malformed days (string, int, None, dict, float) → degrade gracefully
- DST spring-forward/fall-back
- Schedule id immutability through create→update
- Backend error propagation to frontend (dialog stays open)
- Entity contract validation (foreign sensor rejected)
- pH gate cross-field validation (min > max blocked)
- R2 independent reservoir fields
- Reservoir volume/estimate/refill UI

---

## Sugestões (não bloqueantes)

1. **Considerar extrair a constante `grace` para um método helper** — a expressão `min(ACTUATION_GRACE, self._active_duration) if self._active_duration is not None else 0` aparece em dois lugares (scheduler.py:1005 e 1614-1618). Um helper `_current_grace()` eliminaria a duplicação.

2. **Considerar log level `DEBUG` para o duplo dispatch** — se o duplo `_reschedule_next()`/`_async_dispatch_update()` via `_deduct_reservoir_volume` → options listener se tornar mensurável em perfis de uso intenso, um flag `_in_finish_run` poderia suprimir o dispatch redundante.

---

## Status Final

### **APROVADO**

O achado da rodada anterior (editor visual `_valueChanged` lendo `ev.detail.name` em vez de `ev.detail.value`) foi **corrigido corretamente** e está coberto por teste de regressão. Nenhum achado crítico, alto ou médio foi identificado. O código apresenta defesa em profundidade consistente, com comentários explicando o racional de cada decisão de design. Todos os 352 testes passam.
