# REVIEW-qwen37.md — Revisão Adversarial Independente

**Revisor**: qwen3.7-max  
**Data**: 2026-08-12  
**Escopo**: Working tree completo (backend, frontend, testes) — sem comparação com outros reviewers  
**Política**: Nenhuma alteração em código de produção ou testes

---

## Arquivos revisados

### Backend (Python)
| Arquivo | Linhas |
|---|---|
| `custom_components/irrigation_scheduler/__init__.py` | 506 |
| `custom_components/irrigation_scheduler/config_flow.py` | 467 |
| `custom_components/irrigation_scheduler/const.py` | 121 |
| `custom_components/irrigation_scheduler/next_run.py` | 198 |
| `custom_components/irrigation_scheduler/scheduler.py` | 1771 |
| `custom_components/irrigation_scheduler/schedules.py` | 65 |
| `custom_components/irrigation_scheduler/sensor.py` | 160 |
| `custom_components/irrigation_scheduler/store.py` | 150 |
| `custom_components/irrigation_scheduler/switch.py` | 73 |
| `custom_components/irrigation_scheduler/binary_sensor.py` | 81 |
| `custom_components/irrigation_scheduler/manifest.json` | 17 |
| `custom_components/irrigation_scheduler/services.yaml` | 263 |
| `custom_components/irrigation_scheduler/strings.json` | 223 |
| `custom_components/irrigation_scheduler/translations/en.json` | 223 |
| `custom_components/irrigation_scheduler/translations/pt-BR.json` | 223 |

### Frontend (TypeScript/Lit)
| Arquivo | Linhas |
|---|---|
| `frontend-src/src/card.ts` | 1640 |
| `frontend-src/src/editor.ts` | 78 |
| `frontend-src/src/styles.ts` | 707 |
| `frontend-src/src/types.ts` | 143 |
| `frontend-src/src/utils.ts` | 465 |
| `frontend-src/src/const.ts` | 9 |

### Testes
| Arquivo | Linhas |
|---|---|
| `tests/test_next_run.py` | 224 |
| `tests/test_schedules.py` | 126 |
| `tests/pure_loader.py` | 32 |
| `tests/integration/conftest.py` | 280 |
| `tests/integration/test_init.py` | 330 |
| `tests/integration/test_config_flow.py` | 164 |
| `tests/integration/test_services.py` | 577 |
| `tests/integration/test_ph_gate.py` | 381 |
| `tests/integration/test_ph_gate_r2.py` | 284 |
| `tests/integration/test_recovery.py` | 595 |
| `tests/integration/test_reservoir.py` | 223 |
| `tests/integration/test_history.py` | 404 |
| `tests/integration/test_async_device.py` | 374 |
| `tests/integration/test_frontend.py` | 107 |
| `tests/integration/test_review_fixes.py` | 433 |
| `tests/integration/test_review_fixes_2.py` | 360 |
| `frontend-src/tests/card.test.ts` | 1152 |
| `frontend-src/tests/editor.test.ts` | 65 |
| `frontend-src/tests/utils.test.ts` | 595 |

---

## Testes executados

| Suíte | Comando | Resultado |
|---|---|---|
| Backend puro | `python -m pytest tests/test_next_run.py tests/test_schedules.py -q` | **28 passed** (0.02s) |
| Backend HA | `python -m pytest tests -q` | **137 passed** (12.20s) |
| Frontend typecheck | `npm run typecheck` | **OK** (tsc --noEmit sem erros) |
| Frontend test | `npm run test` | **132 passed** (3 files, 698ms) |
| Frontend build | `npm run build` | **OK** (rollup, 812ms) |

**Total: 297 testes, 0 falhas.**

---

## Achados por severidade

### MÉDIA

#### M1 — `SERVICE_REFILL_RESERVOIR` não é desregistrado no unload da última entry
- **Arquivo**: `__init__.py:449-458`
- **Cenário**: O serviço `refill_reservoir` é registrado em `_async_register_services` (L442) mas está **ausente** da tupla de desregistro em `_async_unregister_services` (L449-458). Quando a última config entry é descarregada, os outros 7 serviços são removidos mas `refill_reservoir` permanece órfão no service registry.
- **Evidência**: Comparação direta entre as tuplas:
  - Registro (L434-443): inclui `(SERVICE_REFILL_RESERVOIR, _async_refill_reservoir)`
  - Desregistro (L449-458): lista apenas 7 serviços, `SERVICE_REFILL_RESERVOIR` ausente
- **Impacto**: Após unload da última entry, o serviço `refill_reservoir` continua visível no HA. Se chamado, `_async_resolve_schedulers` lança `ServiceValidationError` (nenhum scheduler encontrado). No próximo setup, `_async_register_services` verifica `has_service(DOMAIN, SERVICE_WATER_NOW)` — como `water_now` foi desregistrado, retorna False e re-registra tudo (o handler órfão de `refill_reservoir` é substituído). O impacto funcional é baixo, mas é uma inconsistência real que pode confundir automações que enumeram serviços disponíveis.
- **Correção sugerida**: Adicionar `SERVICE_REFILL_RESERVOIR` à tupla de `_async_unregister_services`.

### BAIXA

#### B1 — Limpeza de `_schedule_warnings` muito agressiva ao desativar pH gate
- **Arquivo**: `scheduler.py:696`
- **Cenário**: `if ph_entity_id == "" or ph_entity_id_2 == "": self._schedule_warnings.clear()`. Desativar o gate de R2 (enviando `ph_entity_id_2=""`) limpa warnings de R1 também, e vice-versa.
- **Evidência**: O código não distingue qual reservatório foi desativado; limpa todos os warnings incondicionalmente.
- **Impacto**: Puramente cosmético — um warning badge de R1 pode sumir prematuramente quando o usuário desativa R2. O próximo firing agendado recriaria o warning se aplicável.

#### B2 — `_deduct_reservoir_volume` dispara side-effects desnecessários
- **Arquivo**: `scheduler.py:716-730`
- **Cenário**: Cada dedução de volume chama `async_update_entry` que dispara o update listener → `async_options_updated()` → `_reschedule_next()` + `_async_dispatch_update()`. A dedução de volume não altera o próximo agendamento; o recálculo é overhead puro.
- **Impacto**: Performance — um dispatch e recálculo de next_run extras a cada run completado. Insignificante na prática (runs são eventos raros, não高频).

#### B3 — Volume/estimativa/refill renderizados duplicados em R1 e R2
- **Arquivo**: `card.ts:348-349, 380-401`
- **Cenário**: O mesmo `volumeBadge`, `estimateBadge` e `refillButton` são renderizados tanto na linha R1 quanto na R2. Como `reservoir_volume_l` é um só (não existe `reservoir_volume_l_2`), ambos mostram valores idênticos.
- **Impacto**: UX — o usuário pode interpretar que são reservatórios separados. Funcionalmente correto (uma bomba, dois tanques, um volume).

#### B4 — `_saveSettings` ignora silenciosamente campos inválidos
- **Arquivo**: `card.ts:900-917`
- **Cenário**: Se o usuário digitar "abc" no campo "Duração padrão", `Number.parseInt("abc", 10)` retorna `NaN`, e o campo é omitido do payload sem feedback. O painel fecha como se tivesse salvo com sucesso (apenas os campos válidos são enviados).
- **Impacto**: UX — o usuário pode não perceber que sua alteração foi ignorada.

---

## Falsos positivos percebidos

Durante a revisão, os seguintes padrões foram investigados e considerados **não-bugs**:

1. **`_async_finish_run` e a flag `_active_actuated` (scheduler.py:1033)**: A combinação do sticky flag com a verificação do estado atual (`self._active_actuated or self._async_target_is_actuated()`) é correta. O sticky flag garante que runs que genuinamente regaram mas cujo target já está off no momento do finish sejam logados.

2. **Race condition no `_run_id` (scheduler.py:1001-1008)**: O generation token é incrementado antes de limpar o estado, e o novo `run_id` é capturado para proteger o retry loop de turn_off. Stale callbacks são rejeitados corretamente.

3. **`_suppress_state_listener` no abort path (scheduler.py:909-937)**: O `finally` block garante que `_suppress_state_listener` é resetado mesmo se o turn_off defensivo falhar.

4. **`_MAX_DAY_OFFSET = 8` (next_run.py:36)**: Cobre offsets 0-7 (8 dias), suficiente para encontrar o próximo occurrence de qualquer weekday.

5. **`window.confirm` no frontend (card.ts:1475, 1486)**: Padrão aceitável para custom cards do HA. Não é um bug.

6. **`async_loaded_entries` durante unload (__init__.py:254)**: HA remove a entry da lista de loaded entries durante `async_unload_platforms`, antes do check. O comportamento está correto.

7. **Naive datetime handling no `_prune_history` e `_async_recover_state`**: Todos os pontos de parse de datetime normalizam com `dt_util.as_utc()` antes de aritmética. Testes em `test_review_fixes_2.py` confirmam.

---

## Sugestões (não-bugs, melhorias opcionais)

1. **Teste para M1**: Adicionar um teste em `test_init.py` que verifique que `refill_reservoir` é desregistrado quando a última entry é descarregada (atualmente `ALL_SERVICES` em `test_init.py:33-41` não inclui `SERVICE_REFILL_RESERVOIR`).

2. **`_check_ph_gate` label condicional**: Considerar incluir o label "R1:" sempre que R2 estiver configurado, mesmo que R1 falhe primeiro — facilita o debugging no log.

3. **Frontend feedback para campos inválidos**: `_saveSettings` poderia exibir um warning inline quando campos são ignorados por valor inválido.

---

## Resumo

| Severidade | Quantidade |
|---|---|
| Crítica | 0 |
| Média | 1 |
| Baixa | 4 |

O código é **excepcionalmente robusto**. O scheduler implementa defesas em profundidade contra race conditions (generation tokens), dispositivos assíncronos (grace period + deferred actuation check), falhas de persistência (revert-before-turn_on), e restart recovery (store-based safety net com retry+confirmation). O pH gate é fail-safe (missing/unavailable/unparseable bloqueia, nunca rega às cegas). O frontend valida contratos de atributos e surfacing de erros do backend. A suíte de testes (297 testes) cobre extensivamente edge cases incluindo DST, stale echoes, corrupt store, e async devices.

O único bug real encontrado (M1) é uma omissão na lista de desregistro de serviços — funcionalmente de baixo impacto mas uma inconsistência que deve ser corrigida.

---

## Status: **APROVADO**

O único finding de severidade média (M1 — `refill_reservoir` não desregistrado) é de baixo impacto funcional e não justifica bloquear o merge. Os findings de severidade baixa são cosméticos ou de performance insignificante. A base de código demonstra maturidade excepcional em tratamento de edge cases e defesa contra falhas.
