# Watergaia - Referencia de Funcoes

Este documento descreve as funcoes principais do plugin `irrigation_scheduler`,

## Fluxo geral

1. O usuario cria uma zona pela configuracao da integracao.
2. O Home Assistant cria um `ConfigEntry` com as opcoes da zona.
3. `IrrigationScheduler` calcula o proximo horario.
4. No horario, o alvo e ligado e recebe um timer de desligamento.
5. O sensor publica o estado e os dados usados pelo card.
6. O card chama os servicos da integracao para editar horarios ou iniciar/parar
   a rega.

## Arquivos do backend

### `__init__.py`

#### `async_setup(hass, config)`

Inicializa a integracao uma vez. Registra os servicos e o arquivo JavaScript do
card no frontend do Home Assistant.

#### `async_setup_entry(hass, entry)`

Inicializa uma zona. Cria ou reutiliza o `RuntimeStore` compartilhado, cria o
`IrrigationScheduler`, configura as plataformas e registra o listener de
alteracao das options.

#### `async_unload_entry(hass, entry)`

Descarrega uma zona, cancela timers/listeners, remove entidades e remove os
servicos quando a ultima zona e descarregada.

#### `_async_update_listener(hass, entry)`

Recebe alteracoes em `entry.options` sem recarregar a entrada. Recalcula apenas
o proximo disparo, preservando uma rega ativa.

#### `_async_register_frontend(hass)`

Registra `irrigation-schedule-card.js` como caminho estatico e adiciona
`/irrigation_scheduler/card.js` aos modulos extras do Lovelace.

#### `_async_unregister_frontend(hass)`

Remove a URL extra do frontend quando a ultima entrada e descarregada.

#### `_async_register_services(hass)`

Registra os servicos da integracao uma unica vez.

#### `_async_unregister_services(hass)`

Remove os servicos quando nao existe mais nenhuma zona carregada.

#### `_async_resolve_schedulers(hass, call)`

Converte o alvo do servico em uma ou mais instancias de
`IrrigationScheduler`. Aceita entidade, dispositivo e area.

#### `_coerce_days(value)`

Normaliza dias recebidos como lista, string ou dicionario para uma lista.

#### `_prepare_schedule_data(data)`

Prepara dados de horario antes da validacao, principalmente os dias da semana.

#### `_service_data(call)`

Remove dados de alvo (`entity_id`, `device_id`, `area_id` etc.) antes da
validacao dos campos do servico.

#### `_serialize_schedule(schedule)`

Converte um horario para formato JSON. A geracao de ID e feita apenas na
criacao, nao nesta funcao.

### `config_flow.py`

#### `IrrigationSchedulerConfigFlow.async_step_user(user_input)`

Cria uma zona pela interface do Home Assistant. Configura nome, entidade alvo,
duracao padrao, vazao em L/h, numero de vasos e volume do reservatorio.

#### `IrrigationSchedulerConfigFlow.async_get_options_flow(config_entry)`

Abre o fluxo para editar as opcoes de uma zona existente.

#### `IrrigationSchedulerOptionsFlow.async_step_init(user_input)`

Edita duracao padrao, duracao maxima, vazao, numero de vasos e volume do
reservatorio sem interromper uma rega em andamento.

### `scheduler.py`

#### `compute_next_run(schedules, now, enabled)`

Wrapper publico que retorna somente o proximo `datetime` de rega. A funcao
principal esta em `next_run.py` para permitir testes sem Home Assistant.

#### `IrrigationScheduler.__init__(hass, entry, store)`

Cria o controlador de uma zona e inicializa timers, estado da rega e listeners.

#### Propriedades de estado

| Propriedade | Funcao |
|---|---|
| `enabled` | Informa se o agendamento geral esta ativo. |
| `schedules` | Retorna os horarios configurados. |
| `is_watering` | Informa se a zona esta regando. |
| `started_at` | Inicio da rega atual. |
| `finishes_at` | Fim previsto da rega atual. |
| `active_source` | Origem da rega: `schedule` ou `manual`. |
| `active_schedule_id` | ID do horario que iniciou a rega. |
| `active_duration` | Duracao da rega atual em segundos. |
| `next_run` | Proximo disparo calculado. |
| `target_entity_id` | Entidade fisica controlada. |
| `target_domain` | Dominio da entidade alvo. |
| `default_duration` | Duracao padrao em segundos. |
| `max_duration` | Limite maximo de seguranca em segundos. |
| `flow_rate_lph` | Vazao configurada por vaso em litros por hora. |
| `number_of_pots` | Numero de vasos da zona; zero significa nao configurado. |
| `reservoir_volume_l` | Volume do reservatorio em litros; reservado para uso futuro. |

#### `async_setup()`

Executa a recuperacao apos restart, registra o listener da entidade alvo e
agenda o proximo horario.

#### `async_unload()`

Cancela todos os timers e listeners. Desliga o alvo quando apropriado, mas
preserva o estado no Store durante o encerramento do Home Assistant.

#### `async_set_enabled(enabled)`

Liga ou desliga o agendamento geral da zona.

#### `async_set_schedules(schedules)`

Substitui a lista completa de horarios nas options.

#### `async_set_zone_options(flow_rate_lph, number_of_pots, reservoir_volume_l)`

Atualiza as configuracoes opcionais da zona sem recarregar a entrada. Campos
com valor `None` permanecem inalterados.

#### `async_add_schedule(schedule)`

Adiciona um horario ao final da lista.

#### `async_update_schedule(schedule_id, **fields)`

Atualiza um horario existente. O ID e imutavel.

#### `async_remove_schedule(schedule_id)`

Remove um horario pelo ID.

#### `async_water_now(duration)`

Inicia uma rega manual imediata. Sem duracao, usa `default_duration`.

#### `async_stop()`

Interrompe a rega atual e tenta desligar a entidade alvo.

#### `async_options_updated()`

Recalcula o proximo horario depois de uma alteracao nas options sem interromper
uma rega ativa.

#### `_async_start_run(duration, source, schedule_id)`

Inicia uma rega, grava o estado no Store, liga o alvo, arma imediatamente o
timer de desligamento e agenda a verificacao de atuacao.

#### `_async_finish_run(turn_off, remove_state, expected_run_id)`

Finaliza uma rega. Cancela timers, tenta desligar o alvo ate tres vezes,
confirma o estado atual e preserva o Store se o desligamento nao for confirmado.

#### `_async_abort_run()`

Aborta uma rega que nao conseguiu atuar. Cancela timers, limpa estado em memoria
e remove o registro do Store quando apropriado.

#### `_async_stop_timer_fired()`

Callback executado quando a duracao da rega termina.

#### `_async_actuation_check_fired(expected_run_id, grace)`

Verifica se o alvo saiu do estado desligado apos a janela de tolerancia para
dispositivos lentos. Se nao atuou, envia desligamento defensivo.

#### `_async_schedule_fired()`

Callback do proximo horario agendado. Ignora disparos sobrepostos.

#### `_async_target_state_changed(event)`

Detecta desligamento externo. Usa o estado atual da entidade e ignora eventos
`off` durante a janela de atuacao para evitar ecos atrasados.

#### `_reschedule_next()`

Cancela o timer anterior e agenda um unico proximo disparo.

#### `_cancel_next()`, `_cancel_stop()`, `_cancel_actuation()`

Cancelam, respectivamente, o timer do proximo horario, o timer de desligamento
e o timer de verificacao de atuacao.

#### `_async_recover_state()`

Recupera regas interrompidas por restart. Regas expiradas recebem desligamento
defensivo; regas ainda ativas recebem um novo timer de parada.

#### `_async_call_target_service(turn_on)`

Chama o servico correto para o dominio alvo: `homeassistant.turn_on/off` para
switch, light e input_boolean; `valve.open_valve/close_valve` para valvulas.

#### `_async_target_is_actuated()` e `_async_target_is_off()`

Consultam o estado atual da entidade para confirmar atuacao ou desligamento.

#### `_async_wait(delay)`

Espera usando `async_call_later`, sem bloquear o event loop.

#### `_async_dispatch_update()`

Envia o sinal dispatcher que atualiza as tres entidades da zona.

### `next_run.py`

Modulo puro, sem imports do Home Assistant.

#### `find_next_run(schedules, now, enabled)`

Retorna `(datetime, schedule)` do proximo horario valido. Trata virada de
semana, horarios desabilitados e DST.

#### `compute_next_run(schedules, now, enabled)`

Retorna somente o `datetime` do proximo horario.

#### `resolve_target_services(domain)`

Retorna o dominio e os servicos corretos para acionar o alvo.

#### `off_states(domain)`

Retorna os estados que significam desligado. Para valvula usa `closed`; para
switch/light/input_boolean usa `off`.

#### `_parse_schedule_time(value)`

Converte string ou `time` para um objeto `datetime.time` valido.

#### `_local_time_exists(candidate)`

Detecta horarios inexistentes durante a transicao de horario de verao.

### `schedules.py`

Modulo puro para manipulacao de horarios.

#### `serialize_schedule(schedule)`

Converte horario para formato JSON sem criar ou alterar o ID.

#### `new_schedule(schedule)`

Serializa um novo horario e gera um ID de oito caracteres quando necessario.

#### `merge_schedule_update(schedule, fields)`

Aplica campos de atualizacao sem permitir que o ID seja alterado.

### `store.py`

#### `RuntimeStore.__init__(hass)`

Cria o Store persistente compartilhado por todas as zonas.

#### `async_load()`

Carrega o estado runtime completo.

#### `async_save_entry(entry_id, run_state)`

Salva o estado de uma rega usando lock para evitar conflito entre zonas.

#### `async_remove_entry(entry_id)`

Remove o estado runtime de uma zona.

#### `_async_load_unlocked()`

Carrega o Store quando o chamador ja possui o lock.

### Plataformas de entidades

#### `switch.py - async_setup_entry(hass, entry, async_add_entities)`

Cria o switch `schedule_enabled`. `async_turn_on` e `async_turn_off` alteram
o agendamento geral da zona.

#### `sensor.py - async_setup_entry(hass, entry, async_add_entities)`

Cria o sensor `next_run`, que publica proximo horario, horarios, IDs das
entidades irmas, vazao, vasos e volume do reservatorio.

#### `binary_sensor.py - async_setup_entry(hass, entry, async_add_entities)`

Cria o binary sensor `watering`, com estado e dados da rega atual.

## Servicos

Todos aceitam alvo por entidade, dispositivo ou area.

| Servico | Funcao |
|---|---|
| `water_now` | Inicia rega imediata; duracao opcional em segundos. |
| `stop` | Para a rega e desliga o alvo. |
| `add_schedule` | Adiciona horario com hora, dias, duracao e enabled. |
| `update_schedule` | Edita um horario pelo ID. |
| `remove_schedule` | Remove horario pelo ID. |
| `set_schedules` | Substitui todos os horarios. |
| `set_zone_options` | Atualiza vazao, vasos e volume do reservatorio. |

Exemplo:

```yaml
service: irrigation_scheduler.set_zone_options
  entity_id: sensor.garden_next_run
  flow_rate_lph: 8
  number_of_pots: 12
  reservoir_volume_l: 1000
```

## Card Lovelace

Arquivo fonte: `frontend-src/src/card.ts`.

### Funcoes puras de `utils.ts`

| Funcao | Funcao |
|---|---|
| `parseTimeParts` | Faz parse e valida hora, minuto e segundo. |
| `formatTime` | Exibe horario sem segundos quando eles sao zero. |
| `dayLabels` | Retorna abreviacoes dos dias conforme o locale. |
| `allDaysLabel` | Retorna `Todos os dias` ou `All days`. |
| `isAllDays` | Detecta se os sete dias estao selecionados. |
| `formatDuration` | Formata segundos em segundos, minutos e horas. |
| `remainingSeconds` | Calcula segundos restantes ate `finishes_at`. |
| `formatRemaining` | Exibe contagem no formato `MM:SS` ou `H:MM:SS`. |
| `progressPct` | Calcula progresso de 0 a 100%. |
| `waterVolume` | Calcula litros recebidos por um vaso. |
| `perPotVolumeMl` | Calcula ml recebidos por vaso. |
| `totalVolumeMl` | Calcula ml totais: ml por vaso multiplicado pelo numero de vasos. |
| `formatVolume` | Formata litros. |
| `formatMl` | Formata ml ou converte para litros acima de 1000 ml. |
| `sanitizeSchedules` | Remove horarios invalidos e normaliza os campos. |
| `timeToSeconds` | Converte uma hora para segundos desde meia-noite. |
| `toServiceTime` | Normaliza hora para `HH:MM:SS`. |

### Metodos do card

| Metodo | Funcao |
|---|---|
| `setConfig` | Valida e salva a configuracao YAML do card. |
| `getCardSize` | Informa o tamanho estimado para o Lovelace. |
| `render` | Renderiza erro de configuracao ou o card da zona. |
| `_renderCard` | Renderiza cabecalho, status, horarios, botoes e settings. |
| `_renderScheduleRow` | Renderiza um horario, volume total e ml por vaso. |
| `_renderDialog` | Renderiza o formulario de adicionar/editar horario. |
| `_renderSettings` | Renderiza vazao, vasos e reservatorio. |
| `_waterNow` | Chama `water_now`. |
| `_stopWatering` | Chama `stop`. |
| `_toggleMaster` | Liga/desliga o agendamento geral. |
| `_toggleScheduleEnabled` | Habilita/desabilita um horario individual. |
| `_deleteSchedule` | Confirma e remove um horario. |
| `_saveDialog` | Valida e chama add/update schedule. |
| `_saveSettings` | Valida e chama `set_zone_options`. |
| `_openAdd` / `_openEdit` | Abrem o formulario de horario. |
| `_openSettings` / `_closeSettings` | Abrem/fecham as configuracoes do card. |
| `_stopTicker` | Cancela a contagem regressiva de um segundo. |

### `editor.ts`

#### `IrrigationScheduleCardEditor.render()`

Renderiza o `ha-form` do editor visual.

#### `_computeLabel(schema)`

Traduz os nomes dos campos do editor.

#### `_valueChanged(event)`

Emite `config-changed` com a configuracao atualizada.

## Configuracoes armazenadas

| Chave | Unidade | Default | Uso |
|---|---:|---:|---|
| `enabled` | boolean | `true` | Agendamento geral. |
| `default_duration` | segundos | `600` | Duracao do Regar agora. |
| `max_duration` | segundos | `7200` | Limite de seguranca. |
| `flow_rate_lph` | L/h por vaso | `0` | Vazao usada no calculo. |
| `number_of_pots` | vasos | `0` | Multiplicador do volume total. |
| `reservoir_volume_l` | litros | `0` | Reservado para uso futuro. |
| `schedules` | lista | `[]` | Horarios da zona. |

## Testes

```powershell
# Backend com Home Assistant
& "$env:TEMP\opencode\ha-venv\Scripts\python.exe" -m pytest tests -q

# Modulos puros
& "$env:TEMP\opencode\irr-venv\Scripts\python.exe" -m pytest tests/test_next_run.py tests/test_schedules.py -q

# Frontend
cd frontend-src
npm run typecheck
npm run test
npm run build
```
