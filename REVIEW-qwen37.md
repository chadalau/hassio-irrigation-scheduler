# REVIEW-qwen37.md — Revisão adversarial independente

**Data:** 2026-08-16  
**Modelo:** qwen3.7-max (opencode-go/qwen3.7-max)  
**Escopo:** Working tree do repositório `watergaia` (mudanças não commitadas + contexto completo)

---

## Arquivos revisados

### Backend (sem mudanças no working tree)
- `custom_components/irrigation_scheduler/__init__.py`
- `custom_components/irrigation_scheduler/scheduler.py`
- `custom_components/irrigation_scheduler/config_flow.py`
- `custom_components/irrigation_scheduler/store.py`
- `custom_components/irrigation_scheduler/next_run.py`
- `custom_components/irrigation_scheduler/schedules.py`
- `custom_components/irrigation_scheduler/sensor.py`
- `custom_components/irrigation_scheduler/switch.py`
- `custom_components/irrigation_scheduler/binary_sensor.py`
- `custom_components/irrigation_scheduler/const.py`
- `custom_components/irrigation_scheduler/manifest.json` (modificado)

### Frontend fonte (modificados)
- `frontend-src/src/card.ts`
- `frontend-src/src/styles.ts`
- `frontend-src/src/utils.ts`
- `frontend-src/src/types.ts`
- `frontend-src/src/const.ts`
- `frontend-src/src/editor.ts`

### Frontend testes
- `frontend-src/tests/card.test.ts`
- `frontend-src/tests/editor.test.ts`
- `frontend-src/tests/utils.test.ts`

### Backend testes
- `tests/test_next_run.py`
- `tests/test_schedules.py`
- `tests/integration/` (todos os arquivos)

### Bundle buildado
- `custom_components/irrigation_scheduler/frontend/irrigation-schedule-card.js` (modificado)

### Documentação
- `FUNCTIONS.md` (modificado)
- `plano.md` (não rastreado, apenas inspecionado)

---

## Achados por severidade

### CRITICO
Nenhum.

### ALTO
Nenhum.

### MEDIO
Nenhum.

### BAIXO

#### B1. `type="button"` ausente nos toggles customizados e no botão "Adicionar horário"
- **Arquivo:** `frontend-src/src/card.ts:374-384` (master toggle), `card.ts:635-645` (schedule toggle), `card.ts:523-531` (add-schedule-button)
- **Cenário:** Os três `<button>` customizados não possuem `type="button"`. O default HTML é `type="submit"`. Embora o card Lovelace não esteja dentro de um `<form>` (portanto sem risco real de submit acidental), o botão "Parar" na watering-bar (`card.ts:471-478`) já possui `type="button"` corretamente, criando uma inconsistência interna.
- **Evidência:** Inspeção do código. O `watering-stop-button` tem `type="button"` (linha 473), mas os toggles e o add-schedule-button não.
- **Impacto:** Nenhum risco funcional no contexto atual (sem form), mas é uma boa prática de acessibilidade/robustez. Se no futuro o card for envolvido em um form (improvável mas possível em dashboards customizados), os botões sem `type="button"` disparariam submit.
- **Sugestão:** Adicionar `type="button"` aos três botões para consistência com o `watering-stop-button`.

#### B2. `aria-label` inconsistente entre master toggle e schedule toggle
- **Arquivo:** `frontend-src/src/card.ts:379` (master) vs `card.ts:640` (schedule)
- **Cenário:** O master toggle usa `aria-label` descritivo do **estado** (`"Agendamento ativo"` / `"Agendamento desativado"`), enquanto o schedule toggle usa `aria-label` descritivo da **ação** (`"Desativar horário"` / `"Ativar horário"`). Ambos são válidos segundo WAI-ARIA para `role="switch"`, mas a inconsistência dentro do mesmo card pode confundir usuários de screen reader.
- **Evidência:**
  - Master (linha 379): `aria-label=${switchOn ? "Agendamento ativo" : "Agendamento desativado"}`
  - Schedule (linha 640): `aria-label=${schedule.enabled ? "Desativar horário" : "Ativar horário"}`
- **Impacto:** Funcionalmente correto em ambos os casos. Inconsistência de UX menor.
- **Sugestão:** Padronizar em um dos dois estilos. O estilo "ação" (schedule toggle) é mais informativo para o usuário de screen reader, pois comunica o que acontecerá ao clicar.

### INFORMATIVO

#### I1. Version bump 0.11.1 → 0.11.6 (pulo de 4 versões intermediárias)
- **Arquivo:** `custom_components/irrigation_scheduler/manifest.json:16`
- **Cenário:** A versão pulou de 0.11.1 para 0.11.6 sem passar por 0.11.2–0.11.5. Não há código que dependa de versão específica (sem migração baseada em versão, sem check de versão mínima da integração). O HACS usa o version apenas para exibição e comparação de updates.
- **Impacto:** Inofensivo. O número de versão é arbitrário e não afeta funcionalidade.

#### I2. `plano.md` não rastreado pelo git
- **Arquivo:** `plano.md` (untracked)
- **Cenário:** Documento de planejamento para uma integração-irmã `light_scheduler`. Contém apenas decisões de design e uma matriz de reuso/adaptação. Nenhum código.
- **Impacto:** Nenhum. Não afeta o código atual. Pode ser adicionado ao `.gitignore` ou commitado como documento de referência.

#### I3. `CheckableElement` interface ainda é usada (não é dead code)
- **Arquivo:** `frontend-src/src/card.ts:50-52`
- **Cenário:** Com a remoção de `ha-switch` e a mudança de assinatura de `_toggleMaster`/`_toggleScheduleEnabled`, a interface `CheckableElement` poderia parecer dead code. No entanto, ela ainda é usada em `_toggleDay` (linha 1718) para os checkboxes de dias da semana.
- **Impacto:** Nenhum. A interface está correta e em uso.

---

## Falsos positivos (suspeitas testadas e refutadas)

### FP1. `aria-checked` com boolean no Lit
- **Suspeita:** `aria-checked=${switchOn}` (boolean) poderia renderizar como `aria-checked=""` (boolean attribute) em vez de `aria-checked="true"`/`aria-checked="false"`.
- **Refutação:** O Lit converte boolean para string via `String(value)` quando usado como atributo sem o prefixo `?`. `String(true)` = `"true"`, `String(false)` = `"false"`. Isso é o comportamento correto para ARIA attributes (que aceitam "true", "false", "mixed"). Confirmado pela documentação do Lit e pelo comportamento do `AttributePart`.

### FP2. Keyboard support ausente nos toggles
- **Suspeita:** Os `<button role="switch">` customizados poderiam não responder a Enter/Space.
- **Refutação:** O `<button>` nativo já responde a Enter e Space por padrão, disparando o evento `click`. O handler `@click` é disparado automaticamente por keyboard. O `:focus-visible` está presente no CSS (styles.ts:415-418). Acessibilidade keyboard está correta.

### FP3. Thumb do toggle cortado pelo `overflow: hidden` do `ha-card`
- **Suspeita:** O thumb (20x20px) transborda do track (34x12px) e poderia ser cortado pelo `overflow: hidden` do `ha-card` (styles.ts:5).
- **Refutação:** O `.schedule-row` tem `padding: 2px 10px` e está dentro de `.schedules` (margin-top: 8px) dentro de `.card-body` (padding: 0 16px 16px). O thumb transborda 4px verticalmente, mas o conteúdo adjacente (schedule-info com duas linhas de texto) é mais alto que 20px, então o grid row height acomoda o thumb. O `overflow: hidden` do `ha-card` não corta o thumb porque ele está bem dentro dos limites do card.

### FP4. Testes de frontend quebrados pela mudança de assinatura
- **Suspeita:** Os testes poderiam estar usando a assinatura antiga de `_toggleMaster(entity, ev)` ou `_toggleScheduleEnabled(schedule, ev)`.
- **Refutação:** `grep` por `_toggleMaster`, `_toggleScheduleEnabled` e `ha-switch` nos testes retornou zero resultados. Os testes não exercitam esses métodos diretamente. Todos os 155 testes de frontend passaram.

### FP5. Bundle dessincronizado com o fonte
- **Suspeita:** O bundle buildado poderia estar dessincronizado com o fonte TypeScript.
- **Refutação:** `npm run build` regenerou o bundle e o `git diff --stat` permaneceu idêntico (300 ++++++++++++++-------), confirmando que o bundle no working tree já refletia o fonte atual.

---

## Testes executados

| Comando | Resultado |
|---|---|
| `& "$env:TEMP\opencode\irr-venv\Scripts\python.exe" -m pytest tests/test_next_run.py tests/test_schedules.py -q` | **36 passed** em 0.03s |
| `& "$env:TEMP\opencode\ha-venv\Scripts\python.exe" -m pytest tests -q` | **176 passed** em 15.04s |
| `npm run typecheck` (frontend-src) | **OK** (sem erros) |
| `npm run test` (frontend-src) | **155 passed** (3 test files, 706ms) |
| `npm run build` (frontend-src) | **OK** (bundle regenerado com sucesso) |
| `& "$env:TEMP\opencode\ha-venv\Scripts\python.exe" -m compileall -q custom_components` | **OK** (sem erros de compilação) |

**Total: 367 testes, 0 falhas.**

---

## Status final

### APROVADO

Nenhum achado CRITICO, ALTO ou MEDIO. Dois achados BAIXO (inconsistências menores de `type="button"` e `aria-label`) e três INFORMATIVOS (version bump, plano.md, CheckableElement). Todos os testes passam (backend puro, backend HA, frontend typecheck, frontend unit tests, build). O bundle está em sincronia com o fonte. A inversão de estado nos toggles está correta. A acessibilidade (role/aria-checked/focus-visible/keyboard) está funcionalmente correta.

---

## Resumo dos achados

| Severidade | Descrição |
|---|---|
| BAIXO | `type="button"` ausente em 3 botões customizados (toggles + add-schedule-button); inconsistente com o watering-stop-button que já o possui |
| BAIXO | `aria-label` do master toggle descreve o estado, enquanto o schedule toggle descreve a ação — inconsistência de UX |
| INFORMATIVO | Version bump 0.11.1 → 0.11.6 (pulo de 4 versões intermediárias, inofensivo) |
| INFORMATIVO | `plano.md` não rastreado (documento de planejamento para light_scheduler, sem código) |
| INFORMATIVO | `CheckableElement` interface ainda em uso (não é dead code) |
