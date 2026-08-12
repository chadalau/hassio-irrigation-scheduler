# REVIEW-qwen37.md — Reverificação Adversarial (qwen3.7-max)

**Data**: 2026-08-12  
**Revisor**: qwen3.7-max (opencode-go/qwen3.7-max)  
**Tipo**: Reverificação independente APÓS rodada de correções  
**Escopo**: Working tree com alterações não commitadas e novos testes (`tests/integration/test_history.py`, `test_ph_gate_r2.py`, `test_review_fixes.py`, `test_review_fixes_2.py`, `frontend-src/tests/editor.test.ts`)  
**Metodologia**: Leitura completa de todos os fontes backend/frontend, execução de todos os testes, verificação adversarial de cada achado anterior e busca de novos problemas.

---

## Arquivos Revisados

### Backend (Python)
| Arquivo | Linhas |
|---------|--------|
| `custom_components/irrigation_scheduler/__init__.py` | 497 |
| `custom_components/irrigation_scheduler/binary_sensor.py` | 81 |
| `custom_components/irrigation_scheduler/config_flow.py` | 467 |
| `custom_components/irrigation_scheduler/const.py` | 114 |
| `custom_components/irrigation_scheduler/manifest.json` | 17 |
| `custom_components/irrigation_scheduler/next_run.py` | 198 |
| `custom_components/irrigation_scheduler/scheduler.py` | 1679 |
| `custom_components/irrigation_scheduler/schedules.py` | 65 |
| `custom_components/irrigation_scheduler/sensor.py` | 159 |
| `custom_components/irrigation_scheduler/services.yaml` | 256 |
| `custom_components/irrigation_scheduler/store.py` | 150 |
| `custom_components/irrigation_scheduler/strings.json` | 218 |
| `custom_components/irrigation_scheduler/switch.py` | 73 |
| `custom_components/irrigation_scheduler/translations/en.json` | 218 |
| `custom_components/irrigation_scheduler/translations/pt-BR.json` | 218 |

### Frontend (TypeScript/Lit)
| Arquivo | Linhas |
|---------|--------|
| `frontend-src/src/card.ts` | 1566 |
| `frontend-src/src/const.ts` | 9 |
| `frontend-src/src/editor.ts` | 78 |
| `frontend-src/src/styles.ts` | 661 |
| `frontend-src/src/types.ts` | 140 |
| `frontend-src/src/utils.ts` | 368 |
| `frontend-src/rollup.config.mjs` | 30 |
| `frontend-src/vitest.config.ts` | 8 |
| `frontend-src/tsconfig.json` | 20 |
| `frontend-src/package.json` | 25 |

### Testes
| Arquivo | Linhas |
|---------|--------|
| `tests/test_next_run.py` | 224 |
| `tests/test_schedules.py` | 126 |
| `tests/pure_loader.py` | 32 |
| `tests/integration/conftest.py` | 280 |
| `tests/integration/test_async_device.py` | 374 |
| `tests/integration/test_config_flow.py` | 164 |
| `tests/integration/test_frontend.py` | 107 |
| `tests/integration/test_history.py` | 404 |
| `tests/integration/test_init.py` | 330 |
| `tests/integration/test_ph_gate.py` | 381 |
| `tests/integration/test_ph_gate_r2.py` | 284 |
| `tests/integration/test_recovery.py` | 595 |
| `tests/integration/test_review_fixes.py` | 433 |
| `tests/integration/test_review_fixes_2.py` | 225 |
| `tests/integration/test_services.py` | 577 |
| `frontend-src/tests/card.test.ts` | 945 |
| `frontend-src/tests/editor.test.ts` | 65 |
| `frontend-src/tests/utils.test.ts` | 482 |

---

## Testes Executados

| Suite | Comando | Resultado |
|-------|---------|-----------|
| Pure backend (pytest) | `python -m pytest tests/test_next_run.py tests/test_schedules.py -v` | **26 passed, 2 skipped** (DST: tzdata indisponível no Windows) |
| HA integration (PHCC venv) | `ha-venv\Scripts\python.exe -m pytest tests/integration/ -v --timeout=120` | **99 passed** em 10.27s |
| Frontend typecheck | `npm run typecheck` | **OK** (zero errors) |
| Frontend tests (vitest) | `npm run test` | **110 passed** (3 test files) |
| Frontend build (rollup) | `npm run build` | **OK** (IIFE gerado em 774ms) |

**Total: 235 testes executados, 233 passed, 2 skipped (esperado), 0 failures.**

---

## Verificação dos Achados Anteriores

### 1. Parada externa sumindo do histórico — ✅ CORRIGIDO

**Achado original**: Um run que realmente regou e foi parado por um ator externo (não pelo stop timer/manual stop) não era logado no histórico, porque o target já estava off quando `_async_finish_run` verificava `_async_target_is_actuated()`.

**Correção aplicada**: O flag sticky `_active_actuated` (scheduler.py:180) é setado quando o target reporta estado actuated (linha 1388 no state-change listener, linha 1194 no deferred actuation check). Em `_async_finish_run`, `history_actuated = self._active_actuated or self._async_target_is_actuated()` (linha 979) — se o target EVER actuated during the run, it gets logged regardless of current state.

**Evidência**: Teste `test_external_stop_after_real_watering_is_logged_to_history` (test_review_fixes_2.py:31-73) valida exatamente este cenário: start run, wait past grace, external actor turns target off, asserts `len(scheduler.history) == 1`. **PASSA.**

### 2. Zona presa em "Regando" em falha de I/O no store — ✅ CORRIGIDO

**Achado original**: Se `store.async_save_entry()` falhasse no início de um run, `_is_watering` já estava True mas nenhum timer era armado, deixando a zona presa em "Regando" até reload/restart.

**Correção aplicada**: Bloco try/except em `_async_start_run` (linhas 828-853) captura falhas de persistência e reverte TODOS os campos de estado in-memory (`_is_watering = False`, `_started_at = None`, etc.) ANTES de retornar. O turn_on NÃO foi enviado neste ponto, então não há risco físico.

**Evidência**: Teste `test_start_run_reverts_state_when_store_save_fails` (test_review_fixes_2.py:168-196) patcheia `async_save_entry` para raise RuntimeError, verifica `not scheduler.is_watering`, `scheduler.started_at is None`, `_unsub_stop is None`, e que um water_now subsequente funciona normalmente. **PASSA.**

### 3. Snapshot pH/EC não restaurado no resume — ✅ CORRIGIDO

**Achado original**: Um run resumed após restart não restaurava os valores de pH/EC persistidos no store, resultando em `None` no histórico quando o run completava.

**Correção aplicada**: `_async_recover_state` restaura explicitamente os snapshots pH/EC do store (linhas 1551-1556): `_active_ph_value = run_state.get("ph_value")`, `_active_ec_value = run_state.get("ec_value")`, etc. (incluindo R2).

**Evidência**: Teste `test_resumed_run_that_finishes_normally_logs_restored_ph_ec` (test_review_fixes_2.py:76-127) popula o store com ph_value=6.1, ec_value=800.0, ph_value_2=6.4, ec_value_2=1200.0, faz setup, verifica que o scheduler resume com os valores corretos, e que o histórico final contém todos os valores. **PASSA.**

### 4. Atributo `history` grande — ✅ CORRIGIDO

**Achado original**: O atributo `history` no binary_sensor podia crescer sem limite, aumentando o payload de state attributes.

**Correção aplicada**: `HISTORY_MAX_ENTRIES = 200` e `HISTORY_RETENTION_DAYS = 30` (const.py:88-89). `_prune_history` (store.py:41-64) aplica ambos os limites. A poda ocorre tanto no append quanto no load (para cobrir o caso de HA ficar off além da janela de retenção).

**Evidência**: Teste `test_history_caps_at_max_entries` (test_history.py:349-404) semeia 200 entradas, adiciona mais uma, e verifica que o total permanece em 200 com a mais nova no início. **PASSA.**

### 5. Recovery removendo store sem confirmação de off — ✅ CORRIGIDO

**Achado original**: O recovery path "resumed but not actuated" chamava `_async_finish_run(turn_off=False, remove_state=True)`, pulando o retry loop e removendo o store incondicionalmente.

**Correção aplicada**: O caminho agora usa `_async_finish_run(turn_off=True, remove_state=True, log_history=False)` (scheduler.py:1583-1585). Com `turn_off=True`, o retry loop de 3 tentativas executa, e se o target não confirma off, `remove_state` é setado para `False` (linha 1052), preservando o store.

**Evidência**: Teste `test_recovery_resumed_not_actuated_preserves_store_when_target_unavailable` (test_review_fixes_2.py:130-166) configura um store com finishes_at futuro, target STATE_UNAVAILABLE, turn_off raising RuntimeError, e verifica que o store entry sobrevive. **PASSA.**

O caminho "expired during downtime" (linhas 1471-1522) também foi corrigido: faz um turn_off defensivo single-shot e só remove o store se `_async_target_is_off()` retornar True (linha 1492). Se não, mantém o store e loga ERROR (linha 1516-1521). Teste `test_recovery_keeps_store_when_defensive_turn_off_fails` (test_recovery.py:518-595) valida este cenário. **PASSA.**

### 6. `started_at` naive — ✅ CORRIGIDO

**Achado original**: `_prune_history` comparava datetimes naive com aware, causando TypeError.

**Correção aplicada**: `_prune_history` normaliza com `dt_util.as_utc(started_at)` (store.py:60) antes de comparar. `_async_recover_state` normaliza `finishes_at` com `dt_util.as_utc(finishes_at)` (scheduler.py:1469).

**Evidência**: Teste `test_prune_history_normalizes_naive_started_at_instead_of_raising` (test_review_fixes_2.py:199-206) passa um entry com started_at naive e verifica que `_prune_history` não raise. **PASSA.**

---

## Novos Achados (Esta Rodada)

### LOW — scheduler.py:1532+1542 — `_coerce_stored_duration` pode raise TypeError com `started_at` naive e `duration` inválido simultaneamente

**Cenário**: Um store corrompido/editado manualmente com AMBOS `started_at` naive (sem tzinfo) E `duration` inválido (não-int ou fora do range). O `started_at` é parseado (linha 1532) mas NÃO normalizado com `dt_util.as_utc()` — apenas `finishes_at` é normalizado (linha 1469). Quando `_coerce_stored_duration` (linha 1542) cai no fallback `int((finishes_at - fallback_start).total_seconds())` (linha 1614), a subtração `aware - naive` raises TypeError.

**Evidência**: `_coerce_stored_duration` não tem try/except. O caller (`_async_recover_state`) também não protege esta chamada. Um TypeError aqui propaga para `async_setup_entry`, falhando o setup da zona. O caminho análogo em `_prune_history` já normaliza (store.py:60), mas o resume path não.

**Impacto**: Muito baixo. Requer dupla corrupção do store (started_at naive + duration inválido). Todo writer no codebase persiste aware UTC. O stop timer é armado contra `finishes_at` (já validado), não contra `duration` — então mesmo que `_coerce_stored_duration` raise, o target não ficaria ligado além do previsto (o setup falharía e o HA não carregaria a zona, deixando o store intacto para o próximo boot).

**Sugestão**: Normalizar `started_at` com `dt_util.as_utc()` após o parse (linha 1532), consistente com `finishes_at` (linha 1469). Alternativamente, envolver `_coerce_stored_duration` em try/except com fallback para `dt_util.utcnow()`.

### INFO — scheduler.py:1496 — `_async_log_history` no recovery expired path com `started_at` naive

**Cenário**: No caminho "expired during downtime" (linha 1496), `recovered_started_at` é parseado mas não normalizado. Se for naive, `_async_log_history` computa `int((finished_at - started_at).total_seconds())` (linha 1109) que raises TypeError (aware - naive).

**Evidência**: `_async_log_history` tem try/except (linha 1125-1135) que captura e loga a exceção como warning. O impacto é apenas a perda do registro de histórico — o store já foi removido (linha 1493) e a zona continua funcionando.

**Impacto**: Puramente informacional. O registro de histórico é perdido, mas a operação normal não é afetada.

**Sugestão**: Normalizar `recovered_started_at` com `dt_util.as_utc()` após o parse, consistente com o tratamento em `_prune_history`.

---

## Falsos Positivos Percebidos

1. **`_async_finish_run` early return quando `_run_id != run_id` (linha 1004)**: Parece que o store não é limpo e o histórico não é logado. Correto: um novo run assumiu o store entry, e o novo run é responsável por seu próprio cleanup. O in-memory state do run antigo já foi limpo (linhas 980-991).

2. **`_async_abort_run` remove store apenas se target confirmado off (linha 1155)**: Parece inconsistente com `_async_finish_run` que tem retry loop. Correto: `_async_abort_run` é chamado APÓS um turn_off defensivo já ter sido emitido pelo caller (linha 873). O check `_async_target_is_off()` usa `confirmed_off_states` (apenas "off"/"closed", não "unavailable"/"unknown"), então um target indisponível mantém o store.

3. **`_async_recover_state` expired path faz single turn_off (linha 1479) vs retry loop no finish**: Parece inconsistente. Correto: é um caminho de startup (best-effort), e o store é mantido se o target não confirma off (linha 1515-1521), garantindo retry no próximo boot. O retry loop em `_async_finish_run` é para run-finish (mais agressivo).

4. **`_check_ph_gate` label logic (scheduler.py:1282)**: `label_2` é calculado antes de `label_1`. Correto: quando R2 está configurado, R1 recebe "R1: " e R2 recebe "R2: "; quando R2 não está configurado, R1 não recebe prefixo. Testes validam ambos os cenários.

5. **`history_actuated` check em `_async_finish_run` (linha 979)**: `_async_target_is_actuated()` é chamado ANTES de limpar o estado e ANTES de emitir turn_off. Correto: verifica se o target havia saído do estado off no momento do finish. O sticky flag `_active_actuated` cobre o caso onde o target já está off mas foi actuated anteriormente.

6. **`_stringAttr` retorna `undefined` para strings vazias (card.ts)**: Correto para entity_id e friendly_name, onde `""` deve ser tratado como ausente. Todos os usos atuais são para esses campos.

7. **`_callService` target parameter (card.ts)**: Passa `{ entity_id: entityId }` como target, não como service data. Correto para a API `callService` do HA.

---

## Análise de Segurança e Robustez

### Pontos Fortes Confirmados
- **Fail-safe pH gate**: Leituras missing/unavailable/unparseable/NaN/inf bloqueiam a rega.
- **Restart recovery com store preservation**: Store mantido quando turn_off não confirmado.
- **Run generation token (`_run_id`)**: Previne reentrância e callbacks stale.
- **Actuation grace window**: Dispositivos async recebem tempo para reportar estado.
- **History integrity**: Runs que nunca atuaram não são logados (`history_actuated` gate).
- **Shared store com lock**: Múltiplas zonas compartilham um único `RuntimeStore` com `asyncio.Lock`.
- **Store I/O failure recovery**: Falha de persistência no start reverte todo o estado in-memory.
- **pH/EC snapshot persistence**: Snapshots persistidos no start e restaurados no resume.
- **History bounded**: Capped em 200 entradas e 30 dias.
- **Duplicate schedule id rejection**: `set_schedules` rejeita listas com ids duplicados.
- **Options flow preserves pH/EC**: `.get(key, current)` em vez de `or DEFAULT`.

### Cobertura de Testes
- **99 testes de integração HA** cobrindo: setup/teardown, config flow, services, recovery (expired + resumed + corrupt + not-actuated + keep-store), pH gate (R1 + R2), async devices, history (caps + pH/EC + restart + scheduled + never-actuated + external-stop + downtime-expired), frontend wiring, e regressões de reviews anteriores.
- **26 testes puros** cobrindo: next_run computation, DST policy, schedule serialization/merge, id stability.
- **110 testes frontend** cobrindo: config validation, rendering, settings panel, pH/EC badges, R2 badges, history dialog, schedule dialog, editor, utils.

---

## Sugestões (não bloqueantes)

1. **Normalizar `started_at` no resume path**: Adicionar `started_at = dt_util.as_utc(started_at)` após o parse na linha 1532, consistente com `finishes_at` (linha 1469) e `_prune_history` (store.py:60). Previne TypeError em `_coerce_stored_duration` e `_async_log_history` com stores corrompidos.

2. **Normalizar `recovered_started_at` no expired recovery path**: Mesma normalização na linha 1496, para garantir que o histórico seja logado corretamente mesmo com stores corrompidos.

3. **`_coerce_days` não é exercitado por testes**: A função `_coerce_days` em `__init__.py` (linhas 185-191) normaliza dict/string para list, mas não há teste específico para esse caminho.

---

## Status Final

### ✅ APROVADO

Todos os 6 achados da revisão anterior foram **corretamente endereçados** com mudanças de código e testes de regressão dedicados. Os 235 testes passam (2 skipped por limitação de ambiente, não por falha). Os 2 novos achados desta rodada são de severidade LOW/INFO e envolvem dupla corrupção do store (edge case extremamente raro com impacto limitado). A arquitetura é robusta, com defesas em profundidade para dispositivos async, restart recovery, pH gate fail-safe, integridade do histórico e bounded attributes.
