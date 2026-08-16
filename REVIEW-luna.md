# Revisão adversarial — 16/08/2026 — gpt-5.6-luna (opencode-go/gpt-5.6-luna)

## Arquivos revisados

- Backend: `custom_components/irrigation_scheduler/` — `scheduler.py`, `__init__.py`, `config_flow.py`, `store.py`, `next_run.py`, `schedules.py`, `sensor.py`, `switch.py`, `binary_sensor.py`, `const.py`, `manifest.json`, além do bundle em `frontend/irrigation-schedule-card.js`.
- Frontend fonte: `frontend-src/src/` — `card.ts`, `editor.ts`, `utils.ts`, `styles.ts`, `types.ts`, `const.ts`.
- Testes: `tests/` (incluindo `tests/integration/`) e `frontend-src/tests/`.
- Documentação alterada: `FUNCTIONS.md`.
- `plano.md` foi identificado como documento não rastreado e não foi tratado como código de produção/teste.

## Achados por severidade

### CRITICO

Nenhum achado reproduzível.

### ALTO

Nenhum achado reproduzível.

### MEDIO

Nenhum achado reproduzível.

### BAIXO

Nenhum achado reproduzível.

### INFORMATIVO

- `custom_components/irrigation_scheduler/manifest.json:16` — a versão foi de `0.11.1` para `0.11.6`, pulando `0.11.2`–`0.11.5`. Não há evidência de defeito funcional; o salto é válido se essas versões não foram publicadas. Confirmar apenas a intenção no processo de release.
- `frontend-src/src/card.ts:374-391,632-647` — os toggles próprios usam `button` nativo, `role="switch"`, `aria-checked`, foco visível e click; ativação por Enter/Espaço é fornecida pelo elemento nativo. Não foi encontrado handler/teste usando a assinatura antiga com `Event`.
- `custom_components/irrigation_scheduler/frontend/irrigation-schedule-card.js` foi regenerado por `npm run build`; a saída contém as novas classes, marcação ARIA e inversões de estado correspondentes ao fonte.

Não foram encontrados defeitos reproduzíveis no backend, nos gates de pH/EC, rastreamento de reservatório, histórico, ativação externa, desligamento automático ou integração do card com os serviços.

## Falsos positivos

- Suspeita de inversão incorreta do master switch: refutada por inspeção do fluxo `switchOn` → `_toggleMaster(entity, switchOn)` e pela chamada `currentlyOn ? "turn_off" : "turn_on"` em `frontend-src/src/card.ts:1552-1562`.
- Suspeita de inversão incorreta do schedule: refutada por `enabled: !schedule.enabled` em `frontend-src/src/card.ts:1581-1583`.
- Suspeita de incompatibilidade residual da assinatura antiga: busca no fonte, bundle, testes e documentação não encontrou chamadas `_toggleMaster(..., Event)` ou `_toggleScheduleEnabled(..., Event)`.
- Suspeita de bundle fora de sincronia: `npm run build` terminou com sucesso e regenerou `custom_components/irrigation_scheduler/frontend/irrigation-schedule-card.js` a partir do fonte atual.
- Suspeita de regressão de acessibilidade por troca de `ha-switch`: os controles são botões nativos focáveis, têm `role="switch"`, `aria-checked`, `aria-label`, estado disabled quando aplicável e estilo `:focus-visible`.

## Testes executados

| Comando | Resultado |
|---|---|
| `& "$env:TEMP\opencode\irr-venv\Scripts\python.exe" -m pytest tests/test_next_run.py tests/test_schedules.py -q` | **PASS** — 36 passed |
| `& "$env:TEMP\opencode\ha-venv\Scripts\python.exe" -m pytest tests -q` | **PASS** — 176 passed |
| `npm run typecheck` (em `frontend-src`) | **PASS** — `tsc --noEmit` |
| `npm run test` (em `frontend-src`) | **PASS** — 3 arquivos, 155 testes |
| `npm run build` (em `frontend-src`) | **PASS** — bundle criado em `custom_components/irrigation_scheduler/frontend/irrigation-schedule-card.js` |
| `& "$env:TEMP\opencode\ha-venv\Scripts\python.exe" -m compileall -q custom_components` | **PASS** — sem saída/erro |
| `git diff --check` | **PASS** — sem erro de whitespace |

## Status final

**APROVADO**
