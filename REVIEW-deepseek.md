# REVIEW — watergaia / irrigation_scheduler (restyle do card)

**Data:** 2026-08-16 · **Modelo:** deepseek-v4-flash · **Escopo:** revisão adversarial independente do commit `3ce5397` ("feat(card): restyle to match the sibling light_scheduler card") — frontend (card, styles, utils, types, const, editor, testes) + regressão do backend + sincronia do bundle + `manifest.json` (0.11.2).

**Regra aplicada:** nenhum arquivo de produção ou de teste foi alterado; apenas `npm run build` foi executado (regenera o bundle oficial) e `REVIEW-deepseek.md` foi escrito.

---

## Arquivos revisados

| Arquivo | Observação |
|---|---|
| `frontend-src/src/card.ts` (1846 linhas) | Lido integralmente; diff `3ce5397` revisado linha a linha |
| `frontend-src/src/styles.ts` (1002) | Lido integralmente |
| `frontend-src/src/utils.ts` (606, +21 novas) | Lido integralmente; funções novas auditadas |
| `frontend-src/src/types.ts`, `const.ts`, `editor.ts` | Lidos |
| `frontend-src/tests/card.test.ts` (1522) | Lido integralmente (incl. os 6 testes de toggle novos) |
| `frontend-src/tests/utils.test.ts` (737), `editor.test.ts` (143) | Lidos |
| `custom_components/irrigation_scheduler/manifest.json` | `0.11.1 → 0.11.2` (única mudança de backend) |
| `custom_components/irrigation_scheduler/frontend/irrigation-schedule-card.js` | Hash SHA-256 antes/depois do build: **idêntico** (em sincronia) |
| Backend `.py` (leitura seletiva de contratos): `sensor.py`, `next_run.py`, `scheduler.py`, `switch.py`, `__init__.py` | Contratos de atributos e gate do switch usados pelo card confirmados |
| `tests/` (integração) | Bateria completa executada |

---

## Achados por severidade

### CRITICO
Nenhum achado reproduzível.

### ALTO
Nenhum achado reproduzível.

### MEDIO
Nenhum achado reproduzível.

### BAIXO

1. **`card.ts:339-343` / `card.ts:427-442` — headline de resumo ignora o master toggle desligado.**
   Cenário: master switch (`switch.<zona>_schedule_enabled`) desligado, com pelo menos um schedule `enabled` caindo no dia de hoje. O card renderiza, no topo, `<strong>2 horários hoje</strong>` **e, na mesma linha**, "Próxima: Nenhum horário agendado". O backend confirma: `find_next_run(..., enabled=False)` retorna `None` (`next_run.py:116`, chamado com `enabled=self.enabled` em `scheduler.py:1866`), então o sensor abaixa para "unavailable/unknown" e `_nextRunText` (`card.ts:1536-1541`) emite "Nenhum horário agendado".
   Evidência: os textos vêm de fontes opostas — o count usa `countSchedulesToday`, que por documentação só pergunta "está na agenda de hoje", e o "Próxima" vem do estado do sensor, que incorpora a trava do master. O contador/status por horário (`scheduleStatusToday`, `card.ts:681`) também ignora o master, então os ícones `pending`/`done` continuam aparecendo com a automação global desligada.
   Sugestão: quando o master estiver `off`, ou oculte a linha de contagem/ícones pendentes, ou mostre algo como "Agendamento desativado". Não há quebra funcional (nada dispara), apenas leitura contraditória da UI.

2. **`utils.ts:124-130` + `card.ts:434-441` — `formatVolume` arredonda para 2 casas e pode exibir "0 L" para consumo real pequeno, contradizendo a estimativa.**
   Cenário: `avgDailyVolume` > 0 mas < 0,005 L/dia (ex.: 8 L/h, 1 vaso, 2 s/dia → ~0,0044 L/dia). O bloco `.summary-stat` aparece (condição `> 0`) mostrando "Volume/dia **0 L**", enquanto o `formatReservoirEstimate` simultâneo calcula "~227 dias" a partir do mesmo valor não-zero. Duas leituras do mesmo dado, aparentemente contraditórias.
   Evidência: `Math.round(0.0044 * 100) / 100 === 0` → `"0 L"`. Reproduzido por aritmética direta; caso raro, mas plausível em zonas de pulso com regas curtas/infrequentes.
   Sugestão: mostrar `"< 0.01 L"` (ou manter 3 casas) quando o arredondamento zera um valor positivo.

3. **Testes não cobrem as duas funções novas de lógica de negócio do restyle — `countSchedulesToday` (utils) e o bloco `.summary` inteiro.**
   Evidência de gap: `utils.test.ts` não importa `countSchedulesToday` (grep confirma) e `card.test.ts` não possui nenhuma asserção sobre "horários hoje", "Próxima:", "Volume/dia". As novas funções `countSchedulesToday`/`averageDailyVolumeL` mudam a semântica de exibição e estão sujeitas a regressão silenciosa (ex.: o achado BAIXO nº 1 passaria despercebido).
   Sugestão: adicionar testes unit para `countSchedulesToday` (domingo, timezone do servidor, 0 schedules, data inválida) e asserções de DOM para o resumo.

### INFORMATIVO

1. **`utils.ts:536-552` — comentário de doc descolado da função.** O bloco de doc de `scheduleStatusToday` (536-545) ficou separado da sua função (567) pelo doc + função de `countSchedulesToday` (546-565). Compilação/testes inalterados; apenas legibilidade.
2. **`styles.ts` — regras redundantes/mortas:** `.zone-icon` duplicado (30 e 91); `.status` duplicado (87 e 97); `.card-body .section-divider` (348-352) sem efeito (o único `.section-divider` está fora de `.card-body`); `.watering-stop-button:disabled` (515) inalcançável (o botão nunca recebe `disabled`).
3. **`card.ts:432 title` da tile pH/EC de reservatório único diz "reservatório 1"** enquanto o rótulo visual é apenas "pH"/"EC" — inconsistência mínima entre tooltip e label quando não há R2.
4. **`card.ts:427-442` — "Próxima:" agora aparece também durante rega ativa** (antes, o bloco "Próximo:" era ocultado enquanto `wateringOn`). Mudança de design intencional; só vale documentar.
5. **`REVIEW-luna.md` modificado externamente durante a sessão** (mtime 21:14:53, 41+/23-). Nenhum comando desta revisão escreve fora de `REVIEW-deepseek.md`; provável sincronização do OneDrive/ambiente. Arquivo não foi lido nem alterado por mim (per regra).
6. **Duplicação corrigida de volume/estimativa/refil:** confirmado que o nível do reservatório renderiza uma única vez (testes 616 e 820 de `card.test.ts`; markup em `card.ts:531-551`), coerente com "a zona rastreia um volume só".

---

## Falsos positivos (suspeitas testadas e refutadas)

1. **"`flex-wrap` colapsa o título para largura zero em cards estreitos (260–460px)"** — REFUTADO por análise determinística do algoritmo flexbox (CSS Flexbox §9.2: a quebra de linha usa o *outer hypothetical main size*, i.e. `flex-basis: 110px`, antes de qualquer shrink). Em 260px, linha 1 = ícone(32) + título(110+) cabem (150 ≤ 228), e `status`/`header-right` (ambos `flex-shrink: 0`) quebram para a linha 2 com `margin-left:auto` empurrando à direita. O título só encolheria abaixo de 110px em cards < ~182px, fora do alvo; e `min-width:0` + `text-overflow` garantem ellipsis em vez de overflow.
2. **"`aria-checked=${switchOn}` em Lit pode não renderizar 'false'"** — REFUTADO: os testes 1386-1436 de `card.test.ts` leem `getAttribute("aria-checked")` como `"false"`/`"true"` e passam em happy-dom (bundlado: `aria-checked=${S}`/`aria-checked=${t.enabled}` no `.js` comprometido).
3. **"Bundle dessincronizado com o fonte"** — REFUTADO: hash SHA-256 do bundle idêntico **antes** e **depois** de `npm run build` (`45160E4A5CDBD6FC0B928255CFAECCC3C7200B29A4F51B888C9EB8E27530A3D2`). Marcadores novos presentes no bundle compilado ("horários hoje", "Volume/dia", `#76d84b`).
4. **"Toggle novo rouba clique do botão engrenagem/editar"** — REFUTADO: `::before` estende 5px, mas há gap de 8px entre toggle e cog (chega 3px antes da borda do cog), e a coluna de ações nas linhas de schedule está fora do invólucro alargado.
5. **"Encolhimento do título em 260px quebra o alinhamento do header-right"** — REFUTADO: quando `header-right` quebra para a própria linha, `margin-left:auto` absorve o espaço livre e o mantém à direita.
6. **"Índice de dia da semana de `countSchedulesToday` erra domingo/fusos"** — REFUTADO empiricamente em Node (UTC, America/Sao_Paulo, Asia/Kolkata, Pacific/Kiritimati): domingo→6, segunda→0, e o dia em fuso +14 vira o dia certo.
7. **"Versão 0.11.2 é regressão frente aos REVIEWs antigos que citavam 0.11.6"** — REFUTADO: narrativa do próprio commit ("intermediate bumps this session were never released"); só `manifest.json` mudou no backend; nenhum runtime consome versão.

---

## Testes executados

| Bateria | Comando | Resultado |
|---|---|---|
| Backend puro | `irr-venv python -m pytest tests/test_next_run.py tests/test_schedules.py -q` | **36 passed** (0.03s) |
| Backend HA | `ha-venv python -m pytest tests -q` | **176 passed** (14.79s) |
| Typecheck | `npm run typecheck` (frontend-src) | **OK** (tsc --noEmit, 0 erros) |
| Testes frontend | `npm run test` (frontend-src) | **161 passed** (3 arquivos: card 61 + editor 5 + utils 95) |
| Build | `npm run build` (frontend-src) | **OK** (rollup; bundle regenerado) |
| Sincronia do bundle | hash SHA-256 pré/pós build | **idêntico** — bundle comprometido == build do fonte |
| Compila backend | `ha-venv python -m compileall -q custom_components` | **OK** |

Observação: o working tree ficou com `M REVIEW-luna.md` (mtime 21:14:53, não causado por esta revisão; ver INFORMATIVO 5). Nenhum outro arquivo foi alterado.

---

## Status final

**APROVADO.**

O restyle atinge os 10 objetivos declarados: header em uma linha com `flex-wrap` (sem colapso do título em 260–460px), bloco de resumo, seções tituladas, tiles pH/EC em duas colunas com volume/estimativa/refil renderizados uma única vez, "Regar agora" rotulado, escala px 20/13/11/22/9, tokens `--w-blue`/`--w-green` (`#76d84b`), toggle 30×18/knob 14px/curso 12px, acessibilidade estática (`aria-label` fixo + `aria-checked`, `type="button"` em todos os `<button>`, nome no toggle disabled), e 6 testes de toggle novos + reservatório atualizados. Backend não regrediu (212 testes Python verdes + compileall). Bundle em sincronia exata.

Nenhum defeito CRITICO/ALTO/MEDIO reproduzível. Os três achados BAIXO (contagem do resumo ignorando o master off, "0 L" por arredondamento, lacuna de cobertura das funções novas) são melhorias de UX/teste recomendadas — opcionais para esta entrega.