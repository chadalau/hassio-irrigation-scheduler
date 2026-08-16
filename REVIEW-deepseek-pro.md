# REVIEW-deepseek-pro.md — Auditoria (deepseek-v4-pro)

**Revisor:** deepseek-v4-pro (DeepSeek API) · **Status: APROVADO** · 2026-08-16

Auditoria do working tree atual de `watergaia`. Não alterei código de produção nem
de testes. Números executados por mim.

## Escopo da rodada

As alterações não commitadas são **exclusivamente de UI/frontend + docs** — nenhum
arquivo de backend (`scheduler.py`, `__init__.py`, `store.py`, etc.) foi tocado, o
que deixa o núcleo de segurança (timer pós-`turn_on`, grace de atuação, `_run_id`,
retry de desligamento com confirmação, preservação do store) intacto.

Mudanças não commitadas revisadas:
- `frontend-src/src/card.ts` + `styles.ts`: substituição do `ha-switch` por um
  toggle próprio `<button class="toggle" role="switch">`; redesenho da barra
  "Regando"; botão full-width "Adicionar horário"; linhas de schedule em caixas.
- `custom_components/irrigation_scheduler/manifest.json`: versão 0.11.1 → 0.11.6.
- `custom_components/irrigation_scheduler/frontend/irrigation-schedule-card.js`
  (bundle rebuildado) e `FUNCTIONS.md` (docs atualizadas).
- `plano.md` (não rastreado): plano da integração-irmã `light_scheduler` (docs).

## Testes executados

| Suite | Comando | Resultado |
|---|---|---|
| Backend puro | `irr-venv python -m pytest tests/test_next_run.py tests/test_schedules.py -q` | **36 passed** |
| Backend HA | `ha-venv python -m pytest tests -q` | **176 passed** |
| Frontend typecheck | `npm run typecheck` | **0 erros** |
| Frontend vitest | `npm run test` | **155 passed** |

Total: **367 testes passando** + typecheck OK.

## Achados (apenas BAIXO / INFORMATIVO — nenhum CRITICO/ALTO/MEDIO funcional)

1. **BAIXO** — `card.ts:374-384, 635-641, 526` — `type="button"` ausente nos três
   botões custom (toggle master, toggle de schedule, "Adicionar horário"), em
   desacordo com o `watering-stop-button` que já o possui. Inócuo aqui (nenhum
   `<form>` envolve o card), mas inconsistente; padronizar evita surpresa se um
   dia o card for embutido em formulário.

2. **BAIXO** — `card.ts:378-379 vs 639-640` — inconsistência de `aria-label`: o
   master descreve o **estado** ("Agendamento ativo") enquanto o toggle de
   schedule descreve a **ação** ("Desativar horário"). Cosmético de UX/leitor de
   tela; escolher uma convenção só.

3. **BAIXO** — sem cobertura automatizada para os novos toggles. A refatoração
   trocou a assinatura de `_toggleMaster`/`_toggleScheduleEnabled` (perderam o
   `ev: Event`), mas nenhum teste exercita o clique nem assere `aria-checked`/
   inversão de estado. A inversão está **correta** (verificada por leitura:
   `currentlyOn ? "turn_off" : "turn_on"` e `!schedule.enabled`), mas nada a
   protege contra regressão.

4. **BAIXO** — `styles.ts:368-379` — área de toque do `.toggle` é 34×12px, pequena
   e sem `:hover`/`:active`; o `ha-switch` anterior tinha touch-target invisível.
   Usabilidade mobile.

5. **INFORMATIVO** — `styles.ts:281-288` — `text-overflow: ellipsis` é inócuo em
   `.watering-left` (o texto vive num `<span>` flex-item; overflow apenas é
   cortado, sem reticências) em cards estreitos.

6. **INFORMATIVO** — `manifest.json`: salto 0.11.1 → 0.11.6 pula 0.11.2..0.11.5.
   Inofensivo em runtime, mas o HACS só notifica update se existir release/tag
   `v0.11.6` no GitHub.

7. **INFORMATIVO** — `plano.md`: mockups com a linguagem visual antiga do card,
   contradizendo o `FUNCTIONS.md` já atualizado. Só documentação, sem impacto.

## Verificações explícitas (correto)

- `aria-checked=${boolean}` renderiza `"true"`/`"false"` corretamente (Lit trata
  atributos `aria-*` como boolean).
- Teclado: `<button>` nativo com `role="switch"` responde a Enter/Espaço; foco
  visível via `.toggle:focus-visible`.
- Estado disabled com `role="switch" aria-checked="false" disabled` quando não há
  `switch_entity_id`.
- Bundle buildado em sincronia com o fonte (build idempotente).
- Sem regressão nos números da bateria (36/176/155), inclusive as suítes de
  ativação externa e warnings de falha de atuação.

## Conclusão

Refatoração de UI coerente, backend de segurança intocado, todas as suítes verdes.
Restam apenas itens baixos/informativos de acessibilidade e cobertura de teste,
nenhum deles bloqueante. **APROVADO.**
