# Revisão adversarial — 2026-08-16 — gpt-5.6-luna

## Arquivos revisados

- `frontend-src/src/card.ts`
- `frontend-src/src/styles.ts`
- `frontend-src/src/utils.ts`
- `frontend-src/src/types.ts`
- `frontend-src/src/const.ts`
- `frontend-src/src/editor.ts`
- `frontend-src/tests/card.test.ts`
- `frontend-src/tests/editor.test.ts`
- `frontend-src/tests/utils.test.ts`
- `custom_components/irrigation_scheduler/frontend/irrigation-schedule-card.js`
- `custom_components/irrigation_scheduler/*.py`
- `custom_components/irrigation_scheduler/manifest.json` (versão `0.11.2`)
- `tests/**/*.py`
- Diff do commit `3ce5397` e histórico recente (`git log --oneline -5`)

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

Nenhum problema funcional confirmado. A contagem do resumo deliberadamente conta
agendas habilitadas no calendário de hoje, inclusive uma que já tenha executado;
isso está documentado em `utils.ts:547-550` e não foi tratado como defeito sem
um requisito contrário.

## Falsos positivos

- **Título colapsando em card estreito:** a combinação `flex-wrap`,
  `min-width: 0` e `flex: 1 1 110px` preserva o título e permite que os grupos
  de estado/ações mudem de linha; não foi observada falha nos testes de render.
- **Volume/refil duplicado para R1/R2:** o DOM renderiza exatamente um
  `.reservoir-level` e um botão de refil quando os dois reservatórios têm
  sensores, conforme o novo modelo de volume único.
- **Toggle invertendo o estado:** os testes exercitam `on -> turn_off` e
  `off -> turn_on`, além dos toggles de agenda, e as chamadas de serviço são
  corretas.
- **Nome acessível dependente do estado ou botões sem `type`:** os toggles usam
  nome estático e `aria-checked`; os elementos `<button>` do card têm
  `type="button"`. Os dois `ha-icon-button` são componentes HA, não elementos
  `<button>` nativos sujeitos ao fallback de submit.
- **Bundle fora de sincronia:** `npm run build` terminou com sucesso e não
  deixou diferença no bundle versionado em relação ao fonte compilado.

## Testes executados

| Comando | Resultado |
|---|---|
| `python.exe -m pytest tests/test_next_run.py tests/test_schedules.py -q` (irr-venv) | **36 passed** |
| `python.exe -m pytest tests -q` (ha-venv) | **176 passed** |
| `npm run typecheck` (`frontend-src`) | **sucesso** |
| `npm run test` (`frontend-src`) | **3 arquivos, 161 testes passed** |
| `npm run build` (`frontend-src`) | **sucesso; bundle gerado sem diff** |
| `python.exe -m compileall -q custom_components` (ha-venv) | **sucesso** |
| `git show 3ce5397` / `git log --oneline -5` | **inspeção concluída** |

## Status final

**APROVADO**
