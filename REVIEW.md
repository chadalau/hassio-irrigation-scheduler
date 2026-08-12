# REVIEW — irrigation_scheduler (projeto completo)

**Status final: APROVADO** · Data: 2026-08-11

> **Nota (2026-08-12):** este documento descreve a revisão do commit inicial.
> Desde então o projeto ganhou vazão/vasos/reservatório editáveis, um gate de
> pH opcional por zona, correção do idioma dos dias da semana no card e
> ajustes de layout — ver [`FUNCTIONS.md`](FUNCTIONS.md) para a referência
> atualizada e a seção "Adendo" abaixo para o que mudou depois desta revisão.

## Escopo

Integração custom de Home Assistant `irrigation_scheduler` (1 config entry = 1
zona de irrigação) + card Lovelace `irrigation-schedule-card`, em inglês como
padrão com traduções `en`/`pt-BR` completas.

## O que foi validado

| Camada | Verificação | Resultado |
|---|---|---|
| Backend puro | `pytest tests/test_next_run.py tests/test_schedules.py` (Python 3.14, sem HA) | 28 passed |
| Backend + card wiring | `pytest tests -q` (HA 2026.2.3 + PHCC) | 63 passed |
| Frontend | `npm run typecheck` / `npm run test` / `npm run build` | 0 erros / 49 passed / IIFE 34KB |
| Sintaxe Python | `py -m compileall -q custom_components` | 0 erros |

## Histórico de revisão (independente, outro modelo)

A revisão adversarial independente (DeepSeek V4 Pro) encontrou, e uma segunda
revisão focada (GPT 5.6 Luna) confirmou, a seguinte classe de bugs — todos
corrigidos e com testes de regressão:

1. **CRÍTICO — válvulas `valve` nunca eram acionadas:** `homeassistant.turn_on`
   não existe para `valve`; o HA só logava warning e retornava sem exceção.
   Corrigido com mapeamento `valve -> open_valve/close_valve` + `off_states`
   por domínio (`closed`, não `off`).
2. **CRÍTICO — `update_schedule` corrompia o `id`:** um uuid novo era injetado
   no update e sobrescrevia o id armazenado. Corrigido separando `new_schedule`
   (cria id) de `serialize_schedule`/`merge_schedule_update` (id imutável).
3. **CRÍTICO — dispositivo assíncrono: válvula aberta sem timer de
   desligamento:** com Z-Wave/Zigbee/MQTT/válvulas motorizadas o serviço
   retorna antes do estado mudar. Corrigido com:
   - timer de parada armado imediatamente após o `turn_on`;
   - verificação de atuação ADIADA (janela de `ACTUATION_GRACE`), com
     `turn_off` defensivo e encerramento ruidoso se o alvo nunca atuar;
   - listener de estado decidindo pelo estado ATUAL (nunca pelo `new_state` do
     evento) e ignorando `off` durante a janela de atuação — um eco atrasado de
     um run anterior não mata um run novo.
4. **ALTO — `turn_off` falho limpava o Store:** agora há retry (3 tentativas,
   `async_call_later`), confirmação por estado atual, e na falha persistente o
   Store é PRESERVADO para o restart recovery tentar de novo.
5. **ALTO — recovery descartava o Store mesmo com `turn_off` defensivo
   falho:** corrigido — só remove após confirmar o estado `off`.
6. **ALTO — `RuntimeStore` por entry corrompia o estado entre zonas:**
   instância única compartilhada + `asyncio.Lock`.
7. **ALTO — serviços falhavam com alvo device/área:** migrado para
   `helpers.target.async_extract_referenced_entity_ids`.
8. **ALTO — race de reentrância:** token `_run_id` em todos os callbacks.
9. **MÉDIO — `set_schedules` com item não-dict:** `ServiceValidationError` com
   o índice do item inválido.
10. **MÉDIO — options corrompidas derrubavam o sensor:** properties
    defensivas com fallback ao default.
11. **MÉDIO — normalização de horário no card:** `parseTimeParts` central com
    limites reais; `toServiceTime("6:5")` → `"06:05:00"`.
12. **MÉDIO — `setConfig` sem validação:** `validateCardConfig` lança erro
    claro para config inválida.

## Decisões de arquitetura registradas

- Configuração em `entry.options`; estado volátil de execução em `Store`
  (`irrigation_scheduler.runtime`). Nunca misturados.
- `async_update_entry` NÃO recarrega o entry (o update listener só recalcula o
  próximo disparo — uma rega ativa nunca é interrompida por mudança de
  options).
- `next_run.py` e `schedules.py` são módulos puros, testáveis sem HA.
- O card é um IIFE self-contained (lit embutido) porque o HA 2026.2.3 não
  expõe import map para `lit`/`home-assistant`; a reatividade usa
  `this.hass.states`, sem WebSocket manual.
- O card é servido pelo backend (`async_register_static_paths` +
  `add_extra_js_url`); sem entrada manual em Resources.

## Limitações conhecidas / não testadas

- Nenhuma execução em hardware HA real (ambiente de CI não tem dispositivo).
  O `glue` foi testado contra HA 2026.2.3 via `pytest-homeassistant-custom-component`.
- `hass_frontend` não é instalável via PyPI; os testes usam o import lazy do
  frontend e uma fixture que emula o frontend carregado.

## Adendo — 2026-08-12

Mudanças feitas depois da revisão original acima, nesta sessão:

1. **Gate de pH opcional por zona:** `ph_entity_id`/`ph_min`/`ph_max` em
   `entry.options`, configuráveis via config flow, options flow, serviço
   `set_zone_options` e o painel de settings do próprio card. Só afeta regas
   **agendadas** (`_async_schedule_fired` → `_check_ph_gate`); `water_now` é
   sempre um override manual e ignora o gate, por decisão explícita do
   usuário. É falha-segura: sensor ausente/indisponível/valor não numérico
   bloqueia a rega (nunca rega "às cegas"). Um horário pulado fica marcado em
   `schedule_warnings` (em memória, não persiste a restart) até a próxima vez
   que aquele horário regar com sucesso; o card mostra um ícone `!` na linha
   do horário com o motivo no tooltip.
2. **Correção — dias da semana em inglês mesmo com HA em pt-BR:** o card
   inteiro é hardcoded em português (diálogos, botões, erros), exceto
   `dayLabels`/`allDaysLabel`/a data do próximo horário, que seguiam
   `hass.locale.language`. Essa localização parcial é a causa raiz do bug
   relatado — corrigido fixando tudo em pt-BR (`utils.ts`, `card.ts`).
3. **Correção — layout do card:** linha de horário reestruturada em duas
   linhas (dias em cima; duração/switch/ações embaixo) para não "encavalar"
   quando há vários dias selecionados; botões "Adicionar horário"/"Regar
   agora" agora dividem a largura igualmente em vez de ficarem
   desproporcionais.
4. Achados da análise de código anterior corrigidos: descrição do serviço
   `set_zone_options` no `services.yaml` agora menciona o reservatório;
   `manifest.json` em `0.2.0`; cobertura de teste do card (`card.test.ts`)
   ampliada além de `setConfig`/`validateCardConfig`.

**Validação (2026-08-12):**

| Camada | Verificação | Resultado |
|---|---|---|
| Backend puro | `pytest tests/test_next_run.py tests/test_schedules.py` | 28 passed |
| Backend + HA | `pytest tests -q` (HA 2026.2.3 + PHCC) | 77 passed |
| Frontend | `npm run typecheck` / `npm run test` / `npm run build` | 0 erros / 63 passed / bundle idêntico ao build limpo |

## Comandos reproduzíveis

```powershell
# Backend (requer venv com HA 2026.2.3 + PHCC)
& "$env:TEMP\opencode\ha-venv\Scripts\python.exe" -m pytest tests -q

# Módulos puros (qualquer Python)
python -m pytest tests/test_next_run.py tests/test_schedules.py

# Frontend
cd frontend-src
npm run typecheck; npm run test; npm run build
```
