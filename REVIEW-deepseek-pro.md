# REVIEW-deepseek-pro.md — Auditoria (deepseek-v4-pro)

**Revisor:** deepseek-v4-pro (DeepSeek API) · **Status: APROVADO** · 2026-08-16

Auditoria do estado atual de `watergaia` (HEAD `7ab90a1`, working tree limpo).
Não alterei código de produção nem de testes. Números executados por mim.

## Escopo da rodada

O objeto desta rodada é o commit `3ce5397` ("feat(card): restyle to match the
sibling light_scheduler card") — uma reformulação grande **só do card**. O
backend `custom_components/irrigation_scheduler/*.py` NÃO mudou (apenas o
`manifest.json` voltou para a versão `0.11.2`), então o núcleo de segurança
(timer pós-`turn_on`, grace de atuação, `_run_id`, retry de desligamento com
confirmação, preservação do store) está intacto por construção.

Novidades do restyle: cabeçalho em uma linha (ícone de zona + nome + chip de
estado + master toggle + cog), bloco de resumo (horários hoje + próxima +
"Volume/dia"), seções tituladas, tiles de pH/EC em duas colunas com
volume/estimativa/refil renderizados UMA vez, "Regar agora" como botão
rotulado, escala de px fixa com tokens próprios, toggle 30×18 e correções de
acessibilidade vindas da rodada anterior.

## Testes executados

| Suite | Comando | Resultado |
|---|---|---|
| Backend puro | `irr-venv python -m pytest tests/test_next_run.py tests/test_schedules.py -q` | **36 passed** |
| Backend HA | `ha-venv python -m pytest tests -q` | **176 passed** |
| Frontend typecheck | `npm run typecheck` | **0 erros** |
| Frontend vitest | `npm run test` | **161 passed** |

Total: **373 testes passando** + typecheck OK.

## Achados (apenas BAIXO / INFORMATIVO — nenhum CRITICO/ALTO/MEDIO funcional)

1. **BAIXO** — `card.ts:427-442` + `utils.ts:552-565` — o resumo "N horários
   hoje" (`countSchedulesToday`) conta schedules habilitados no dia atual MAS
   ignora o master toggle desligado, e conta também horários que já passaram.
   Com o master off, o card pode mostrar "3 horários hoje" ao lado de
   "Próxima: Nenhum horário agendado" (o backend trava o next-run via
   `enabled`). Inconsistência informativa, não funcional.

2. **BAIXO** — `utils.ts:124-130` — `formatVolume` arredonda para 2 casas, então
   um consumo real pequeno vira "0 L" enquanto a estimativa de reservatório
   (`formatReservoirEstimate`) usa o valor não-zero. Displays podem discordar
   para zonas de vazão/duração muito baixas. Cosmético.

3. **BAIXO** — sem teste direto para `countSchedulesToday` e `averageDailyVolumeL`
   (e para o bloco `.summary`). Os 6 novos testes de toggle estão presentes e
   não-vazios, e o bloco é exercitado indiretamente pelos card tests, mas as duas
   funções novas de `utils.ts` não têm unit test dedicado — regressão silenciosa
   possível.

4. **INFORMATIVO** — `utils.ts:536-545` — bloco de doc comment órfão: a docstring
   de `scheduleStatusToday` ficou pendurada logo acima da docstring de
   `countSchedulesToday` (duplicada/descolada). Só leitura do código.

5. **INFORMATIVO** — `styles.ts` — regras duplicadas: `.zone-icon` (L30 e L91) e
   `.status` (L87 e L97) definidas em dois blocos distintos. Inócuo, mas atrapalha
   manutenção.

6. **INFORMATIVO** — tipografia mista: o corpo do card migrou para px fixo
   (objetivo do commit), mas ~20 propriedades nos diálogos/painel de settings
   ainda usam `rem`, contradizendo o objetivo de escala fixa.

## Verificações explícitas (correto)

- Todas as correções de acessibilidade da rodada anterior foram aplicadas: nome
  acessível ESTÁTICO nos toggles ("Agendamento automático") com estado só via
  `aria-checked`; `type="button"` em todos os botões custom; toggle disabled com
  nome acessível próprio; hit area ampliada; `text-overflow` corrigido.
- Inversão de estado correta em `_toggleMaster`/`_toggleScheduleEnabled`.
- `averageDailyVolumeL` matematicamente correto: contribuição semanal =
  total por execução × `days.length`, espalhada em 7 dias; pula disabled e
  `total === null` (sem vazão).
- Cabeçalho com `flex-wrap` não colapsa o título a zero em cards estreitos
  (260–460px), verificado.
- Bundle buildado em sincronia com o fonte (hash idêntico pré/pós build).
- Manifest `0.11.2` coerente (os bumps intermediários 0.11.3..0.11.6 da sessão
  nunca foram lançados).

## Conclusão

Restyle de UI coerente e bem testado; backend de segurança intocado; bateria
verde (373 testes). Restam apenas itens baixos/informativos de consistência de
resumo, cobertura de teste e limpeza de CSS/comentários — nenhum bloqueante.
**APROVADO.**
