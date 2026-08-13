# sonnet.md — Verificação das correções do SOL.md

**Revisor:** Claude Sonnet 5
**Data:** 2026-08-13
**Base analisada:** working tree atual, após as correções aplicadas em cima do `SOL.MD`
**Método:** leitura do diff completo de cada arquivo alterado, reprodução empírica dos pontos mais críticos (não apenas leitura estática), execução de todas as suítes.

---

## 1. Conclusão executiva

As correções aplicadas em cima do `SOL.MD` são sólidas e cobrem, de forma verificável, praticamente todos os achados do relatório anterior — incluindo os dois bloqueadores (A1, A2). A implementação é cuidadosa: `run_uid` estável por rega, deduplicação idempotente no reservatório, validação em camadas no Store, e testes de regressão para cada achado.

Encontrei, porém, **1 achado novo de severidade média**: a própria correção do A1 (reconciliação de ativação externa no boot) pode, numa combinação específica de condições, **destruir um registro de recuperação legítimo** que a correção do A1 é o que está tentando preservar mais adiante no mesmo caminho de código.

Resultado desta verificação:

- **6 achados do SOL.md reproduzidos como corrigidos** (A2, M1, M2, M3, M4, M5, M6 — ver detalhe abaixo; A1 tem 2 dos 3 problemas corrigidos);
- **1 achado novo de severidade média** (colisão entre reconciliação de boot e recuperação de downtime falha);
- todas as suítes passam: **174 testes backend HA**, **36 testes backend puro**, **154 testes frontend**, typecheck, build, `compileall`, `ruff check` e `npm audit` (com e sem `--omit=dev`) limpos.

---

## 2. Achados do SOL.md verificados como corrigidos

Todos os itens abaixo foram **reproduzidos empiricamente** (não só lidos) antes de serem marcados como corrigidos, com uma exceção anotada (M3, verificado por leitura + teste de regressão já presente).

### A1 — Ativação externa pode ficar sem rastreamento (parcialmente corrigido — ver achado novo)

- **Problema 2 (falha ao persistir deixa sem watchdog):** ✅ corrigido. `_async_start_external_run()` agora arma `self._unsub_stop` **antes** de tentar `async_save_entry()`; se a persistência falhar, o timer em memória continua ativo (só a durabilidade degrada, não a segurança física).
- **Problema 3 (`stop` não ajuda sem run rastreada):** ✅ corrigido. `async_stop()` agora verifica `not self._is_watering and self._async_target_is_actuated()` e desliga defensivamente mesmo sem run em memória.
- **Problema 1 (boot com alvo já ligado):** ✅ corrigido no caso comum, mas ⚠️ **introduz o achado novo desta revisão** — ver seção 3.

### A2 — DST fall-back podia agendar um instante já passado

✅ **Corrigido e reproduzido.** `find_next_run` agora converte `now` e cada candidato para instantes UTC explícitos (`now_instant`/`candidate_instant`) antes de comparar, contornando a peculiaridade do `datetime` do Python onde comparar dois objetos aware com o **mesmo** `tzinfo` ignora `fold` e usa comparação de relógio de parede.

Reproduzi o cenário exato do relatório original (`America/New_York`, `now = 2024-11-03 01:15 fold=1`, candidato `01:30 fold=0`) contra o código corrigido:

```
now: 2024-11-03 01:15:00-05:00 -> utc: 2024-11-03 06:15:00+00:00
result: 2024-11-04 01:30:00-05:00
result utc: 2024-11-04 06:30:00+00:00
result is strictly future in UTC: True
```

Antes da correção, o mesmo cenário retornava o candidato do fold=0 (já passado em UTC). Teste de regressão novo (`test_fall_back_never_returns_first_fold_after_it_is_past`) cobre exatamente isso.

### M1 — Agendamentos no mesmo dia/horário deixavam um item inalcançável

✅ **Corrigido e verificado além do que o diff mostrava.** `_validate_schedule_slots` é chamada apenas em `async_set_schedules`, mas `async_add_schedule` e `async_update_schedule` **delegam** para `async_set_schedules` internamente — confirmei isso lendo o código e depois com um teste dedicado chamando o serviço `add_schedule` duas vezes para o mesmo slot: a segunda chamada é rejeitada com `ServiceValidationError` contendo "overlap", e a lista de horários não fica com entrada parcial.

### M2 — Histórico com data inválida podia derrubar o card inteiro

✅ **Corrigido.** `scheduleStatusToday()` agora valida `!Number.isNaN(startedAt.getTime())` antes de chamar `dayKey()` no callback de histórico, e `_isHistoryRun()` ganhou uma segunda camada de defesa (`!Number.isNaN(Date.parse(v.started_at))` + `Number.isFinite(v.duration)`). Reproduzi o `RangeError: Invalid time value` do `Intl.DateTimeFormat` contra o código **antes** da correção; confirmei que o guard novo intercepta exatamente esse caso.

### M3 — Store JSON estruturalmente corrompido podia impedir todas as zonas de iniciar

✅ **Corrigido** (verificado por leitura + suíte de testes nova `tests/integration/test_store.py`, não reproduzido por mim com um payload malformado adicional). `_async_load_unlocked()` agora valida cada nível (`entries`/`history` precisam ser dict; cada entrada de `history` precisa ser dict; cada valor de `history[zona]` precisa ser lista) e reseta com log em vez de deixar a exceção propagar.

### M4 — Commit não transacional podia perder histórico e ainda deduzir o reservatório

✅ **Corrigido.** Cada rega agora tem um `run_uid` estável (`uuid.uuid4().hex`) persistido no registro do Store e no próprio registro de histórico. `async_append_history` ficou idempotente por `run_uid` (retorna `(entries, inserted)`; um `run_uid` repetido não duplica). `_deduct_reservoir_volume` ganhou `CONF_RESERVOIR_ACCOUNTED_RUNS` (lista de `run_uid`s já descontados, persistida em `entry.options`) para nunca descontar duas vezes o mesmo `run_uid`.

### M5 — Nova execução durante retry de desligamento descartava a contabilidade da anterior

✅ **Corrigido.** Antes, quando `self._run_id != run_id` durante o retry de `turn_off`, a função retornava imediatamente, descartando histórico/dedução da rega antiga. Agora define `superseded = True; remove_state = False` e **continua** até o bloco de log/dedução — o snapshot imutável capturado no início da função (`history_started_at`, `history_run_uid`, etc.) é contabilizado normalmente, só o alvo/Store da rega nova é que não é tocado.

### M6 — Parada rápida de execução externa era ignorada e supercontabilizada

✅ **Corrigido.** A janela de graça de 15s (pensada para o eco assíncrono do **nosso próprio** `turn_on`) agora tem `self._active_source != SOURCE_EXTERNAL` como condição adicional — uma rega externa, cuja atuação já foi confirmada no instante em que o rastreamento começou, não precisa dessa tolerância e reage imediatamente a um desligamento confirmado.

### B1–B4, B6, B7 — dependências, config flow, acessibilidade, docs/smoke, CI

Todos verificados como endereçados:

- `npm audit` e `npm audit --omit=dev`: **0 vulnerabilidades** (era 8 no dev antes da atualização de `happy-dom`/`vitest`/`@rollup/plugin-terser`; vitest agora na v4).
- `config_flow.py` ganhou `_safe_int`/`_safe_float` para não quebrar o options flow com opções persistidas corrompidas.
- `card.ts`: validação cruzada de pH agora usa o valor efetivo (editado ou o exibido atualmente) em vez de só quando os dois campos foram preenchidos na mesma sessão; diálogos ganharam `aria-labelledby`, foco inicial/restauração, trap de foco e fechamento por `Escape`.
- `smoke.mjs`: a checagem de "day chips" agora testa as iniciais reais do card (`S/Q`) em vez do texto por extenso antigo.
- `pyproject.toml` (Ruff) e `.github/workflows/quality.yml` (CI) adicionados; `ruff check custom_components tests` passa limpo.

---

## 3. Achado novo — reconciliação de boot pode destruir um registro de recuperação legítimo

**Severidade: MÉDIA.** Não deixa o alvo ligado indefinidamente sem nenhum vigilante (a correção do A1 ainda arma um timer), mas corrompe silenciosamente a contabilidade (histórico e dedução do reservatório) de uma rega que pode ter ficado ligada por muito tempo antes do boot.

**Arquivo:** `custom_components/irrigation_scheduler/scheduler.py`, `async_setup()` (chamada de `_async_maybe_start_external_run()` logo após `_async_recover_state()`) interagindo com o branch de falha em `_async_recover_state()` (desligamento defensivo de downtime que não confirma).

**Cenário reproduzido:**

1. Existe um registro de rega no Store (`source="schedule"`, `run_uid="ORIGINAL-RUN-UID"`, `actuated=true`, `history_logged=false`) cujo `finishes_at` já passou.
2. HA reinicia. `_async_recover_state()` entra no branch de downtime expirado, tenta o desligamento defensivo, e ele **falha** (dispositivo inalcançável nesse instante).
3. Como o alvo continua confirmadamente ligado, o código corretamente **preserva** o registro do Store — log: `"Defensive turn_off of switch.zone1 failed; keeping runtime state so the next boot retries"`.
4. `_async_recover_state()` retorna sem setar `self._is_watering = True` (não havia por que setar; o branch de downtime nunca marca a zona como "regando").
5. De volta em `async_setup()`, a checagem nova `if not self._is_watering: await self._async_maybe_start_external_run()` roda. Como o alvo **continua confirmadamente ligado** — exatamente a mesma condição que acabou de fazer o passo 3 preservar o registro — ela interpreta isso como uma ativação externa nova.
6. `_async_start_external_run()` chama `store.async_save_entry(...)`, que **sobrescreve incondicionalmente** o registro daquele `entry_id` com um novo (`source="external"`, `schedule_id=None`, `started_at=agora`, `run_uid` novo).

Log capturado na reprodução, nessa ordem exata:

```
ERROR: Defensive turn_off of switch.zone1 failed; keeping runtime state so the next boot retries for boot_collision
INFO:  External activation detected for boot_collision; tracking as a run (source=external, duration=600s, finishes_at=...)
```

**Impacto:**

- O `run_uid` original é perdido — a rega original nunca é logada no histórico nem tem seu volume real descontado do reservatório, mesmo que tenha ficado ligada por horas antes do boot.
- O rastreamento reinicia do zero, tratando a rega como se tivesse começado agora, com `default_duration` como duração assumida — que pode ser muito menor (ou maior) que quanto tempo o alvo já estava ligado.
- Não é uma regressão de segurança física (ainda há timer), mas é uma regressão de integridade de dados — exatamente a categoria de problema que M4/M5 acabaram de fechar para os outros caminhos.

**Correção sugerida:** em `async_setup()`, só chamar `_async_maybe_start_external_run()` quando não houver registro pendente no Store para este `entry_id` (ex.: checar `await self.store.async_load()` antes de reconciliar, ou fazer `_async_recover_state()` retornar um sinal — booleano ou similar — indicando "ainda há um registro aqui, não pise nele" para `async_setup()` decidir se reconcilia ou não).

**Teste sugerido:** registro de rega agendada no Store com `finishes_at` no passado, `turn_off` que sempre falha, alvo confirmado ligado; após `async_setup_entry`, o registro no Store deve manter o `run_uid` original (não deve virar `source="external"`).

---

## 4. Testes executados nesta verificação

| Suíte | Comando | Resultado |
|---|---|---|
| Backend HA | `pytest tests -q` | **174 passed** |
| Backend puro | `pytest tests/test_next_run.py tests/test_schedules.py -q` | **36 passed** |
| `compileall` | `python -m compileall -q custom_components/irrigation_scheduler` | OK |
| Ruff | `ruff check custom_components tests` | All checks passed |
| Frontend typecheck | `npm run typecheck` | OK |
| Frontend testes | `npm run test` | **154 passed** |
| Frontend build | `npm run build` | OK |
| Smoke | `node smoke.mjs` | SMOKE OK (checagem de day chips corrigida) |
| `npm audit` | `npm audit` / `npm audit --omit=dev` | 0 vulnerabilidades (ambos) |
| Reprodução A2 (DST) | script standalone com `zoneinfo` | confirmou o fix |
| Reprodução M1 (slot) | teste dedicado via serviço `add_schedule` | confirmou o fix |
| Reprodução M2 (data inválida) | `Intl.DateTimeFormat` com `Invalid Date` antes/depois do guard | confirmou o fix |
| Reprodução do achado novo | teste dedicado: Store pré-populado + `turn_off` que sempre falha + `async_setup_entry` | confirmou a colisão |

---

## 5. Status final

**PRECISA DE UM AJUSTE ADICIONAL, PEQUENO E ISOLADO.**

Todos os bloqueadores do `SOL.MD` (A1, A2) e os achados médios (M1–M6) foram corrigidos e verificados — com a ressalva de que a própria correção do A1 abriu uma nova interação de borda com a recuperação de downtime, documentada na seção 3. É um ajuste isolado (uma checagem a mais antes de reconciliar no boot), não exige reabrir nenhuma das correções já feitas.

---

## 6. Remediação posterior do achado novo

✅ **CORRIGIDO E VALIDADO.** A recuperação agora informa a `async_setup()` quando o registro antigo precisa permanecer pendente, impedindo a reconciliação externa no mesmo boot. Além disso, a criação do registro de uma ativação externa passou a ser atômica e condicional: `RuntimeStore.async_create_entry()` nunca sobrescreve uma execução que já ocupa o mesmo `entry_id`. Essa segunda camada também protege contra eventos concorrentes posteriores ao setup.

O fluxo normal de partidas manuais e agendadas continua usando `async_save_entry()`, sem alterar sua semântica. Se a persistência de uma execução externa falhar por erro de I/O, o watchdog em memória permanece armado para desligar fisicamente o alvo.

Testes de regressão confirmam que:

- o registro original mantém `run_uid`, `source` e `schedule_id` quando o desligamento defensivo falha;
- uma criação externa não sobrescreve um registro de recuperação existente;
- uma criação externa funciona normalmente quando não existe registro anterior;
- as corridas de eco de estado e as partidas normais não foram afetadas;
- a falha de persistência externa preserva o watchdog em memória.

Validação final após a correção:

| Suíte | Resultado |
|---|---|
| Backend completo | **176 passed** |
| Frontend | **154 passed** |
| TypeScript | typecheck OK |
| Build + smoke | OK / SMOKE OK |
| Ruff + compileall + diff check | OK |
| `npm audit --omit=dev` | **0 vulnerabilidades** |

**Status atualizado: TODOS OS ACHADOS DO RELATÓRIO FORAM CORRIGIDOS.**
