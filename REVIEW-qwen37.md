# REVIEW-qwen37.md — Revisão Adversarial Independente

**Revisor**: qwen3.7-max (automated adversarial review)  
**Data**: 2026-08-12  
**Escopo**: Todo o projeto `watergaia` (backend + frontend + testes), incluindo `test_ph_gate.py`  
**Arquivo de saída**: `REVIEW-qwen37.md` (este arquivo)

---

## 1. Arquivos Revisados

### Backend (custom_components/irrigation_scheduler/)
| Arquivo | Linhas | Papel |
|---------|--------|-------|
| `__init__.py` | 467 | Setup, services, frontend wiring |
| `const.py` | 89 | Constantes e defaults |
| `sensor.py` | 151 | Sensor platform (next_run + attribute contract) |
| `switch.py` | 73 | Switch platform (schedule_enabled) |
| `binary_sensor.py` | 79 | Binary sensor platform (watering) |
| `scheduler.py` | 1066 | Core scheduling engine + run lifecycle |
| `schedules.py` | 65 | Pure schedule persistence helpers |
| `next_run.py` | 176 | Pure scheduling computation |
| `store.py` | 78 | Volatile runtime state persistence |
| `config_flow.py` | 337 | Config flow + options flow |
| `manifest.json` | 17 | Integration metadata |
| `strings.json` | 182 | English strings (base) |
| `translations/en.json` | 182 | English translations |
| `translations/pt-BR.json` | 182 | Portuguese translations |
| `services.yaml` | 214 | Service definitions for HA UI |

### Frontend (frontend-src/src/)
| Arquivo | Linhas | Papel |
|---------|--------|-------|
| `card.ts` | 980 | Main Lovelace card (Lit) |
| `editor.ts` | 67 | Card config editor |
| `types.ts` | 98 | TypeScript interfaces |
| `utils.ts` | 254 | Pure utility functions |
| `const.ts` | 9 | Frontend constants |
| `styles.ts` | 434 | Card CSS styles |
| `smoke.mjs` | 119 | Runtime smoke test |

### Testes
| Arquivo | Linhas | Tipo |
|---------|--------|------|
| `tests/test_schedules.py` | 126 | Pure unit (schedules.py) |
| `tests/test_next_run.py` | 224 | Pure unit (next_run.py) |
| `tests/pure_loader.py` | 32 | Test helper |
| `tests/integration/conftest.py` | 280 | Integration fixtures |
| `tests/integration/test_init.py` | 287 | Entry setup/teardown |
| `tests/integration/test_services.py` | 391 | Service integration |
| `tests/integration/test_recovery.py` | 516 | Restart recovery |
| `tests/integration/test_frontend.py` | 107 | Frontend wiring |
| `tests/integration/test_config_flow.py` | 164 | Config/options flow |
| `tests/integration/test_async_device.py` | 374 | Async device regression |
| `tests/integration/test_ph_gate.py` | 332 | pH gate integration |
| `frontend-src/tests/utils.test.ts` | 329 | Frontend utils |
| `frontend-src/tests/card.test.ts` | 255 | Frontend card |

### Configuração / Build
| Arquivo | Papel |
|---------|-------|
| `pytest.ini` | Pytest config (asyncio_mode=auto) |
| `requirements-test.txt` | Test dependencies |
| `hacs.json` | HACS metadata |
| `frontend-src/package.json` | NPM dependencies |
| `frontend-src/rollup.config.mjs` | Bundle config (IIFE) |
| `frontend-src/vitest.config.ts` | Vitest config |

---

## 2. Testes Executados

| Suite | Comando | Resultado |
|-------|---------|-----------|
| Pure Python (schedules + next_run) | `pytest tests/test_schedules.py tests/test_next_run.py -v` | **26 passed, 2 skipped** (DST tests skipped: tzdata unavailable on Windows) |
| Frontend utils + card | `npx vitest run` | **63 passed** (2 test files) |
| Frontend typecheck | `npx tsc --noEmit` | **OK** (no errors) |
| Frontend build | `npx rollup -c` | **OK** (47,240 bytes IIFE bundle, all markers present) |
| Bundle marker check | Python script | **All 14 markers found** in built JS |
| Integration tests | Not executed | Requires `pytest-homeassistant-custom-component` (not installed in this environment) |

---

## 3. Achados por Severidade

### CRÍTICO / BLOCKER
**Nenhum encontrado.** O código de produção é sólido, com defesas adequadas contra os cenários críticos conhecidos (dispositivos async, reentrância, persistência de recovery, pH gate fail-safe).

---

### MÉDIA

#### M1. Bug visual: campo pH sensor no settings panel mostra valor antigo após limpar
- **Arquivo**: `frontend-src/src/card.ts`, linha 481
- **Cenário**: O usuário abre Settings, o campo "Sensor de pH" mostra `sensor.reservatorio_ph` (valor atual). O usuário limpa o campo para desativar o gate de pH. O `_settingsPhEntity` fica `""`, mas o template renderiza `this._settingsPhEntity || phEntityId` — como `""` é falsy em JS, o fallback `phEntityId` (`"sensor.reservatorio_ph"`) é exibido. O usuário vê o valor antigo e pensa que não limpou.
- **Impacto**: Confusão visual. O `_settingsPhEntityTouched` flag garante que o valor correto (`""`) é enviado ao backend, então **o comportamento funcional está correto**. O bug é puramente cosmético.
- **Evidência**: Template na linha 481: `.value=${this._settingsPhEntity || phEntityId}`. O `||` deveria ser substituído por um check explícito: `this._settingsPhEntityTouched ? this._settingsPhEntity : phEntityId`.
- **Reprodução**: Abrir settings → limpar campo pH sensor → observar que o campo reverte visualmente para o valor antigo.

#### M2. `ALL_SERVICES` no test_init.py não inclui `SERVICE_SET_ZONE_OPTIONS`
- **Arquivo**: `tests/integration/test_init.py`, linhas 32-39
- **Cenário**: O tuple `ALL_SERVICES` lista 6 serviços mas omite `set_zone_options`. O teste `test_unload_removes_entities_and_services_only_with_last_entry` verifica que os 6 serviços são removidos no unload, mas não verifica `set_zone_options`.
- **Impacto**: Se `_async_unregister_services` deixasse de remover `set_zone_options`, o teste não detectaria. O código de produção (`__init__.py` linhas 410-420) remove corretamente todos os 7 serviços, então não há bug funcional — apenas uma lacuna no teste.
- **Evidência**: `__init__.py` linha 417 inclui `SERVICE_SET_ZONE_OPTIONS` na lista de unregister, mas `test_init.py` linha 32-39 não o inclui em `ALL_SERVICES`.

#### M3. `_saveSettings` dispara chamada de serviço mesmo sem alterações
- **Arquivo**: `frontend-src/src/card.ts`, linha 610
- **Cenário**: O usuário abre Settings, não altera nada e clica "Salvar". O método monta `data = {}` (nenhum campo mudou) e chama `_callService("set_zone_options", {})`. O backend aceita (todos os campos são opcionais) e não causa side effects, mas é uma chamada de serviço desnecessária que gera um evento no HA bus.
- **Impacto**: Baixo — sem side effects, mas gera tráfego desnecessário e o HA log mostra uma chamada vazia.
- **Mitigação sugerida**: Verificar `Object.keys(data).length > 0` antes de chamar o serviço.

---

### BAIXA

#### B1. `_stringAttr` retorna `undefined` para string vazia (comportamento by-design mas não documentado)
- **Arquivo**: `frontend-src/src/card.ts`, linhas 720-726
- **Cenário**: `_stringAttr` verifica `typeof value === "string" && value` — o `&& value` faz com que `""` (string vazia) retorne `undefined`. Isso afeta `_switchEid`, `_binarySensorEid` e `_zoneName`. Para `ph_entity_id`, o card usa `?? ""` como fallback (linha 226), então o comportamento é correto. Para `_switchEid` e `_binarySensorEid`, uma string vazia significaria "entidade não resolvida", que é semanticamente equivalente a `undefined`.
- **Impacto**: Nenhum bug funcional. A convenção não está documentada e pode confundir futuros mantenedores.

#### B2. `reservoir_volume_l` é write-only no backend (nunca consumido por lógica)
- **Arquivo**: `custom_components/irrigation_scheduler/scheduler.py`
- **Cenário**: O campo `reservoir_volume_l` é armazenado nas options, exposto no sensor e editável via serviço/card, mas nenhuma lógica de backend o consome (não afeta duração, scheduling, pH gate, etc.). É puramente informativo para exibição no card.
- **Impacto**: Nenhum bug. É uma decisão de design válida (campo de metadata), mas vale documentar que é write-only.

#### B3. `_async_registry_updated` cria tasks mesmo após resolução completa
- **Arquivo**: `custom_components/irrigation_scheduler/sensor.py`, linhas 114-125
- **Cenário**: Após `_entities_resolved = True`, o listener de registry updates continua ativo e cria tasks para `_async_resolve_entity_ids`, que retorna imediatamente (early return na linha 137-138). O overhead é mínimo (uma task criada e descartada), mas o listener poderia ser desregistrado após resolução.
- **Impacto**: Overhead insignificante. O `async_on_remove` limpa o listener quando a entidade é removida, então não há leak.

#### B4. Config flow aceita `ph_entity_id` de qualquer domínio sensor
- **Arquivo**: `custom_components/irrigation_scheduler/config_flow.py`, linhas 141-143
- **Cenário**: O `EntitySelectorConfig(domain="sensor")` aceita qualquer sensor, não apenas sensores de pH. Um usuário pode selecionar `sensor.temperature` por engano.
- **Impacto**: O pH gate falhará safe (valor não-parseable como float → run bloqueada). Não há risco de rega indevida, mas o usuário terá que diagnosticar o erro.
- **Mitigação**: Limitação do HA selector — não há como filtrar por `device_class: ph` no selector de entity.

#### B5. `_async_recover_state` não valida tipo de `duration` do store
- **Arquivo**: `custom_components/irrigation_scheduler/scheduler.py`, linha 1003
- **Cenário**: `int(run_state.get("duration", 0))` assume que o valor é int-convertível. Se o store fosse corrompido (ex: `duration: "abc"`), isso levantaria `ValueError`. Porém, o store é interno e sempre salva ints via `async_save_entry`.
- **Impacto**: Teórico — requer corrupção manual do arquivo de store.

#### B6. Bundle JS não é versionado no filename
- **Arquivo**: `custom_components/irrigation_scheduler/frontend/irrigation-schedule-card.js`
- **Cenário**: O filename é fixo (`irrigation-schedule-card.js`). Após uma atualização do HACS, browsers com cache podem servir a versão antiga.
- **Mitigação**: O backend registra o static path com `cache_headers=False` (linha 291 do `__init__.py`), o que instrui o browser a não fazer cache. Adicionalmente, o `add_extra_js_url` adiciona um query parameter com o hash do arquivo em versões recentes do HA.

#### B7. `_formDurationSec` aceita max=59 mas não valida duração total mínima no formulário
- **Arquivo**: `frontend-src/src/card.ts`, linhas 668-675
- **Cenário**: O formulário permite min=0 e sec=0, resultando em `duration=0`. O `_saveDialog` rejeita `duration <= 0` (linha 900), mostrando a mensagem de erro. Porém, min=0 e sec=1 resulta em `duration=1` (1 segundo), que é tecnicamente válido mas inútil para irrigação.
- **Impacto**: O backend clampa para `MIN_DURATION=1`, então 1 segundo é aceito. É um edge case cosmético.

---

## 4. Contratos Verificados

### Sensor → Card Attribute Contract
| Atributo | Sensor (backend) | Card (frontend) | Status |
|----------|-----------------|-----------------|--------|
| `schedules` | `scheduler.schedules` | `sanitizeSchedules(sensor.attributes.schedules)` | OK |
| `target_entity_id` | `scheduler.target_entity_id` | Não consumido diretamente | OK |
| `default_duration` | `scheduler.default_duration` | `_defaultDurationMinutes()` | OK |
| `max_duration` | `scheduler.max_duration` | Não consumido diretamente | OK |
| `flow_rate_lph` | `scheduler.flow_rate_lph` | `_numberAttr(sensor, "flow_rate_lph")` | OK |
| `number_of_pots` | `scheduler.number_of_pots` | `_numberAttr(sensor, "number_of_pots")` | OK |
| `reservoir_volume_l` | `scheduler.reservoir_volume_l` | `_numberAttr(sensor, "reservoir_volume_l")` | OK |
| `ph_entity_id` | `scheduler.ph_entity_id` | `_stringAttr(sensor, "ph_entity_id") ?? ""` | OK |
| `ph_min` | `scheduler.ph_min` | `_numberAttr(sensor, "ph_min") ?? 0` | OK |
| `ph_max` | `scheduler.ph_max` | `_numberAttr(sensor, "ph_max") ?? 14` | OK |
| `schedule_warnings` | `scheduler.schedule_warnings` | `_scheduleWarnings(sensor)` | OK |
| `switch_entity_id` | Resolved via registry | `_stringAttr(sensor, "switch_entity_id")` | OK |
| `binary_sensor_entity_id` | Resolved via registry | `_stringAttr(sensor, "binary_sensor_entity_id")` | OK |

**Todos os 13 atributos do contrato estão alinhados entre backend e frontend.**

### Entries Antigas (sem campos pH)
- `ph_entity_id`: `entry.options.get(CONF_PH_ENTITY_ID, DEFAULT_PH_ENTITY_ID)` → `""` (gate desativado) ✓
- `ph_min`: `_ph_option(CONF_PH_MIN, DEFAULT_PH_MIN)` → `0.0` ✓
- `ph_max`: `_ph_option(CONF_PH_MAX, DEFAULT_PH_MAX)` → `14.0` ✓
- `flow_rate_lph`: `entry.options.get(CONF_FLOW_RATE_LPH, DEFAULT_FLOW_RATE_LPH)` → `0` ✓
- `number_of_pots`: `entry.options.get(CONF_NUMBER_OF_POTS, DEFAULT_NUMBER_OF_POTS)` → `0` ✓
- `reservoir_volume_l`: `entry.options.get(CONF_RESERVOIR_VOLUME_L, DEFAULT_RESERVOIR_VOLUME_L)` → `0` ✓

**Todos os campos opcionais têm fallback seguro para entries antigas.**

### Cálculos L/h por Vaso
- `flow_rate_lph` é tratado como vazão **POR VASO** (documentado em `utils.ts` linha 97-99)
- `perPotVolumeMl(flowLph, duration)` = `(flowLph / 3600) * duration * 1000` ml
- `totalVolumeMl(flowLph, duration, pots)` = `perPotVolumeMl * max(pots, 1)`
- Quando `pots=0`, total = per-pot (comportamento documentado)
- **Consistente entre backend (expõe os 3 valores) e frontend (calcula volumes)**

### Serviços por Device/Area
- `_async_resolve_schedulers` usa `TargetSelection(call.data)` + `async_extract_referenced_entity_ids`
- Suporta `entity_id`, `device_id`, `area_id`, `floor_id`, `label_id`
- Testado em `test_services.py::test_service_targets_device_and_area`
- **Implementação correta e testada**

---

## 5. Falsos Positivos Percebidos

| Item | Por que parece bug | Por que não é |
|------|-------------------|---------------|
| `_stringAttr` retorna `undefined` para `""` | String vazia é um valor válido para `ph_entity_id` | Todos os call sites usam `?? ""` como fallback; para entity IDs, `""` e `undefined` são semanticamente equivalentes |
| `_saveSettings` com `data={}` | Chamada de serviço desnecessária | Backend aceita sem side effects; `async_set_zone_options` preserva options existentes quando nenhum campo é passado |
| `_async_registry_updated` cria tasks após resolução | Overhead desnecessário | `_async_resolve_entity_ids` retorna early (`if self._entities_resolved: return`); overhead é uma task criada e descartada |
| `services.yaml` usa `text` selector para `ph_entity_id` | Poderia usar `entity` selector com `domain: sensor` | O `text` selector permite string vazia (disable gate); o `entity` selector não aceita string vazia |
| `_async_start_run` ignora start requests quando já watering | Pode parecer que o usuário perdeu o clique | Comportamento documentado e correto: não empilhar runs é uma safety feature |
| `ph_min=0, ph_max=14` como default | Parece que o gate está "ativo" com range total | Na prática, `ph_entity_id=""` desativa o gate completamente; os valores de min/max são irrelevantes sem um sensor |

---

## 6. Sugestões (não bloqueantes)

1. **M1 fix**: No template do settings panel, substituir `this._settingsPhEntity || phEntityId` por `this._settingsPhEntityTouched ? this._settingsPhEntity : phEntityId` para refletir visualmente o campo limpo.

2. **M2 fix**: Adicionar `SERVICE_SET_ZONE_OPTIONS` ao `ALL_SERVICES` tuple em `test_init.py`.

3. **M3 fix**: Adicionar `if (Object.keys(data).length === 0) return;` antes de `_callService` em `_saveSettings`.

4. **Documentação**: Adicionar comentário em `scheduler.py` explicando que `reservoir_volume_l` é metadata-only (não consumido por lógica de backend).

5. **Teste adicional**: Adicionar teste de integração para `set_zone_options` com todos os campos vazios (verificar que options não mudam).

---

## 7. Análise do `test_ph_gate.py`

O arquivo de teste `test_ph_gate.py` (332 linhas, 8 testes) foi revisado em detalhe:

| Teste | Cobertura | Qualidade |
|-------|-----------|-----------|
| `test_set_zone_options_updates_ph_gate` | Store + sensor attributes | Bom |
| `test_set_zone_options_can_disable_ph_gate_with_empty_string` | Empty string semantics | Bom |
| `test_set_zone_options_rejects_ph_min_above_ph_max` | Validação cross-field | Bom |
| `test_set_zone_options_rejects_ph_out_of_scale` | Range validation | Bom |
| `test_scheduled_run_starts_when_ph_within_range` | Happy path | Bom |
| `test_scheduled_run_skipped_when_ph_outside_range_flags_warning` | Skip + warning | Bom |
| `test_scheduled_run_skipped_when_ph_sensor_unusable` | Fail-safe (3 parametrizações) | Bom |
| `test_water_now_ignores_ph_gate` | Manual override | Bom |
| `test_warning_clears_after_next_successful_scheduled_fire` | Warning lifecycle | Bom |
| `test_ph_gate_disabled_when_entity_id_not_configured` | Default behavior | Bom |

**Cobertura do pH gate**: Completa. Todos os caminhos do `_check_ph_gate` são testados (disabled, in-range, out-of-range, unavailable, unknown, unparseable). O teste de warning clearance usa `patch("homeassistant.util.dt.now")` corretamente para avançar o relógio simulado.

**Nenhum problema encontrado no test_ph_gate.py.**

---

## 8. Resumo

| Severidade | Count |
|------------|-------|
| CRÍTICO / BLOCKER | 0 |
| MÉDIA | 3 |
| BAIXA | 7 |
| Falsos positivos identificados | 6 |

**Pontos fortes do projeto:**
- Defesa robusta contra dispositivos async (run generation token, grace period, current-state checks)
- Persistência de recovery com retry e safety net (store survives failed turn_off)
- pH gate fail-safe (never waters on unknown pH)
- Contrato sensor-card bem definido e testado
- Entries antigas sem campos opcionais são tratadas com defaults seguros
- Testes de integração cobrem cenários adversariais (stale echoes, stacking, concurrent zones)
- Frontend bundle auto-contido (IIFE, sem dependências externas)
- Separação limpa entre módulos puros (testáveis sem HA) e módulos de integração

---

## STATUS: **APROVADO**

O projeto está em condição sólida para produção. Os 3 achados de severidade média são cosméticos ou de cobertura de teste — nenhum afeta a segurança funcional (nunca regar indevidamente, nunca deixar válvula aberta). Os 7 achados de baixa são melhorias incrementais. Nenhum blocker ou crítico foi identificado.
