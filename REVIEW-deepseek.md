# REVIEW-deepseek.md — Revisão adversarial independente (2026-08-13)

Revisão adversarial completa do working tree de `watergaia` (estado atual, com
alterações não commitadas). Backend, frontend e testes revisados. Nenhum
arquivo de produção nem de teste foi alterado. O `npm run build` regenerou
`custom_components/irrigation_scheduler/frontend/irrigation-schedule-card.js`
(artefato buildado — etapa obrigatória da bateria de testes do frontend). Não
foram lidos nem alterados os demais `REVIEW-*.md`.

---

## Arquivos revisados

**Backend (`custom_components/irrigation_scheduler/`):**
`__init__.py`, `scheduler.py`, `schedules.py`, `next_run.py`, `store.py`,
`switch.py`, `sensor.py`, `binary_sensor.py`, `config_flow.py`, `const.py`,
`manifest.json`, `frontend/irrigation-schedule-card.js` (bundle buildado).

**Frontend (`frontend-src/`):**
`src/card.ts`, `src/editor.ts`, `src/utils.ts`, `src/styles.ts`, `src/types.ts`,
`src/const.ts`, `tests/card.test.ts`, `tests/editor.test.ts`, `tests/utils.test.ts`,
`package.json`, `tsconfig.json`, `vitest.config.ts`, `rollup.config.mjs`, `smoke.mjs`.

**Testes:**
`tests/test_next_run.py`, `tests/test_schedules.py`, `tests/pure_loader.py`,
`tests/integration/conftest.py` e os 15 arquivos `test_*.py` de integração.

**Diff não commitado analisado:**
`const.py` (SOURCE_EXTERNAL), `manifest.json` (v0.10.0), `scheduler.py`
(ativação externa + warnings de falha de atuação), `card.ts`/`utils.ts`
(ícones/status "done/pending/warning", fonte externa), `styles.ts`,
`tests/card.test.ts`/`utils.test.ts`, `tests/integration/test_external_activation.py`
e `test_target_failure_warnings.py` (novos, não commitados).

---

## Verificação do achado da rodada anterior (editor visual)

**FIXED — `frontend-src/src/editor.ts:71-85`**
`_valueChanged` agora lê `ev.detail.value` (a config completa consolidada pelo
`ha-form`), não mais `ev.detail.name`:

```ts
const value = (ev.detail as { value?: Record<string, unknown> } | undefined)?.value;
...
const config = { ...this._config, ...value } as CardConfig;
this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, ... }));
```

- Evidência no bundle buildado: `_valueChanged(t){const e=t.detail?.value;if(!e||!this._config)return;...dispatchEvent(new CustomEvent("config-changed",...))}`.
- Teste de regressão: `frontend-src/tests/editor.test.ts:66-112` (dispara
  `value-changed` com `detail.value` e assere `config-changed` com a config
  mesclada) — passa.
- Sem remanescentes de `detail.name` em código (apenas em comentários
  explicativos nas linhas 65-67).

---

## Achados por severidade

### BAIXA

**1. `scheduler.py:1102-1170` (+ `1183-1195`) — corrida pode descartar o histórico de uma rega concluída**

Cenário: em `_async_finish_run`, dentro do laço de retry do turn_off há
`if self._run_id != run_id: return` (linhas 1107-1113, e novamente em 1165-1170)
**antes** de `_async_log_history` (linhas 1183-1195). Se uma rega NOVA começa
durante o backoff de 1s (`_async_wait(TURN_OFF_RETRY_DELAY)`) — p.ex. uma
ativação externa que executa `_async_start_external_run` e faz `self._run_id += 1`
— o `return` dispara e a rega antiga (que já tinha `history_actuated = True`
capturado) NUNCA é gravada no histórico, nem deduz o reservatório.

Evidência: a proteção é deliberada e correta para não desligar o alvo da rega
nova, mas a perda de histórico/dedução é efeito colateral não tratado. Janela
estreita (~1s por tentativa), requer evento externo/novo disparo exatamente nessa
janela. Nenhum teste cobre o interleave.

**2. `scheduler.py:1614-1622` — rega externa interrompida dentro do ACTUATION_GRACE é ignorada e super-contabilizada**

Cenário: para uma rega EXTERNA o alvo já está confirmadamente ON quando o
rastreio começa. Se o próprio ator desliga o alvo dentro dos primeiros 15s
(`grace = min(ACTUATION_GRACE, _active_duration)`), o evento é tratado como
"eco obsoleto" e ignorado. A rega segue "Regando" até `finishes_at`, registrando
no histórico a duração COMPLETA de `default_duration` e deduzindo o volume
inteiro do reservatório, embora o dispositivo tenha ficado desligado quase o
tempo todo. Para regas agendadas a justificativa de "echo assíncrono" é forte;
para regas externas (alvo confirmadamente ON) a mesma regra é fraca. Sem teste
cobrindo "external run parado dentro do grace".

**3. `scheduler.py:577-588` (`async_setup`) — detecção de ativação externa é só orientada a eventos; sem varredura no boot**

Cenário: o listener de estado é registrado em `async_setup`, mas nada verifica se
o alvo JÁ está atuado na inicialização. Se o dispositivo foi ligado enquanto o HA
estava fora (ou antes de o listener ser registrado) e nenhum evento de mudança
disparar depois, a rega externa nunca é rastreada → sem stop timer. Com nenhum
horário configurado, o dispositivo pode permanecer ligado indefinidamente. O HA
dispara eventos de estado restaurado no boot, mas o listener só os captura se
estiver registrado a tempo — depende da ordem de carregamento das plataformas
(instável). Destoa da filosofia fail-safe do restante do código (retenção do
store, turn_off defensivo).

### INFORMATIVO

**4. `card.ts:966-979` — validação cruzada de pH no cliente é mais fraca que a do backend**

Cenário: o guard `ph_min > ph_max` só dispara quando AMBOS parseiam como válidos
(`validMin && validMax`). Se o usuário editar apenas `ph_min` acima do `ph_max`
já armazenado (o campo não tocado exibe o valor atual mas parseia NaN), o
frontend envia e o backend rejeita com `ServiceValidationError` claro, exibido no
painel. Aceitável (o erro aparece), mas o cliente poderia validar contra os
valores exibidos (fallback). Mesmo comportamento para R2.

**5. `card.ts:352-357` — comentário desatualizado/ambíguo sobre a linha R2**

O comentário afirma que a linha R2 é "puramente do pH/EC próprio, sem fallback de
reservatório", mas `_renderReservoirRow` recebe `volumeBadge/estimateBadge/
refillButton` também para R2 (e o teste `card.test.ts:601-616` assere o badge de
volume repetido nas duas linhas). O comentário refere-se à *visibilidade* da
linha (`showRow2` ignora `reservoir_volume_l`), não ao conteúdo dos badges — lê-se
como contradição.

**6. `frontend-src/smoke.mjs:62` — asserção de smoke morta**

`text.includes("Seg") && text.includes("Qua")` sempre imprime `false` (o card
renderiza iniciais de um caractere, não as abreviações completas). É meramente
informativa (não entra na condição de `throw`), mas engana quem lê a saída.

---

## Falsos positivos (testados e refutados)

**1. `config_flow.py:67-70` e `300-303` — suspeita de crash `float(None)` em campo pH opcional**

Suspeita: `float(user_input.get(CONF_PH_MIN, DEFAULT_PH_MIN))` lançaria TypeError
se o usuário limpasse o campo numérico (selector BOX envia `null`). **REFUTADO
empiricamente**: no runtime HA 2026.2.3 suportado, `data_entry_flow` valida o
`user_input` contra o `data_schema` ANTES de chamar o step handler; `None` para o
NumberSelector é rejeitado com `InvalidData` (o form é re-renderizado com erro de
validação) e o `float(None)` nunca é alcançado. Probe executado com o harness HA
(1 teste passou; arquivo temporário em `%TEMP%\opencode`, removido).

**2. `card.ts:358-415` — reservatório/refill sumiriam se apenas R2 fosse configurado**

Checado: `showRow1 = Boolean(phEntityId || ecEntityId || reservoirVolume > 0)`
faz a linha R1 renderizar os controles de volume mesmo sem pH/EC R1; o design se
sustenta (badge de volume aparece na linha R1). Não é bug.

---

## Testes executados

| Suite | Comando | Resultado |
|---|---|---|
| Backend puro | `%TEMP%\opencode\irr-venv\Scripts\python.exe -m pytest tests/test_next_run.py tests/test_schedules.py -q` | **35 passed** |
| Backend HA | `%TEMP%\opencode\ha-venv\Scripts\python.exe -m pytest tests -q` | **164 passed** (rodado 2×, antes e depois do build do frontend) |
| Frontend typecheck | `npm run typecheck` | **ok** (sem erros) |
| Frontend tests | `npm run test` | **153 passed** (3 arquivos) |
| Frontend build | `npm run build` | **ok** (bundle regenerado) |
| Smoke do bundle | `node smoke.mjs` | **SMOKE OK** (registro do card/editor, render, watering, config-error) |
| Probe adversarial (config flow pH=None) | pytest + harness HA, arquivo temporário | **1 passed** (refuta o crash; arquivo removido) |

Total: **352 testes passando** (35 + 164 + 153) + typecheck/build/smoke OK.

---

## Status final

**APROVADO**

- O achado da rodada anterior (editor visual lendo `ev.detail.name` em vez de
  `ev.detail.value`) está **CORRIGIDO**, verificado no fonte, no bundle buildado
  e no teste de regressão dedicado.
- Nenhum achado de severidade alta ou média confirmada; os 4 achados de
  severidade baixa e os 3 informativos não bloqueiam a aprovação.
- Todas as suítes passam no working tree atual, incluindo as duas novas
  suítes de integração não commitadas (ativação externa e warnings de falha de
  atuação).
- Recomendações para rodadas futuras (não bloqueantes): tratar a corrida que
  descarta histórico em `_async_finish_run`, reconsiderar o grace para regas
  externas, e considerar uma varredura de alvo já atuado no boot.
