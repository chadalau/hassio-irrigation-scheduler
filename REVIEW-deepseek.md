# REVIEW-deepseek.md — Revisão adversarial independente (deepseek-v4-flash)

**Status final: PRECISA DE ALTERAÇÃO**
**Data:** 2026-08-12 · **Ambiente:** Windows, Python 3.14.5 (testes puros) + HA 2026.2.3/PHCC 0.13.316 no venv `%TEMP%\opencode\ha-venv` (Python 3.13.14), Node + TypeScript 5.6.3/Vitest 2.1.9/Rollup 4.

Revisão adversarial **independente** do estado atual do working tree (há alterações
não commitadas e arquivos novos: `tests/integration/test_history.py`,
`frontend-src/tests/editor.test.ts`, `tests/integration/test_ph_gate_r2.py`,
`tests/integration/test_review_fixes.py`). Não li nem alterei nenhum `REVIEW*.md`
existente e não alterei código de produção nem testes. Verificações adversariais
foram executadas a partir de arquivo temporário fora do workspace (removido em seguida).

---

## 1. Arquivos revisados

### Backend `custom_components/irrigation_scheduler/`
| Arquivo | Papel |
|---|---|
| `__init__.py` (497) | Setup, 7 serviços, frontend wiring, `_async_resolve_schedulers`, schemas voluptuous |
| `scheduler.py` (1606) | Motor de agendamento, lifecycle da rega, gate de pH R1/R2, restart recovery, history |
| `next_run.py` (198) | Cálculo puro do próximo horário (zero imports HA) |
| `schedules.py` (65) | Serialização / imutabilidade de id |
| `store.py` (141) | Persistência volátil (runtime + history, lock compartilhado) |
| `sensor.py` (156) | Sensor `next_run` + contrato de atributos do card (ids dos irmãos) |
| `switch.py` (73) | Switch `schedule_enabled` |
| `binary_sensor.py` (81) | Binary sensor `watering` + atributos de history |
| `config_flow.py` (467) | Config/options flow (durações, vazão, vasos, reservatório, pH/EC R1 e R2) |
| `const.py`, `manifest.json`, `services.yaml`, `strings.json`, `translations/{en,pt-BR}.json`, `frontend/irrigation-schedule-card.js` | Contratos e metadados |

### Frontend `frontend-src/`
`src/{card.ts (1566), editor.ts (78), utils.ts (368), types.ts (140), const.ts, styles.ts (661)}`,
`rollup.config.mjs`, `smoke.mjs`, `package.json`, `tsconfig.json`, `vitest.config.ts`,
`tests/{utils.test.ts, editor.test.ts, card.test.ts}`.

### Testes
`tests/{test_next_run.py, test_schedules.py, pure_loader.py}` e
`tests/integration/{conftest.py, test_init.py, test_services.py, test_recovery.py,
test_async_device.py, test_config_flow.py, test_frontend.py, test_ph_gate.py,
test_ph_gate_r2.py, test_history.py, test_review_fixes.py}`.

### Documentação/config
`README.md`, `FUNCTIONS.md`, `hacs.json`, `pytest.ini`, `requirements-test.txt`
(leitura leve; o foco foi código).

---

## 2. Achados por severidade

### MÉDIO

#### M1. Parada externa do alvo não é registrada no histórico
- **Arquivo:** `scheduler.py:930` (`history_actuated = self._async_target_is_actuated()`)
  e `scheduler.py:1016` (`if log_history and history_actuated ...`).
- **Cenário/evidência (reproduzido no harness PHCC):** durante uma rega, um ator externo
  desliga o alvo após a janela de grace. `_async_target_state_changed` chama
  `_async_finish_run(turn_off=False, remove_state=True)`. O guard `history_actuated` é
  avaliado **no instante do fim**, quando o alvo **já está off** → `history_actuated=False`
  → o run **não** é anexado ao history. A rega entregou água de verdade por um período
  real, mas a feature nova de histórico (e a linha "Última rega" / diálogo do card) perde
  o registro. Verificado: `history after external stop: []`.
- **Causa raiz:** o guard "nunca atuou" foi implementado como "estado atual no fim" e
  confunde "alvo nunca atuou" com "alvo atuou e foi desligado externamente". Nenhum teste
  existente pinna esse caminho (`test_external_target_off_finishes_run_without_duplicate_dispatch`
  não assere history).
- **Sugestão:** rastrear "atuou em algum momento" no run (ex.: flag setada quando
  `_async_target_is_actuated()` retorna True pela primeira vez, ou pelo actuation check) e
  usar essa flag no `history_actuated`; adicionar teste de parada externa + history.

#### M2. `async_save_entry` sem try/except no início do run pode deixar a zona travada em "Regando"
- **Arquivo:** `scheduler.py:780-808` (estado in-memory setado **antes** de
  `await self.store.async_save_entry(...)`, linha 793).
- **Cenário/evidência:** se o write do store falhar (I/O, disco cheio), a exceção
  propaga para o chamador do serviço com `_is_watering=True` já setado e **nenhum timer
  armado** (o stop timer e o actuation check são armados depois do turn_on bem-sucedido;
  o `try/except` cobre apenas `_async_call_target_service(True)`). A zona fica presa em
  "watering": `water_now`/firings agendados retornam cedo (`if self._is_watering: return`),
  e só um reload/restart limpa. O caminho de falha do turn_on é tratado ruidosamente
  (`_async_abort_run`), mas a falha de escrita do store não é.
- **Impacto:** zona inutilizável até reload; sem risco físico (nenhum turn_on foi
  enviado), mas é exatamente a classe de estado-travado que o resto do código se esforça
  para prevenir.
- **Sugestão:** envolver o save do store em try/except (como `_async_log_history`) ou
  reordenar para setar `_is_watering` somente após o save; garantir que o run vira
  `_async_abort_run` em qualquer falha antes do turn_on.

### BAIXO

| ID | Achado | Arquivo:linha / cenário | Evidência |
|---|---|---|---|
| B1 | Run retomado após restart perde o snapshot de pH/EC no history | `scheduler.py:1474-1482` (`_async_recover_state` restaura `_started_at/_finishes_at/_active_duration/_active_source/_active_schedule_id` mas **não** `_active_ph_value/_active_ec_value/_active_ec_unit/_active_ph_value_2/_active_ec_value_2/_active_ec_unit_2`). Quando o run retomado termina normalmente, `_async_finish_run` (linhas 918-923) loga `ph_value=None` etc., descartando o snapshot que `_async_start_run` havia persistido. O ramo "expirou durante downtime" passa `run_state` direto e está correto. | Confirmado no harness PHCC: store com `ph_value: 6.1`, run retomado termina → history `ph_value: None`. |
| B2 | `_prune_history` e recovery quebram com timestamp naive | `store.py:52` (`started_at < cutoff` compara naive com aware) e `scheduler.py:1407` (`finishes_at <= dt_util.utcnow()`). `parse_datetime` de string sem tz retorna naive; a comparação com `utcnow()` (aware) levanta `TypeError` (verificado no venv). Todos os writers atuais gravam ISO aware, então só um store legado/editado à mão/corrompido dispara — mas a proposta declarada do módulo é degradar defensivamente. | `naive < aware` → `TypeError: can't compare offset-naive and offset-aware datetimes`. |
| B3 | Store I/O sem try/except no fim de run | `scheduler.py:1014` (`await self.store.async_remove_entry(...)`). Se falhar, `_reschedule_next()` e `_async_dispatch_update()` não rodam → agendamento para silenciosamente até um options change/restart. Baixa probabilidade (arquivo local). | Inspeção do fluxo. |
| B4 | `_schedule_warnings` não é limpo quando o gate de pH é desabilitado | `scheduler.py:1206-1209` + `async_set_zone_options`. Aviso de "rega pulada" permanece no atributo `schedule_warnings` (e badge do card) mesmo após desabilitar o sensor via `set_zone_options`/options flow; só some no próximo fire bem-sucedido daquela schedule ou remoção. | Inspeção do fluxo. |
| B5 | Frontend: fechar o painel de settings pelo cog não reseta o estado do formulário | `card.ts:744-746` (`_openSettings` só inverte `_settingsOpen`; `_closeSettings`, que reseta `_settings*`/flags `Touched`, só é ligado ao botão "Fechar" e ao sucesso). Fechar pelo cog e reabrir mantém valores digitados e flags `Touched=True` → um "Salvar" posterior pode reenviar um campo que o usuário havia abandonado (ex.: `ph_entity_id` editado e depois descartado). | Inspeção do fluxo. |

### INFO

| ID | Achado |
|---|---|
| I1 | `card.ts:1314` (`_nextRunText`): estado do sensor `unavailable`/`unknown` renderiza "Nenhum horário agendado" — texto levemente enganoso (o correto seria "desconhecido"). |
| I2 | `utils.ts:321-336` (`dayLabelFor`/`groupHistoryByDay`) usam o fuso **do navegador**, enquanto `_nextRunText` usa o fuso **do servidor** (`hass.config.time_zone`). Inconsistência visível para um admin em fuso diferente (intencional por comentário, mas vale documentar). |
| I3 | `sensor.py:130` (`_async_registry_updated`) cria uma task com `async_create_task` a cada evento de registry da entry; inofensivo (tarefa curta), mas sem dedupe. |

---

## 3. Falsos positivos percebidos (verifiquei e descartei)

- **Store único compartilhado com lock** (`store.py`): correto e necessário; o teste de
  duas zonas simultâneas passa.
- **`_reschedule_next` em `finally` de `_async_schedule_fired`** e filtro de duration
  inválida em `schedules`: correto (defesa em profundidade; testado).
- **Timer de desligamento armado imediatamente após o turn_on + actuation check deferido**
  com `grace = min(ACTUATION_GRACE, duration)` e ordem de registro (check antes do stop):
  correto; corridas curtas resolvem bem (testado em `test_review_fixes.py` e
  `test_async_device.py`).
- **Listener decide pelo estado atual (não pelo evento) + token `_run_id` + supressão na
  janela de grace:** correto; testes de stale echo / slow device / nunca-atuante passam.
- **Turn_off não confirmado preserva o store (restart recovery):** correto; testes passam.
- **`ph_entity_id=""` explícito ≠ `None` (deixa inalterado)** em `set_zone_options` e no
  options flow (`.get(key, current)` em `config_flow.py:326-341`): correto — o bug antigo
  (apagar pH/EC ao salvar só durações) está corrigido e testado em
  `test_review_fixes.py::test_options_flow_preserves_ph_ec_when_keys_omitted`.
- **Alvo que atua após aborto por grace:** o caminho atual delega o turn_off para
  `_async_finish_run` com retry+confirmação e **preserva** o store se o off não for
  confirmado (safety net de restart) — o bug antigo (store removido incondicionalmente)
  está corrigido (`test_review_fixes.py::test_grace_abort_preserves_store_when_target_never_confirms_off`).
- **Rega que nunca atuou entrando no history:** corrigido — o guard `history_actuated`
  + `log_history=False` no actuation check impedem o registro fantasma (`test_review_fixes.py`).
- **`set_schedules` com ids duplicados / item não-dict / campo ausente:** corrigido e testado.
- **Domínio alvo não suportado:** `resolve_target_services` roda antes de qualquer mutação
  de estado em `_async_start_run` (linhas 766-768) — não deixa a zona travada (testado).
- **Abort com snapshot de pH/EC não limpo:** `_async_abort_run` limpa os 6 campos (testado).
- **DST (spring-forward/fall-back), traduções en/pt-BR vs strings.json/services.yaml:
  consistentes.**
- **`vol.Schema` com chaves extras:** o comentário em `__init__.py:172-174` foi corrigido
  para explicar o stripping de `_TARGET_KEYS`; o comportamento `ALLOW_EXTRA` (default) é
  intencional para aceitar os alvos injetados por HA — não é bug (apenas chaves de serviço
  desconhecidas viram no-op silencioso, aceitável).

---

## 4. Testes executados

### Backend puro (Python 3.14.5, pytest 9.1.1)
| Comando | Resultado |
|---|---|
| `python -m pytest tests/test_next_run.py tests/test_schedules.py -v` | **26 passed, 2 skipped** (DST — sem tzdata no Windows) |

### Backend + HA (venv `%TEMP%\opencode\ha-venv`, Python 3.13.14, HA 2026.2.3, PHCC 0.13.316)
| Comando | Resultado |
|---|---|
| `& "$env:TEMP\opencode\ha-venv\Scripts\python.exe" -m pytest tests/integration -q` | **93 passed** (12 arquivos, incluindo os 3 novos) |

### Frontend (`frontend-src/`)
| Comando | Resultado |
|---|---|
| `npm run typecheck` | **0 erros** |
| `npm test` (vitest) | **107 passed** (3 arquivos: utils 68, card 36, editor 3) |
| `npm run build` (rollup) | **OK** (regenerou `custom_components/.../frontend/irrigation-schedule-card.js`; artefato já era modificado no estado inicial — build determinístico) |

### Verificação adversarial própria (arquivo temporário em `%TEMP%\opencode`, fora do repo, removido após)
| Cenário testado | Resultado |
|---|---|
| Parada externa do alvo após o grace → history | **FALHA confirmada** — `history == []` apesar de a rega ter durado tempo real (M1) |
| Run retomado após restart termina → history pH/EC | **FALHA confirmada** — `ph_value` vira `None` no history apesar de o store ter `6.1` (B1) |
| Comparação naive vs aware em `parse_datetime` | **TypeError confirmado** (fundamenta B2) |

O workspace não foi alterado por esta revisão: nenhum arquivo de produção ou teste foi
tocado; o build do frontend regenerou o bundle (determinístico) e o `git status --short`
final é idêntico ao estado inicial (mesmos 4 untracked). O arquivo temporário de
verificação foi apagado.

---

## 5. Sugestões priorizadas

1. **M1 (`scheduler.py:930/1016`):** trocar o guard `history_actuated` (estado atual no
   fim do run) por um flag "atuou em algum momento durante o run"; adicionar teste de
   parada externa que assere o registro no history.
2. **M2 (`scheduler.py:793`):** garantir que falha de `async_save_entry` no início do run
   não deixe `_is_watering=True` sem timer (try/except + abort, ou reordenação do estado).
3. **B1 (`scheduler.py:1474-1482`):** restaurar os 6 campos de snapshot
   (`_active_ph_*`/`_active_ec_*`) a partir do `run_state` no ramo de resume.
4. **B2 (`store.py:52`, `scheduler.py:1407`):** normalizar com `dt_util.as_utc()` após
   `parse_datetime` antes de comparar com `utcnow()`.
5. **B5 (`card.ts:744`):** fazer o fechamento pelo cog também resetar o formulário de
   settings (ou reutilizar `_closeSettings`).
6. **B3/B4/I1-I3:** baixo custo; alinhar à política de robustez já adotada no restante.

---

## 6. Comandos reproduzíveis

```powershell
# Backend puro
python -m pytest tests/test_next_run.py tests/test_schedules.py -v

# Backend + HA (PHCC)
& "$env:TEMP\opencode\ha-venv\Scripts\python.exe" -m pytest tests/integration -q

# Frontend
cd frontend-src
npm run typecheck
npm test
npm run build
```

---

## 7. Conclusão

**PRECISA DE ALTERAÇÃO.**

O núcleo do scheduler está sólido: 226 testes passando (26 puros + 93 integração + 107
frontend), typecheck e build limpos, e as falhas das rodadas anteriores (gate de pH com
`nan`, options flow apagando pH/EC, alvo atuando após aborto por grace sem safety net,
history fantasma de run nunca-atuado, store removido sem confirmação de off) foram
**corrigidas e pinadas por testes de regressão**. Esta revisão, porém, confirmou em
runtime **dois defeitos novos na feature de histórico** recém-adicionada: (M1) uma parada
externa do alvo faz o run inteiro desaparecer do history (guard de atuação avaliado no
instante do fim, quando o alvo já está off), e (B1) um run retomado após restart loga
`ph_value/ec_value` como `None`, descartando o snapshot persistido. Há ainda o risco
robusto (M2) de uma falha de I/O do store no início do run deixar a zona travada em
"Regando" sem timer. Nenhum achado é crítico de segurança (nenhum deles deixa a válvula
aberta fisicamente), mas M1 e B1 comprometem a integridade do histórico que é a feature
central desta rodada — recomenda-se corrigi-los com testes de regressão antes de aprovar.
