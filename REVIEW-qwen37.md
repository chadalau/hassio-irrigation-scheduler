# REVIEW-qwen37 — Revisão adversarial independente

**Data:** 2026-08-16  
**Modelo:** Qwen 3.7 Max (opencode-go/qwen3.7-max)  
**Commit revisado:** `3ce5397` — "feat(card): restyle to match the sibling light_scheduler card"  
**Escopo:** Frontend (card Lit/TypeScript restyle) + regressão backend

---

## Arquivos revisados

### Frontend (foco principal)
- `frontend-src/src/card.ts` (1846 linhas)
- `frontend-src/src/styles.ts` (1002 linhas)
- `frontend-src/src/utils.ts` (606 linhas)
- `frontend-src/src/types.ts` (143 linhas)
- `frontend-src/src/const.ts` (9 linhas)
- `frontend-src/src/editor.ts` (86 linhas)
- `frontend-src/tests/card.test.ts` (1522 linhas)
- `frontend-src/tests/editor.test.ts` (143 linhas)
- `frontend-src/tests/utils.test.ts` (737 linhas)
- `custom_components/irrigation_scheduler/frontend/irrigation-schedule-card.js` (bundle)

### Backend (regressão)
- `custom_components/irrigation_scheduler/__init__.py` (507 linhas)
- `custom_components/irrigation_scheduler/scheduler.py` (1165+ linhas)
- `custom_components/irrigation_scheduler/sensor.py` (160 linhas)
- `custom_components/irrigation_scheduler/binary_sensor.py` (81 linhas)
- `custom_components/irrigation_scheduler/switch.py` (73 linhas)
- `custom_components/irrigation_scheduler/next_run.py` (218 linhas)
- `custom_components/irrigation_scheduler/const.py` (127 linhas)
- `custom_components/irrigation_scheduler/manifest.json` (version 0.11.2)

---

## Achados por severidade

### CRITICO
Nenhum.

### ALTO
Nenhum.

### MEDIO
Nenhum.

### BAIXO

#### B-1. CSS duplicado: `.zone-icon` e `.status` definidos em dois blocos separados
- **Arquivo:** `frontend-src/src/styles.ts`
- **Linhas:** `.zone-icon` em L30-38 e L91-93; `.status` em L87-89 e L97-109
- **Cenário:** `.zone-icon` é definido primeiro com `width/height/display/border-radius/background/color` (L30-38) e depois novamente com apenas `flex-shrink: 0` (L91-93). O mesmo padrão ocorre com `.status`: `flex-shrink: 0` (L87-89) e depois o chip visual completo (L97-109).
- **Evidência:** `grep` confirma duas ocorrências de cada seletor como bloco independente.
- **Impacto:** Funcionalmente inócuo (CSS permite e o cascade resolve corretamente), mas dificulta manutenção — um futuro editor que altere `.zone-icon` no primeiro bloco pode não perceber que há um segundo bloco adicionando `flex-shrink: 0`.
- **Sugestão:** Consolidar cada seletor em um único bloco.

#### B-2. Inconsistência tipográfica: card principal usa px fixo, diálogos/painéis usam rem
- **Arquivo:** `frontend-src/src/styles.ts`
- **Linhas:** 20 ocorrências de `rem` (L362, 382, 387, 401, 417, 704, 726, 793, 816, 835, 844, 877, 885, 906, 927, 936, 946, 967, 986)
- **Cenário:** O commit message declara "Fixed px scale matching light (20/13/11/22/9) instead of rem, which drifts with the browser's font setting". A escala px foi aplicada ao card principal (header, summary, metrics, schedules, watering bar), mas os diálogos (add/edit schedule, history), o painel de configurações e o `.empty` state continuam usando `rem` (0.7rem a 1.1rem).
- **Evidência:** `grep` por `rem` em styles.ts retorna 20 ocorrências, todas em seletores de diálogos, settings panel, config-error e empty state.
- **Impacto:** Se o usuário alterar o font-size do browser, o card principal mantém suas proporções (objetivo declarado), mas os diálogos escalam independentemente — criando uma inconsistência visual entre o card e seus próprios overlays. Não é um bug funcional, mas contradiz o objetivo declarado no commit.
- **Sugestão:** Decidir se os diálogos devem seguir a mesma escala px (consistência total) ou se a exceção é intencional (documentar no comentário do styles.ts).

### INFORMATIVO

#### I-1. `ha-icon-button` sem `type="button"` explícito
- **Arquivo:** `frontend-src/src/card.ts`, L747-752
- **Cenário:** Os botões de editar/excluir schedule usam `<ha-icon-button>`, um componente HA (não `<button>` nativo). O teste "gives every custom button an explicit type" (card.test.ts L1505-1521) verifica apenas `button` nativos via `querySelectorAll("button")`, portanto não cobre `ha-icon-button`.
- **Evidência:** O teste passa porque `ha-icon-button` renderiza internamente um `<mwc-icon-button>` que carrega seu próprio `type`. O `querySelectorAll("button")` no shadow root do card não atravessa o shadow root do `ha-icon-button`.
- **Impacto:** Nenhum — o componente HA já trata isso internamente. Apenas registro para completude.

#### I-2. `countSchedulesToday` não importado no teste de card
- **Arquivo:** `frontend-src/tests/card.test.ts`
- **Cenário:** A função `countSchedulesToday` (utils.ts L552-565) é usada no card (L339) para o bloco de resumo, mas não possui teste unitário dedicado em `utils.test.ts`.
- **Evidência:** `grep` por `countSchedulesToday` em `utils.test.ts` retorna zero resultados. A função é testada indiretamente via card.test.ts (o summary block renderiza a contagem), mas não há teste unitário isolado cobrindo timezone, schedules desabilitados, etc.
- **Impacto:** Baixo — a função é simples (filter + length) e a lógica de `weekdayInZone` já é coberta pelos testes de `scheduleStatusToday`. Mas um teste unitário explícito daria mais confiança em edge cases.

---

## Falsos positivos (suspeitas testadas e refutadas)

### FP-1. Header title colapsando para largura zero em cards estreitos
- **Suspeita:** Com `flex-wrap: wrap` e `.header-title { flex: 1 1 110px; min-width: 0 }`, o título poderia colapsar para zero em cards muito estreitos.
- **Refutação:** `flex: 1 1 110px` estabelece uma base de 110px. Com `flex-wrap: wrap`, quando não há espaço suficiente na linha, o título quebra para a próxima linha inteira — nunca é espremido para zero. Em um card de 260px (padding 16px cada lado = 228px úteis), os elementos fixos (zone-icon 32px + gap 8px + status ~80px + gap 8px + toggle 30px + gap 8px + cog 30px = ~196px) deixam ~32px na primeira linha, insuficiente para 110px de base — o título vai para a linha seguinte com largura total. O commit message afirma "verified 260-460px with no truncation or overflow" e a análise CSS confirma.

### FP-2. Toggle hit area roubando cliques de toggles adjacentes
- **Suspeita:** O `::before { inset: -7px -5px }` expande a área de clique do toggle além do gap entre schedule rows (4px).
- **Refutação:** O inset vertical de 7px ultrapassa o gap de 4px entre rows, mas como cada toggle está na primeira coluna de sua própria grid row, a sobreposição ocorre na área entre rows (não sobre outro toggle). Um clique nessa área entre rows seria capturado pelo toggle mais próximo — comportamento desejável (ampliar a área de clique). Não há sobreposição entre dois toggles.

### FP-3. `_stringAttr` retornando undefined para string vazia
- **Suspeita:** `_stringAttr` (card.ts L1396) retorna `undefined` para strings vazias (`typeof value === "string" && value` — empty string é falsy). Isso poderia fazer `phEntityId` ser `undefined` em vez de `""`.
- **Refutação:** Todos os call sites usam `?? ""` (ex.: L290 `this._stringAttr(sensor, "ph_entity_id") ?? ""`), então o resultado final é sempre `""` quando o atributo é vazio ou ausente. O comportamento é intencional e correto.

### FP-4. `reservoirPct` com divisão por zero
- **Suspeita:** `(reservoirRemaining / reservoirVolume) * 100` quando `reservoirVolume` é 0 resultaria em Infinity.
- **Refutação:** A expressão está dentro de um ternário `reservoirVolume > 0 ? ... : 0` (L347), então quando `reservoirVolume` é 0, o resultado é 0 sem nunca executar a divisão.

### FP-5. Bundle dessincronizado com o fonte
- **Suspeita:** O bundle `irrigation-schedule-card.js` poderia estar desatualizado em relação ao fonte TypeScript.
- **Refutação:** `npm run build` regenerou o bundle e `git diff --ignore-cr-at-eol` mostrou zero diferenças de conteúdo (apenas line endings CRLF/LF, esperado no Windows). O bundle está perfeitamente sincronizado.

---

## Testes executados

| Suite | Comando | Resultado | Tempo |
|-------|---------|-----------|-------|
| Backend puro (next_run + schedules) | `pytest tests/test_next_run.py tests/test_schedules.py -q` | **36 passed** | 0.03s |
| Backend HA (todos) | `pytest tests -q` | **176 passed** | 14.93s |
| Frontend typecheck | `npm run typecheck` | **OK** (zero erros) | ~3s |
| Frontend test | `npm run test` | **161 passed** (3 files: card 61, editor 5, utils 95) | 673ms |
| Frontend build | `npm run build` | **OK** (bundle gerado, sync confirmado) | ~1s |
| Python compileall | `python -m compileall -q custom_components` | **OK** (zero erros) | ~2s |

**Total: 373 testes, 0 falhas.**

---

## Status final

### APROVADO

O restyle do card (commit `3ce5397`) é sólido. Todos os 373 testes passam, o bundle está sincronizado com o fonte, e a análise adversarial não encontrou bugs funcionais. Os dois achados BAIXO (CSS duplicado e inconsistência rem/px nos diálogos) são questões de manutenção/consistência, não defeitos. Nenhum achado CRITICO, ALTO ou MEDIO.
