# REVIEW-deepseek.md — Revisão adversarial independente (2026-08-16)

Modelo: `opencode-go/deepseek-v4-flash`. Revisão completa do working tree atual de `watergaia`,
com foco nas mudanças não commitadas. Nenhum arquivo de produção nem de teste do repositório
foi alterado (o `npm run build` regenerou o bundle — etapa obrigatória da bateria — e o
resultado é byte-idêntico ao que já estava no working tree). Não foram lidos nem alterados os
demais `REVIEW-*.md`.

---

## Arquivos revisados

**Backend (`custom_components/irrigation_scheduler/`):**
`__init__.py`, `scheduler.py`, `schedules.py`, `next_run.py`, `store.py`, `switch.py`,
`sensor.py`, `binary_sensor.py`, `config_flow.py`, `const.py`, `manifest.json`,
`frontend/irrigation-schedule-card.js` (bundle buildado).

**Frontend (`frontend-src/`):**
`src/card.ts`, `src/editor.ts`, `src/utils.ts`, `src/styles.ts`, `src/types.ts`, `src/const.ts`,
`tests/card.test.ts`, `tests/editor.test.ts`, `tests/utils.test.ts`, `rollup.config.mjs`,
`smoke.mjs`, `vitest.config.ts`, `package.json`.

**Testes:** `tests/test_next_run.py`, `tests/test_schedules.py`, `tests/pure_loader.py` e os
arquivos em `tests/integration/`.

**Diff não commitado analisado (`git diff` + `git status`):**
`FUNCTIONS.md` (docs), `frontend-src/src/card.ts` (+99/−…), `frontend-src/src/styles.ts`
(+179/−…), `manifest.json` (0.11.1 → 0.11.6), bundle `irrigation-schedule-card.js`
(reconstruído a partir do fonte), e `plano.md` (não rastreado — documento da integração-irmã
`light_scheduler`, sem código).

---

## Achados por severidade

### CRITICO

Nenhum achado reproduzível.

### ALTO

Nenhum achado reproduzível.

### MEDIO

1. **Sem cobertura de teste para o novo toggle (a mudança de comportamento mais visível do diff).**
   - **Arquivo/linha:** `frontend-src/src/card.ts:374-391` (master toggle), `:635-645`
     (schedule toggle), `:1552-1583` (handlers).
   - **Cenário/evidência:** A suite frontend (155 testes) não exercita em nenhum ponto
     `_toggleMaster`, `_toggleScheduleEnabled`, os atributos `role="switch"`/`aria-checked`
     nem o mapeamento clique→serviço (`grep` em `frontend-src/tests` retorna zero referências).
     A inversão de estado é **correta** (verificado empiricamente — veja Testes executados),
     mas nada no repositório a protege contra regressão. Ex.: se alguém reintroduzir
     `currentlyOn ? "turn_on" : "turn_off"`, nenhum teste falha.
   - **Correção sugerida:** adicionar testes de card para: clique no master toggle ON → espera
     `switch.turn_off` no `switch_entity_id`; clique em OFF → `switch.turn_on`; clique no toggle
     de horário habilitado → `update_schedule {id, enabled:false}`; horário desabilitado →
     `enabled:true`; e renderização do botão `disabled` quando `switch_entity_id` é `null`.

### BAIXO

2. **Alvo de toque/clique do `.toggle` é pequeno (34×12px).**
   - **Arquivo/linha:** `frontend-src/src/styles.ts:368-379`.
   - **Cenário/evidência:** o botão tem 34×12px com thumb de 20px; a área clicável é exatamente
     o botão (sem padding/touch-target invisível). O `ha-switch` substituído mantinha um
     touch-target material maior. Não há estado `:hover`/`:active` (só `:focus-visible`).
     Em telas touch isso é um alvo pequeno (~12px de altura efetiva na vertical).
   - **Correção sugerida:** aumentar a altura efetiva via `::before` esticado ou
     `padding-block` transparente mantendo a estética de trilho de 12px; adicionar feedback
     `:hover`.

3. **`text-overflow: ellipsis` em `.watering-left` é CSS morto (não gera reticências).**
   - **Arquivo/linha:** `frontend-src/src/styles.ts:281-288` + `card.ts:452-459`.
   - **Cenário/evidência:** `.watering-left` é um flex container com `overflow: hidden`,
     `text-overflow: ellipsis`, `white-space: nowrap`, mas o texto ("Regando · ativada no
     dispositivo") está dentro de um `<span>` filho que é um flex item — a elipse só seria
     desenhada se o overflow acontecesse no próprio container. Na prática o texto longo é
     cortado sem reticências em cards estreitos. Cosmético (o `overflow:hidden` evita quebra
     de layout), sem impacto funcional.
   - **Correção sugerida:** aplicar `overflow:hidden; text-overflow:ellipsis;
     white-space:nowrap` ao `<span>` interno (ou dar `min-width:0` a ele).

### INFORMATIVO

4. **`manifest.json`: versão 0.11.1 → 0.11.6 (pulo de 0.11.2..0.11.5).**
   - **Arquivo/linha:** `custom_components/irrigation_scheduler/manifest.json:16`.
   - **Cenário/evidência:** `git log -p` do manifest e `git tag` confirmam que não existem
     commits nem tags `v0.11.2`..`v0.11.5` neste repositório (histórico: 0.1.0 → 0.2.0 →
     0.8.1 → 0.8.2 → 0.11.0 → 0.11.1 → 0.11.6 no working tree). O pulo é inofensivo em runtime
     (a versão do manifest não valida nada no carregamento). Para HACS, porém, o "instalado"
     (0.11.6) pode superar o "último release" se não houver tag/release v0.11.6 no GitHub —
     usuários não receberiam aviso de atualização. Recomenda-se publicar o release v0.11.6
     junto com este commit (ou usar a próxima versão de release real).

5. **Inconsistência de `aria-label` entre os dois toggles.**
   - **Arquivo/linha:** `card.ts:378-379` (master: descreve ESTADO "Agendamento ativo/
     desativado") vs `card.ts:639-640` (schedule: descreve AÇÃO "Desativar horário/Ativar
     horário"). Ambas as convenções são aceitáveis em ARIA, mas a mistura no mesmo card é
     incoerente para leitores de tela.

6. **Nota de ambiente: escritas concorrentes no working tree durante a revisão.**
   - `REVIEW-luna.md` e `REVIEW-qwen37.md` apareceram como "modified" entre duas execuções de
     `git status` — outro(s) processo(s) de revisão gravando em paralelo. Não afeta código: os
     arquivos revisados (`card.ts`, `styles.ts`, `manifest.json`, `FUNCTIONS.md`, bundle)
     tiveram diffs byte-estáveis durante toda a sessão (verificado por `git diff --stat`
     repetido).

7. **`plano.md` (não rastreado): os mockups usam a linguagem visual ANTIGA do card de água**
   (botões circulares "+"/"▶", linhas 89 e 107-111), enquanto `FUNCTIONS.md:752` afirma que o
   novo `.add-schedule-button` (largura total) "empresta o visual do irmão light_scheduler".
   Contradição só entre documentos (o plano é apenas documento, sem código); vale alinhar o
   mockup quando o light_scheduler for implementado.

---

## Falsos positivos (suspeitas testadas e refutadas)

- **`CheckableElement` virou dead code com a remoção do `ha-switch`.** Refutado:
  `frontend-src/src/card.ts:1718` ainda o usa em `_toggleDay` para os checkboxes de dias.
- **Assinatura antiga ainda usada em algum teste/caller.** Refutado: `grep` por
  `_toggleMaster|_toggleScheduleEnabled|ha-switch` em fonte, bundle, testes e docs retorna só
  as chamadas novas. Nenhum teste usa `(ev: Event)`.
- **Inversão de estado do toggle master/schedule incorreta.** Refutado empiricamente:
  harness descartável com 7 casos (veja Testes) — ON→`switch.turn_off`, OFF→`switch.turn_on`,
  schedule habilitado→`update_schedule enabled:false`, desabilitado→`enabled:true`, botão
  `disabled` com `switch_entity_id: null`, barra "restantes"/dot/botão Parar→`stop`. 7/7 OK.
- **`aria-checked` com booleano renderiza atributo inválido.** Refutado: Lit converte
  `aria-checked=${false}` para `aria-checked="false"` (string), confirmado por
  `getAttribute("aria-checked")` no harness.
- **Bundle fora de sincronia com o fonte.** Refutado: `npm run build` produziu hash SHA-256
  idêntico ao bundle já presente no working tree (idempotente), e `node smoke.mjs` passa
  ("SMOKE OK") — o CI já valida isso com `git diff --exit-code` no bundle.
- **`_toggleMaster` pode crashar com switch ausente.** Refutado: o closure captura o objeto da
  entidade no momento do render (snapshot), e sem entidade o card renderiza o botão `disabled`
  (sem handler). Primeira tentativa de teste falhou por BUG DO HARNESS (removi a chave
  `switch_entity_id` do contrato, o que cai no erro de config; o contrato real é `null`).
- **Pulo de versão 0.11.1→0.11.6 causa quebra de runtime.** Refutado: nada consome a versão em
  runtime; impacto limitado a release management do HACS (achado 4).

---

## Testes executados

| # | Comando | Resultado |
|---|---|---|
| 1 | `& "$env:TEMP\opencode\irr-venv\Scripts\python.exe" -m pytest tests/test_next_run.py tests/test_schedules.py -q` | **36 passed** (0.03s) |
| 2 | `& "$env:TEMP\opencode\ha-venv\Scripts\python.exe" -m pytest tests -q` | **176 passed** (14.8s) |
| 3 | `npm run typecheck` (em `frontend-src`) | **OK** (tsc --noEmit, sem erros) |
| 4 | `npm run test` (em `frontend-src`) | **155 passed** (3 arquivos) |
| 5 | `npm run build` (em `frontend-src`) | **OK** — bundle regenerado, byte-idêntico ao do working tree (SHA-256 estável) |
| 6 | `node smoke.mjs` (em `frontend-src`) | **SMOKE OK** |
| 7 | `& "$env:TEMP\opencode\ha-venv\Scripts\python.exe" -m compileall -q custom_components` | **OK** |
| 8 | Harness adversarial temporário (fora do repo, em `%TEMP%\opencode`, removido ao final) | **7/7 passed** — toggles, aria, disabled, watering bar, stop |
| 9 | `ruff check custom_components tests` | **Não executado** — `ruff` indisponível no ambiente (CI `.github/workflows/quality.yml` o executa: `ruff check custom_components tests`) |

Nota: todos os comandos rodaram a partir do working tree sem modificar arquivos de produção.
O único arquivo alterado durante a bateria foi o bundle (regenerado por `npm run build`), que
permaneceu byte-idêntico ao estado pré-existente do working tree.

---

## Status final

**APROVADO**

A mudança é correta e segura para merge: a inversão de estado dos dois toggles está certa
(verificada empiricamente), a acessibilidade básica (role/aria-checked/aria-label/focus/
keyboard via `<button>` nativo/disabled) está presente, nenhum teste usa a assinatura antiga,
o bundle está em sincronia com o fonte e toda a bateria passa (36 + 176 + typecheck + 155 +
build idempotente + smoke + compileall). Nenhum achado de severidade CRITICO ou ALTO. Os
achados restantes são de baixa severidade ou informativos (destaques: adicionar cobertura de
teste para o comportamento dos toggles — MEDIO — e alinhar o release/tag `v0.11.6` no GitHub
para o HACS).
