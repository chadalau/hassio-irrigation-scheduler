# REVIEW-qwen37.md — Revisão Adversarial Final (qwen3.7-max)

**Data**: 2026-08-12  
**Revisor**: qwen3.7-max (independente, sem comparação com outros reviewers)  
**Escopo**: Backend completo, frontend completo, testes (puros + integração + frontend)  
**Estado do working tree**: Código encerrado pelo usuário; incluindo alterações não commitadas  

---

## Arquivos Revisados

### Backend (`custom_components/irrigation_scheduler/`)
| Arquivo | Linhas | Descrição |
|---|---|---|
| `__init__.py` | 507 | Setup/teardown, serviços, frontend wiring, target resolution |
| `const.py` | 121 | Constantes (domínios, defaults, services, plataformas) |
| `scheduler.py` | 1871 | Core engine: lifecycle, pH gate, recovery, history, reservoir |
| `schedules.py` | 65 | Pure helpers: serialize, new, merge (zero HA imports) |
| `next_run.py` | 198 | Pure helpers: find_next_run, resolve_target_services, off_states |
| `store.py` | 156 | RuntimeStore: lock-protected persistence, history pruning |
| `sensor.py` | 160 | Next-run sensor + attribute contract + sibling resolution |
| `binary_sensor.py` | 81 | Watering binary sensor (running device class) |
| `switch.py` | 73 | Schedule-enabled switch |
| `config_flow.py` | 467 | Config flow + options flow (R1+R2 pH/EC) |
| `manifest.json` | 17 | Manifest (HA 2026.2.3, frontend+http deps) |
| `services.yaml` | 263 | Service definitions (8 services) |
| `strings.json` | 223 | UI strings (config, options, entities, services) |

### Frontend (`frontend-src/src/`)
| Arquivo | Linhas | Descrição |
|---|---|---|
| `card.ts` | 1653 | Lit card: render, settings, dialog, history, actions |
| `const.ts` | 9 | Domain + defaults |
| `editor.ts` | 78 | Lovelace visual editor (ha-form) |
| `styles.ts` | 707 | CSS (grid, badges, dialogs, compact mode) |
| `types.ts` | 143 | TypeScript interfaces (Schedule, HistoryRun, CardConfig, etc.) |
| `utils.ts` | 465 | Pure helpers: format, sanitize, volume, history grouping |

### Testes
| Arquivo | Testes | Descrição |
|---|---|---|
| `tests/test_next_run.py` | 18 | Pure: compute_next_run, find_next_run, DST, services |
| `tests/test_schedules.py` | 10 | Pure: serialize, new, merge, id stability |
| `tests/integration/test_init.py` | 7 | Entry setup/teardown, attribute contract, corrupt options |
| `tests/integration/test_services.py` | 13 | Targeted services, device/area targeting, validation |
| `tests/integration/test_config_flow.py` | 3 | Config + options flow, no-reload guarantee |
| `tests/integration/test_recovery.py` | 9 | Restart recovery, defensive turn-off, double-log prevention |
| `tests/integration/test_async_device.py` | 5 | Async device: stale echo, grace window, safety net |
| `tests/integration/test_ph_gate.py` | 9 | pH gate R1: range, fail-safe, warnings |
| `tests/integration/test_ph_gate_r2.py` | 8 | pH gate R2: independent reservoir, cross-reservoir warnings |
| `tests/integration/test_history.py` | 8 | History logging, pH/EC snapshot, cap, downtime recovery |
| `tests/integration/test_reservoir.py` | 8 | Reservoir tracking, deduction, refill, zero-pots fallback |
| `tests/integration/test_frontend.py` | 4 | Static path, extra JS URL, missing-card resilience |
| `tests/integration/test_review_fixes.py` | 7 | Regression pins for round-1 findings |
| `tests/integration/test_review_fixes_2.py` | 9 | Regression pins for round-2 findings |
| `frontend-src/tests/card.test.ts` | 50 | Card rendering, settings, badges, R2, history, error surfacing |
| `frontend-src/tests/editor.test.ts` | 3 | Editor setConfig, ha-form rendering |
| `frontend-src/tests/utils.test.ts` | 82 | All pure utils: format, sanitize, volume, history grouping |

---

## Testes Executados

| Suite | Comando | Resultado |
|---|---|---|
| Backend puro | `python -m pytest tests/test_next_run.py tests/test_schedules.py -q` | **28 passed** (0.02s) |
| Backend HA | `python -m pytest tests -q` | **141 passed** (14.33s) |
| Frontend typecheck | `npm run typecheck` | **OK** (zero errors) |
| Frontend test | `npm run test` | **135 passed** (3 test files, 735ms) |
| Frontend build | `npm run build` | **OK** (rollup, 823ms) |

**Total: 304 testes, todos passando.**

---

## Verificação dos Achados da Rodada Anterior

### (1) `SERVICE_REFILL_RESERVOIR` ausente no unregister
- **Status**: ✅ **CORRIGIDO**
- **Evidência**: `__init__.py:457` — `SERVICE_REFILL_RESERVOIR` está presente na tupla de `_async_unregister_services`. O teste `test_unload_removes_entities_and_services_only_with_last_entry` (test_init.py:122) valida que todos os 8 serviços (incluindo refill_reservoir) são removidos quando o último entry é descarregado.

### (2) Downtime recovery registrando/deduzindo sem evidência de atuação
- **Status**: ✅ **CORRIGIDO**
- **Evidência**: `scheduler.py:1672` — A condição `run_state.get("actuated") and not run_state.get("history_logged")` exige EVIDÊNCIA persistida de atuação antes de logar/deduzir. O teste `test_downtime_recovery_does_not_log_run_with_no_actuation_evidence` (test_recovery.py:627) valida que um store record sem `actuated` NÃO gera phantom history entry nem dedução de reservatório.

---

## Achados por Severidade

### 🔴 CRÍTICO — Nenhum

### 🟠 ALTA — Nenhum

### 🟡 MÉDIA — Nenhum

### 🔵 BAIXA

#### B1. `_async_registry_updated` aceita action "update" desnecessariamente
- **Arquivo**: `sensor.py:123`
- **Cenário**: O callback `_async_registry_updated` filtra `action == "remove"` mas aceita tanto "create" quanto "update". Um evento "update" de uma entidade do mesmo entry dispara uma re-resolução desnecessária (os sibling entity_ids já foram resolvidos e cacheados; `_entities_resolved` é True e o método retorna imediatamente na linha 146-147).
- **Impacto**: Zero impacto funcional. Custo de uma chamada extra ao entity registry por update event, imediatamente short-circuitada. Puramente cosmético.
- **Sugestão**: Adicionar `if event.data.get("action") not in ("create", "update"): return` ou simplesmente filtrar apenas "create" se a re-resolução só faz sentido para novas entidades. Não é urgente.

#### B2. `_async_store_mark_actuated` e `_async_store_mark_history_logged` fazem load+save separados
- **Arquivo**: `scheduler.py:1192-1215`
- **Cenário**: Cada método faz `async_load()` + `async_save_entry()` sob o lock do RuntimeStore (duas operações I/O completas). Em teoria, um único ciclo load-modify-save seria mais eficiente.
- **Impacto**: Performance mínima. O lock serializa corretamente e as operações são raras (uma vez por run). Em um cenário de múltiplas zonas finalizando simultaneamente, o overhead é de milissegundos.
- **Sugestão**: Poderia ser unificado em um único `async_update_entry_fields(entry_id, **fields)` no RuntimeStore. Não é urgente.

### ⚪ INFORMACIONAL

#### I1. `_check_ph_range` usa `math.isfinite()` que cobre NaN e Inf simultaneamente
- **Arquivo**: `scheduler.py:1470`
- **Nota**: Correto por design. `float("nan")`, `float("inf")` e `float("-inf")` são todos rejeitados. Testado em `test_scheduled_run_skipped_when_ph_sensor_unusable` com parametrização incluindo "nan", "NaN", "-nan", "inf", "-inf".

#### I2. `_async_abort_run` não chama `_async_log_history`
- **Arquivo**: `scheduler.py:1287-1321`
- **Nota**: Correto por design. Um run abortado nunca entregou água; logá-lo como "completed" seria um phantom entry. O gate `history_actuated` em `_async_finish_run` e a ausência de logging em `_async_abort_run` são consistentes.

#### I3. `_async_recover_state` (resume path) não restaura `_active_actuated` do store
- **Arquivo**: `scheduler.py:1728-1784`
- **Nota**: Correto por design. Na linha 1778, se o target está actuated no momento do resume, `_active_actuated = True` é setado explicitamente. Se não está, o run é abortado com `log_history=False`. O campo `actuated` no store só é consultado no path downtime-expired (linha 1672).

#### I4. Frontend `_stringAttr` retorna `undefined` para string vazia
- **Arquivo**: `card.ts:1255-1261`
- **Nota**: Correto por design. `typeof value === "string" && value` rejeita strings vazias, retornando `undefined`. Callers usam `?? ""` para o fallback apropriado. Consistente com o backend onde `""` significa "não configurado".

#### I5. `confirmed_off_states` não é exportado em `__init__.py`
- **Arquivo**: `next_run.py:186-198`
- **Nota**: `confirmed_off_states` é importado diretamente por `scheduler.py` via `from .next_run import confirmed_off_states`. Não precisa estar no `__init__.py` pois não é consumido externamente.

---

## Falsos Positivos Percebidos

Durante a revisão, os seguintes padrões poderiam parecer problemas à primeira vista, mas são corretos após análise detalhada:

1. **`_suppress_state_listener` setado duas vezes no abort path** (`scheduler.py:961`): Parece redundante com a linha 945, mas é necessário: o `finally` da linha 972-973 limpa a flag do primeiro set, e o segundo set (linha 961) protege o defensive turn_off que ocorre DENTRO do except block.

2. **`_run_id` incrementado tanto no start quanto no finish** (`scheduler.py:877, 1043`): Parece excessivo, mas é essencial: o token de geração deve invalidar callbacks de AMBAS as direções — um stale finish não pode afetar um novo start, e um stale start não pode afetar um finish em andamento.

3. **Volume badge repetido em ambas as linhas R1/R2** (`card.ts:393-407`): Parece duplicação, mas é intencional — quando ambos os reservatórios são exibidos, o grid de 6 colunas precisa que cada linha tenha seus próprios badges de volume/estimate/refill para alinhamento visual correto.

4. **`_async_finish_run` captura `history_actuated` ANTES de limpar o estado** (`scheduler.py:1069`): Parece que poderia ler stale data, mas é correto — a flag sticky `_active_actuated` é lida antes de ser resetada na linha 1081, e `_async_target_is_actuated()` é chamada antes do turn_off (que só acontece na linha 1083+).

5. **`_async_target_state_changed` ignora eventos durante a grace window** (`scheduler.py:1562-1570`): Parece que poderia perder um stop legítimo, mas é correto — o deferred actuation check (que roda ao final da grace) é o árbitro definitivo da saúde do run durante essa janela.

---

## Sugestões (Não Bloqueantes)

1. **Consolidação de store operations**: Um método `async_patch_entry(entry_id, **fields)` no RuntimeStore que faça load-modify-save em uma única operação sob lock eliminaria a duplicação em `_async_store_mark_actuated` e `_async_store_mark_history_logged`.

2. **TypeScript strict mode**: O `tsconfig.json` do frontend-src poderia habilitar `strict: true` para maior segurança de tipos. Atualmente o typecheck passa, mas strict mode capturaria potenciais null accesses em cenários não testados.

3. **Tradução pt-BR do card**: O card hardcode strings em português (dayLabels, dialogs, errors). Se internacionalização for desejada no futuro, extrair para um dicionário locale-aware seria o caminho. Atualmente é consistente e documentado como decisão deliberada.

---

## Comandos Executados

```powershell
# Backend puro (venv sem HA)
& "$env:TEMP\opencode\irr-venv\Scripts\python.exe" -m pytest tests/test_next_run.py tests/test_schedules.py -q
# Resultado: 28 passed in 0.02s

# Backend HA (venv com pytest-homeassistant-custom-component)
& "$env:TEMP\opencode\ha-venv\Scripts\python.exe" -m pytest tests -q
# Resultado: 141 passed in 14.33s

# Frontend
cd frontend-src
npm run typecheck   # OK (zero errors)
npm run test        # 135 passed (3 test files, 735ms)
npm run build       # OK (rollup, 823ms)
```

---

## Status Final

# ✅ APROVADO

O código está em excelente estado. Todos os 304 testes passam (28 puros + 141 integração HA + 135 frontend). Os dois achados da rodada anterior foram corrigidos e estão cobertos por testes de regressão específicos. Nenhum bug de severidade crítica, alta ou média foi identificado. Os dois achados de baixa severidade são cosméticos/performance mínima e não afetam a corretude do sistema.

A arquitetura é robusta: o run lifecycle usa generation tokens para prevenir reentrância, o pH gate é fail-safe, o restart recovery exige evidência de atuação antes de logar, o reservoir tracking compartilha o mesmo gate do history logging, e o frontend valida o contrato de entidades antes de renderizar. A cobertura de testes é extensiva e inclui cenários adversariais (async devices, stale echoes, corrupt store, failed turn_off, double-log prevention).
