# REVIEW-deepseek.md — Revisão adversarial independente (deepseek-v4-flash)

**Status final: PRECISA DE ALTERAÇÃO**
**Data:** 2026-08-12 · **Ambiente:** Windows, HA 2026.2.3 + PHCC (venv `%TEMP%\opencode\ha-venv`), Python 3.13/3.14, Node 22 + Vitest/Rollup

> **Nota sobre o estado do repositório:** a premissa da solicitação ("alterações não
> commitadas e arquivo não rastreado `tests/integration/test_ph_gate.py`") **não
> corresponde ao estado real**: `git status` está limpo e `test_ph_gate.py` já está
> commitado no HEAD (`7579c4d feat: add optional per-zone pH gate ...`, que também
> contém todo o gate de pH, card, strings, testes e docs). Esta revisão cobre o HEAD
> inteiro. Há dois arquivos de revisão de outros modelos na raiz, **não rastreados**:
> `REVIEW-luna.md` (PRECISA DE ALTERAÇÃO) e `REVIEW-qwen37.md` (APROVADO). Meus testes
> empíricos **confirmam o Luna** e **refutam o Qwen37** nos pontos críticos (ver §4).

---

## 1. Arquivos revisados

### Backend `custom_components/irrigation_scheduler/`
| Arquivo | Papel |
|---|---|
| `__init__.py` (467 linhas) | Setup, serviços (7), frontend wiring, resolução de alvos |
| `scheduler.py` (1066) | Motor de agendamento, lifecycle da rega, gate de pH, recovery |
| `next_run.py` (176) | Cálculo puro do próximo horário (zero imports HA) |
| `schedules.py` (65) | Serialização/imutabilidade de id |
| `store.py` (78) | Persistência volátil do runtime (lock compartilhado) |
| `sensor.py` (151) | Sensor `next_run` + contrato de atributos do card |
| `switch.py` (73) | Switch `schedule_enabled` |
| `binary_sensor.py` (79) | Binary sensor `watering` |
| `config_flow.py` (337) | Config/options flow (vazão, vasos, reservatório, pH) |
| `const.py`, `manifest.json`, `services.yaml`, `strings.json`, `translations/{en,pt-BR}.json`, `frontend/irrigation-schedule-card.js` | Contratos e metadados |

### Frontend `frontend-src/src/`
`card.ts` (980), `editor.ts` (67), `utils.ts` (254), `types.ts` (98), `const.ts`, `styles.ts`, `rollup.config.mjs`, `package.json`, `tsconfig.json`, `vitest.config.ts`, `tests/{utils,card}.test.ts`.

### Testes
`tests/test_next_run.py`, `tests/test_schedules.py`, `tests/pure_loader.py`, `tests/integration/{conftest.py, test_init.py, test_services.py, test_recovery.py, test_async_device.py, test_config_flow.py, test_frontend.py, test_ph_gate.py}`.

### Documentação
`README.md`, `FUNCTIONS.md`, `hacs.json`, `pytest.ini`, `.gitignore`.

---

## 2. Achados por severidade

### CRÍTICO

#### C1. Leitura de pH `nan`/`NaN` libera um disparo agendado (válvula abre) — viola o fail-safe
- **Arquivo:** `scheduler.py`, `_check_ph_gate()` (linhas 843-873).
- **Cenário/evidência (reproduzido em runtime):** com `ph_entity_id` configurado, `ph_min=5.5`, `ph_max=6.5` e o sensor reportando `"nan"`, `"NaN"` ou `"NAN"`, o `float()` não lança exceção, `nan < 5.5` e `nan > 6.5` são ambos `False`, e o gate retorna `(True, None)` → `homeassistant.turn_on` é chamado e a válvula é aberta. Confirmei com teste adversarial (mock `turn_on` executado; log `Watering started ... source=schedule`). `"inf"`/`"-inf"` são bloqueados corretamente — só `nan` vaza. O docstring promete fail-safe para "valor não parseável"; `nan` é um valor não finito e o comentário/strings tratam leituras fora de escala como bloqueio.
- **Impacto:** com um sensor que serialize NaN (floats IEEE em template/template integrations, etc.), o agendamento rega fora da faixa, contrariando o requisito explícito do commit.
- **Sugestão:** exigir `math.isfinite(value)` após o `float()` (ou validar `PH_SCALE_MIN <= value <= PH_SCALE_MAX` com isfinite) antes das comparações; adicionar casos `nan`/`NaN`/`-nan` ao teste `test_scheduled_run_skipped_when_ph_sensor_unusable`.

### ALTO

#### A1. Recovery com `duration` corrompido no store derruba o setup da zona (sem desligamento defensivo)
- **Arquivo:** `scheduler.py`, `_async_recover_state()` (linha 1003).
- **Cenário/evidência (reproduzido):** store com `finishes_at` futuro e `duration: "abc"` → `int("abc")` lança `ValueError` dentro de `async_setup` → `Error setting up entry Garden for irrigation_scheduler`; a zona não carrega e **nenhum `turn_off` defensivo é tentado** (o target pode ter ficado aberto). `started_at` também é atribuído sem validar (`parse_datetime` pode retornar `None`). O mesmo rigor defensivo já existe para `finishes_at`; falta para os demais campos.
- **Impacto:** em um mecanismo de irrigação, um store corrompido (corte de energia/edição manual) pode deixar a válvula aberta com o mecanismo de recovery fora do ar.
- **Sugestão:** validar `started_at` (tz-aware, coerente com `finishes_at`) e `duration` (int positivo, clamp `[MIN_DURATION, MAX_SCHEDULE_DURATION]`); em payload inválido, tentar desligamento defensivo, confirmar estado off e então remover o registro — sem abortar o setup.

### MÉDIO

#### M1. Duração corrompida de um horário mata a cadeia de agendamento silenciosamente
- **Arquivo:** `scheduler.py`, `_async_schedule_fired()` (linha 837) e `_async_start_run()` (linha 534).
- **Cenário/evidência (reproduzido):** com um schedule `duration: "not-a-number"` nas options, o disparo lança `ValueError: invalid literal for int()`. Como `self._reschedule_next()` (linha 841) fica **depois** da chamada, ele nunca executa; o timer era one-shot; o resultado é `ERROR ... Task exception was never retrieved` e a zona **nunca mais agenda** até restart ou mudança de options. A property `schedules` filtra apenas itens não-dict, não tipos de campo inválidos — inconsistente com o espírito defensivo do resto do código (ex.: `_duration_option`).
- **Impacto:** falha em regar (fails closed), mas silenciosa e permanente até intervenção manual.
- **Sugestão:** validar `duration` na property `schedules` (int, range) ou fazer `_async_schedule_fired`/`_async_start_run` usarem um coerce defensivo e sempre executar `_reschedule_next()` em `finally`.

#### M2. `set_zone_options` parcial pode inverter a faixa de pH silenciosamente
- **Arquivo:** `__init__.py`, `_validate_ph_range()` (linhas 123-134).
- **Cenário/evidência (reproduzido):** após `ph_min=5.5, ph_max=6.5`, uma chamada só com `ph_min=7.0` é aceita e persiste `7.0..6.5`; o serviço documenta campos independentemente opcionais e o card envia alterações parciais. O gate então bloqueia **todas** as regas agendadas (fail-safe, nunca abre a válvula) até correção manual — uma armadilha de configuração que desativa uma zona sem erro visível.
- **Sugestão:** validar o **estado efetivo** (opções atuais + patch) antes de salvar, ou exigir ambos os limites em qualquer alteração de pH.

#### M3. Semântica de vazão "por vaso" ambígua na UI/docs backend (risco de volume total superestimado)
- **Arquivo:** `utils.ts` (`waterVolume`/`totalVolumeMl`), `services.yaml` ("liters per hour"), `config_flow.py` ("Vazão (L/h)"), `card.ts`.
- **Cenário:** o cálculo trata `flow_rate_lph` como **vazão por vaso** e multiplica por `number_of_pots` no total. A UI/`services.yaml` só dizem "L/h", sem "por vaso" (apenas `FUNCTIONS.md` documenta). Um usuário que informar a vazão total da linha verá um volume total `pots` vezes maior.
- **Impacto:** exibição incorreta (sem impacto de segurança — é só o card).
- **Sugestão:** rotular "L/h por vaso" no config flow, options flow, services.yaml e card; adicionar teste de regressão de contrato (ex.: vazão 8 L/h, 12 vasos, 900 s → 2 L/vaso, 24 L total).

### BAIXO

| ID | Achado | Evidência |
|---|---|---|
| B1 | `set_schedules` sem a chave `schedules` lança `KeyError` cru em vez de `ServiceValidationError` | `__init__.py` linha 366 (`data[CONF_SCHEDULES]`); reproduzido (exceção genérica) |
| B2 | Campo pH no settings panel do card "reverte" visualmente ao limpar | `card.ts` linha 481: `.value=${this._settingsPhEntity \|\| phEntityId}` — `""` é falsy; o `_settingsPhEntityTouched` garante o envio correto de `""`, mas o usuário vê o valor antigo no input |
| B3 | `ALL_SERVICES` em `test_init.py` omite `SERVICE_SET_ZONE_OPTIONS` (lacuna de teste) | `test_init.py` linhas 32-39 (6 serviços); `__init__.py` remove corretamente os 7 |
| B4 | `_saveSettings` chama `set_zone_options` mesmo sem nenhuma alteração | `card.ts` linha 610 (`data = {}`); sem side effect, mas chamada de serviço desnecessária |
| B5 | `reservoir_volume_l` é metadata-only (nunca consumido pelo backend) | `scheduler.py`/`FUNCTIONS.md` ("uso futuro"); documentar como informativo para não sugerir proteção inexistente |
| B6 | Config/options flow aceitam qualquer `sensor.*` como pH (selector do HA não filtra `device_class: ph`) | `config_flow.py` linhas 141-143/308-313; sem risco (fail-safe), mas UX enganosa |
| B7 | `add_schedule`/`set_schedules` podem criar ids duplicados (sem dedupe) | `__init__.py` `SCHEDULE_SCHEMA` aceita id opcional; `new_schedule` mantém id fornecido |
| B8 | `update_schedule`/`remove_schedule` com id inexistente são no-ops silenciosos | `scheduler.py` `async_update_schedule`/`async_remove_schedule` |
| B9 | Card formata o "próximo horário" no fuso do browser, que pode diferir do fuso do HA | `card.ts` `_nextRunText` (Intl do browser); exibição |
| B10 | Recovery resumido não rearma o actuation check (target que ficou off durante downtime não é detectado) | `scheduler.py` `_async_recover_state` arma só o stop timer |

---

## 3. Falsos positivos percebidos / pontos aprovados

- **Gate de pH restrito a agendados; `water_now` como override manual explícito** — correto por design e testado (`test_water_now_ignores_ph_gate`).
- **Timer de desligamento armado imediatamente após o `turn_on`, antes de qualquer verificação** — correto; sem janela de "válvula aberta sem timer".
- **Listener decide pelo estado atual (não pelo `new_state` do evento) + token de geração `_run_id` + janela de `ACTUATION_GRACE`** — correto; testado (stale off echo, device lento, nunca-atuante).
- **`turn_off` não confirmado preserva o store para restart recovery** — correto e testado.
- **`RuntimeStore` único compartilhado com `asyncio.Lock`** — correto; teste de duas zonas simultâneas passa.
- **`ph_entity_id=""` como valor explícito de desabilitação** (distinto de "não alterado" `None`) — correto e testado.
- **`update_schedule` preserva o id** (`merge_schedule_update` ignora `id`) — correto e testado.
- **Validação `ph_min > ph_max` na mesma chamada** — funciona; a lacuna real é o estado parcial (M2).
- **`"inf"`/`"-inf"` no gate de pH são bloqueados** — verificado em runtime (bloqueio correto).
- **Traduções `en`/`pt-BR` sincronizadas com `strings.json`** — 79/79 chaves, 0 faltando/sobrando.
- **`UpdateListenerType = Callable[[HomeAssistant, ConfigEntry], Coroutine]` no HA 2026.2.3** — assinatura do `_async_update_listener` confere.
- **`ha-switch` com `checked`/`change`** — API legada, mantida compatível no frontend do HA; sem quebra funcional esperada.
- **Sem regressões na cadeia de schedule/enabled/set_schedules com options corrompidas** — `test_corrupt_duration_options_fall_back_to_defaults` passa.

---

## 4. Testes executados

### Backend puro (venv `irr-venv`, sem HA)
| Comando | Resultado |
|---|---|
| `pytest tests/test_next_run.py tests/test_schedules.py -q` | **28 passed** |

### Backend + HA (venv `ha-venv`, HA 2026.2.3 + PHCC)
| Comando | Resultado |
|---|---|
| `pytest tests -q` | **77 passed** |

> **Barrreira de ambiente removida para a execução:** a suíte de integração falhava em
> setup (`FileNotFoundError` no `shutil.copy2` do `conftest.py`) porque o artefato
> buildado `custom_components/irrigation_scheduler/frontend/irrigation-schedule-card.js`
> estava como **placeholder cloud-only do OneDrive** (não legível localmente; `attrib`
> e `Test-Path` confirmam). Reconstruí o bundle a partir do fonte (`npm run build`) e
> verifiquei que o arquivo resultante é **byte-idêntico ao blob do HEAD**
> (`git hash-object` = `2ab75e4784c920c5e528d3b9888485e8fd328625` antes e depois) — a
> árvore de trabalho continua limpa. A causa é ambiental (OneDrive), não do código;
> `REVIEW.md`/`REVIEW-luna.md` já registravam 77 passed em execução anterior.

### Frontend (`frontend-src/`)
| Comando | Resultado |
|---|---|
| `npm run typecheck` | **0 erros** |
| `npm run test` | **63 passed** (2 arquivos) |
| `npm run build` | **OK** — bundle idêntico ao HEAD (determinístico) |
| `python -m compileall -q custom_components/irrigation_scheduler` + imports | **OK** |

### Testes adversariais adicionais (temporários, criados e removidos — sem rastro)
Confirmei em runtime, com mock do PHCC e o scheduler real:

| Cenário testado | Resultado |
|---|---|
| pH `"nan"`, `"NaN"`, `"NAN"` → rega agendada | **FALHA confirmada** — válvula abriu (bug C1) |
| pH `"inf"` / `"-inf"` | Bloqueado corretamente |
| Recovery com `duration: "abc"` no store | **FALHA confirmada** — `ValueError`, setup da zona aborta (bug A1) |
| Schedule com `duration: "not-a-number"` | **FALHA confirmada** — `ValueError` no `_async_schedule_fired`, cadeia de agendamento morre (bug M1) |
| `set_schedules` sem chave `schedules` | **FALHA confirmada** — exceção crua (KeyError) |
| `set_zone_options` parcial `ph_min=7.0` sobre `5.5..6.5` | **FALHA confirmada** — faixa invertida aceita silenciosamente (bug M2) |

O arquivo temporário `tests/integration/test_zz_adversarial_tmp.py` foi removido após a
execução; `git status` permanece limpo (apenas `REVIEW-luna.md` e `REVIEW-qwen37.md`
não rastreados, pré-existentes).

---

## 5. Divergência entre as revisões prévias

| Achado | Luna (`REVIEW-luna.md`) | Qwen37 (`REVIEW-qwen37.md`) | Esta revisão (empírico) |
|---|---|---|---|
| pH `nan` abre a válvula | CRÍTICO (estático) | "nenhum crítico" (não testou) | **CONFIRMADO** (CRÍTICO) |
| Recovery com duration corrompido | ALTO (estático) | B5 "teórico, baixo impacto" | **CONFIRMADO** (ALTO) — setup aborta |
| Duração de schedule corrompida mata agendamento | não destacado | não destacado | **CONFIRMADO** (MÉDIO) |
| Inversão parcial da faixa de pH | MÉDIO | não destacado | **CONFIRMADO** (MÉDIO) |
| Vazão por vaso ambígua | MÉDIO | não destacado | MÉDIO (concordo) |
| M1/M2/M3 (card visual, ALL_SERVICES, save vazio) | — | MÉDIA/BAIXA | Confirmados como BAIXO |

---

## 6. Comandos reproduzíveis

```powershell
# Backend puro
& "$env:TEMP\opencode\irr-venv\Scripts\python.exe" -m pytest tests/test_next_run.py tests/test_schedules.py -q

# Backend + HA (PHCC)
& "$env:TEMP\opencode\ha-venv\Scripts\python.exe" -m pytest tests -q

# Frontend
cd frontend-src
npm run typecheck; npm run test; npm run build
```

---

## 7. Conclusão

**PRECISA DE ALTERAÇÃO.** O núcleo do scheduler (segurança da válvula: timer imediato,
grace de atuação, token de geração, retry de turn_off, recovery fail-safe) está sólido e
bem testado, e o commit do pH gate está bem coberto — **exceto** que o requisito
fail-safe tem uma fuga real (`nan` abre a válvula, C1) e o mecanismo de recovery tem um
ponto de falha (A1) que pode deixar a válvula aberta sem defesa após um store corrompido.
Ambos são reproduzíveis e de baixo custo de correção. Os demais achados (M1-M3 e B1-B10)
são melhorias de robustez/UX sem risco físico. A correção de C1, A1 e M1 (com testes de
regressão adversarial) deve anteceder a aprovação; M2/B1 são recomendados na mesma leva.
