# Revisão Adversarial Independente — qwen3.7-max

**Data:** 2026-08-12
**Revisor:** qwen3.7-max (revisão independente, sem comparação com outros reviewers)
**Escopo:** Backend Python (custom_components/irrigation_scheduler), testes, frontend (frontend-src), configurações

---

## Arquivos Revisados

### Backend (custom_components/irrigation_scheduler/)
- `__init__.py` (468 linhas)
- `config_flow.py` (355 linhas)
- `const.py` (101 linhas)
- `manifest.json`
- `next_run.py` (176 linhas)
- `schedules.py` (65 linhas)
- `scheduler.py` (1440 linhas)
- `store.py` (141 linhas)
- `switch.py` (73 linhas)
- `sensor.py` (152 linhas)
- `binary_sensor.py` (81 linhas)
- `services.yaml` (228 linhas)
- `strings.json` (192 linhas)
- `translations/en.json`, `translations/pt-BR.json`

### Testes
- `tests/test_next_run.py` (224 linhas)
- `tests/test_schedules.py` (126 linhas)
- `tests/pure_loader.py` (32 linhas)
- `tests/integration/conftest.py` (280 linhas)
- `tests/integration/test_init.py` (330 linhas)
- `tests/integration/test_config_flow.py` (164 linhas)
- `tests/integration/test_services.py` (577 linhas)
- `tests/integration/test_recovery.py` (595 linhas)
- `tests/integration/test_ph_gate.py` (381 linhas)
- `tests/integration/test_async_device.py` (374 linhas)
- `tests/integration/test_frontend.py` (107 linhas)
- `tests/integration/test_history.py` (354 linhas)

### Configurações
- `pytest.ini`, `requirements-test.txt`, `hacs.json`

---

## Testes Executados

| Suite | Resultado |
|---|---|
| Pure Python (`test_next_run.py` + `test_schedules.py`) | **26 passed, 2 skipped** (DST tests skipped: tzdata indisponível no Windows) |
| Integração (HA venv, `tests/` completo) | **100 passed** em 5.55s |
| Frontend vitest (`npm run test`) | **87 passed** (3 test files) |
| TypeScript typecheck (`npm run typecheck`) | **Limpo** (sem erros) |

**Total: 213 testes executados, 211 passed, 2 skipped, 0 failures.**

---

## Achados por Severidade

### MÉDIA

#### M1 — `_async_abort_run` não limpa snapshots de pH/EC

**Arquivo:** `scheduler.py`, linhas 966-979
**Cenário:** Quando `_async_start_run` falha no `turn_on` e chama `_async_abort_run`, os campos `_active_ph_value`, `_active_ec_value` e `_active_ec_unit` (definidos nas linhas 696-698) NÃO são limpos. Compare com `_async_finish_run` (linhas 828-830) que limpa todos os três.

```python
# _async_abort_run (linha 966-979) — campos limpos:
self._is_watering = False
self._started_at = None
self._finishes_at = None
self._active_duration = None
self._active_source = None
self._active_schedule_id = None
# FALTAM:
# self._active_ph_value = None
# self._active_ec_value = None
# self._active_ec_unit = None
```

**Evidência:** Inconsistência de cleanup entre os dois caminhos de finalização. Embora os campos órfãos não sejam lidos novamente antes de serem sobrescritos no próximo `_async_start_run`, eles mantêm referências a objetos que poderiam ser liberados e violam o princípio de que o estado pós-abort deve ser idêntico ao estado idle.

**Impacto:** Baixo na prática (os campos são sobrescritos no próximo start), mas é um bug de consistência que poderia causar confusão em debugging ou se o código evoluir.

---

#### M2 — `binary_sensor.py` expõe histórico completo (até 200 entradas) como atributo de estado

**Arquivo:** `binary_sensor.py`, linha 65
**Cenário:** `extra_state_attributes` retorna `"history": self._scheduler.history`, que pode conter até `HISTORY_MAX_ENTRIES` (200) registros. Cada registro tem ~10 campos (started_at, finishes_at, duration, source, schedule_id, flow_rate_lph, number_of_pots, ph_value, ec_value, ec_unit).

**Evidência:** Estimativa: 200 registros × ~250 bytes cada ≈ 50KB de atributos de estado. O Home Assistant não tem um limite rígido, mas atributos grandes causam:
- Lentidão no websocket (cada state_changed envia o payload completo)
- Crescimento do banco de dados (recorder grava todos os atributos a cada mudança)
- Possível truncamento em alguns frontends

**Impacto:** Em zonas com muitas regas (ex: 8+ regas/dia × 30 dias), o atributo pode crescer significativamente. O card consome esses dados, mas a maioria dos consumidores (automações, logs) não precisa de 200 registros em cada atualização de estado.

---

### BAIXA

#### B1 — `_async_actuation_check_fired` remove entrada do store mesmo se o turn_off defensivo falhar

**Arquivo:** `scheduler.py`, linhas 1018-1032
**Cenário:** Se o `_async_call_target_service(False)` defensivo lançar exceção (capturada na linha 1021), o código prossegue para `_async_finish_run(turn_off=False, remove_state=True, ...)`. Se o alvo estiver realmente ligado (estado incorreto no state machine), a entrada do store é removida e não haverá recovery no próximo boot.

**Mitigação existente:** O actuation check só dispara quando `_async_target_is_actuated()` retorna False, ou seja, o alvo JÁ reporta estar desligado. O turn_off defensivo é precaução extra. O risco real é muito baixo.

---

#### B2 — `sensor.py` `_async_registry_updated` cria task não rastreada

**Arquivo:** `sensor.py`, linha 126
**Cenário:** `self.hass.async_create_task(self._async_resolve_entity_ids())` cria uma task fire-and-forget. Se `_async_resolve_entity_ids` lançar uma exceção inesperada, ela será logada pelo event loop mas não tratada.

**Mitigação:** O método é simples e improvável de levantar exceções. Além disso, `_entities_resolved` guarda impede execução redundante.

---

#### B3 — Padrão `or DEFAULT_PH_ENTITY_ID` no config_flow é frágil

**Arquivo:** `config_flow.py`, linhas 74, 256-257, 260-261
**Cenário:** `user_input.get(CONF_PH_ENTITY_ID) or DEFAULT_PH_ENTITY_ID` — se `DEFAULT_PH_ENTITY_ID` fosse alterado para uma string não vazia no futuro, uma string vazia enviada pelo usuário seria substituída pelo default, impedindo o clear do campo.

**Mitigação:** Atualmente `DEFAULT_PH_ENTITY_ID = ""`, então `"" or ""` = `""`. Funciona corretamente hoje.

---

#### B4 — `_coerce_days` com dict retorna chaves como string, não int

**Arquivo:** `__init__.py`, linhas 171-177
**Cenário:** Quando days vem como dict (ex: `{"0": True, "1": True}`), `_coerce_days` retorna `["0", "1"]` (strings). A validação voluptuous subsequente aplica `vol.Coerce(int)`, então funciona. Mas se `_coerce_days` fosse usado fora do caminho de validação, os dias seriam strings em vez de ints.

**Mitigação:** `_coerce_days` é sempre chamado antes da validação voluptuous. Nenhum caminho alternativo existe atualmente.

---

### INFORMATIONAL (sugestões, não bugs)

#### I1 — `_async_start_run` abort path: considerar manter store entry se turn_off defensivo falhar

No caminho de abort (linha 742), se o turn_on levantou exceção E o turn_off defensivo também falhar, `_async_abort_run` remove a entrada do store. Em um cenário muito improvável onde o turn_on foi parcialmente dispatchado (async device) mas levantou exceção, o alvo poderia ficar ligado sem recovery. Considerar manter a entrada do store se o turn_off defensivo falhar, similar ao padrão em `_async_finish_run`.

#### I2 — Cobertura de testes para `_async_log_history` best-effort

O caminho onde `_async_log_history` captura exceção (linha 961) não tem teste dedicado. Um teste que simule falha no `store.async_append_history` e verifique que o finish não é interrompido seria valioso.

#### I3 — `_reschedule_next` usa `dt_util.now()` (local) enquanto `_async_start_run` usa `dt_util.utcnow()`

Não é um bug — `find_next_run` trabalha com datetime local e `async_track_point_in_time` aceita ambos — mas a mistura de timezones no mesmo módulo pode confundir maintainers.

---

## Falsos Positivos Percebidos

Durante a revisão, os seguintes padrões pareceram suspeitos mas são corretos:

1. **`_async_finish_run` incrementa `_run_id` antes do turn_off** — Parece que invalidaria o run_id check, mas o `run_id` local captura o valor pré-incremento, e o check `self._run_id != run_id` detecta se um NOVO run começou (incrementando novamente). Correto.

2. **`_async_target_state_changed` ignora eventos durante a janela de graça** — Parece que poderia perder desligamentos legítimos, mas o actuation check deferred decide a saúde do run. Após a graça, eventos legítimos são processados. Correto.

3. **`_async_recover_state` não usa actuation grace** — Parece inconsistente com `_async_start_run`, mas é correto: se o processo está rodando novamente, qualquer delay async já passou. Verificação imediata é apropriada.

4. **`store.py` usa um único lock para entries e history** — Parece que poderia causar contenção, mas ambos precisam da mesma disciplina de lock e um único arquivo evita dessincronização. Design correto.

5. **`_async_register_services` é chamado em `async_setup` E `async_setup_entry`** — Parece duplicado, mas o guard `hass.services.has_service` na linha 320 previne registro duplo. A chamada em `async_setup_entry` é defensiva para o caso de `async_setup` não ter sido chamado (cenário de teste). Correto.

---

## Qualidade Geral do Código

**Pontos fortes:**
- Programação defensiva extensiva (run_id tokens, grace windows, retry loops, restart recovery)
- Documentação inline excepcional — cada decisão de design é justificada
- Separação clara entre módulos puros (testáveis sem HA) e módulos de integração
- Cobertura de testes abrangente (213 testes) cobrindo edge cases críticos (async devices, DST, corrupt store, stale echoes)
- pH gate fail-safe (nunca rega às cegas)
- History com snapshot de configurações no momento da rega (volume histórico permanece correto)

**Áreas de atenção:**
- `scheduler.py` com 1440 linhas — complexo mas bem documentado; refatoração seria arriscada dado o acoplamento entre os mecanismos de segurança
- Ausência de type hints em `entry: Any` e `store: Any` no construtor do `IrrigationScheduler` (linha 125-126)

---

## Status Final

### ✅ APROVADO

O código está em excelente estado. Os 213 testes passam sem falhas. Os achados de severidade média (M1: cleanup inconsistente no abort, M2: atributos de estado grandes) são reais mas de baixo impacto prático. Nenhum achado bloqueante ou crítico foi identificado. A integração demonstra maturidade significativa no tratamento de dispositivos assíncronos, recovery pós-restart e validação defensiva de dados corrompidos.
