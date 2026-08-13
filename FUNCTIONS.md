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

Remove os servicos quando nao existe mais nenhuma zona carregada. A lista
aqui precisa espelhar EXATAMENTE a de `_async_register_services` -- um
servico ausente daqui (aconteceu com `refill_reservoir` ao ser adicionado)
fica orfao apos o unload da ultima entry, ainda visivel na UI mas sem
scheduler para atende-lo.

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

#### `_async_set_schedules` (handler do servico `set_schedules`)

Alem de validar cada item, rejeita com `ServiceValidationError` se dois
horarios do payload tiverem o mesmo `id` -- ao contrario de `add_schedule`
(que gera um id novo em colisao), uma substituicao completa da lista com IDs
duplicados deixaria `update_schedule`/`remove_schedule` ambiguos sobre qual
horario alvejar.

### `config_flow.py`

#### `IrrigationSchedulerConfigFlow.async_step_user(user_input)`

Cria uma zona pela interface do Home Assistant. Configura nome, entidade alvo,
duracao padrao, vazao por vaso em L/h, numero de vasos, volume do
reservatorio, o gate de pH opcional (sensor + faixa min/max) e o sensor de EC
opcional (so exibicao). Rejeita `ph_min > ph_max`.

#### `IrrigationSchedulerConfigFlow.async_get_options_flow(config_entry)`

Abre o fluxo para editar as opcoes de uma zona existente.

#### `IrrigationSchedulerOptionsFlow.async_step_init(user_input)`

Edita duracao padrao, duracao maxima, vazao por vaso, numero de vasos, volume
do reservatorio, o gate de pH e o sensor de EC sem interromper uma rega em
andamento. Rejeita `default_duration > max_duration` e `ph_min > ph_max`.
`ph_entity_id`/`ec_entity_id` usam `user_input.get(chave, valor_atual)` (nao
`or DEFAULT`): a chave fica ausente em `user_input` quando o campo nao foi
tocado, e nesse caso o valor ja configurado deve ser preservado -- `or
DEFAULT` apagaria silenciosamente o gate de pH/EC toda vez que o formulario
fosse salvo sem tocar nesses campos.

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
| `schedules` | Retorna os horarios configurados; filtra itens nao-dict e com `duration` invalida/fora de faixa (nunca deixa um horario corrompido derrubar o agendamento). |
| `is_watering` | Informa se a zona esta regando. |
| `started_at` | Inicio da rega atual. |
| `finishes_at` | Fim previsto da rega atual. |
| `active_source` | Origem da rega: `schedule`, `manual` ou `external` (alvo atuado fora da integracao -- ver `_async_start_external_run`). |
| `active_schedule_id` | ID do horario que iniciou a rega. |
| `active_duration` | Duracao da rega atual em segundos. |
| `next_run` | Proximo disparo calculado. |
| `target_entity_id` | Entidade fisica controlada. |
| `target_domain` | Dominio da entidade alvo. |
| `default_duration` | Duracao padrao em segundos. |
| `max_duration` | Limite maximo de seguranca em segundos. |
| `flow_rate_lph` | Vazao configurada por vaso em litros por hora. |
| `number_of_pots` | Numero de vasos da zona; zero significa nao configurado. |
| `reservoir_volume_l` | Capacidade total do reservatorio em litros. |
| `reservoir_remaining_l` | Volume restante rastreado, persistido nas options (`CONF_RESERVOIR_REMAINING_L`). Ausente no Store => capacidade cheia (default). Sempre limitado a `[0, reservoir_volume_l]` -- se a capacidade for reduzida abaixo do valor salvo, o restante e recortado na leitura. |
| `ph_entity_id` | Entidade do sensor de pH que trava regas agendadas; string vazia desativa o gate. |
| `ph_min` / `ph_max` | Faixa de pH (0-14) que permite uma rega agendada comecar. |
| `ec_entity_id` | Entidade do sensor de EC (condutividade); **so exibicao**, nunca trava uma rega. |
| `ph_entity_id_2` / `ph_min_2` / `ph_max_2` / `ec_entity_id_2` | Mesmos campos, para um SEGUNDO reservatorio independente (ex.: uma tomada/bomba que alimenta dois reservatorios). Totalmente opcional e independente do reservatorio 1 -- ver `_check_ph_gate`. |
| `schedule_warnings` | Dicionario `{schedule_id: motivo}` dos horarios cuja ultima rega AGENDADA nao completou normalmente -- pulada pelo gate de pH (`_check_ph_gate`, motivo prefixado com `R1:`/`R2:` quando ha 2 reservatorios), a tomada nunca ligou (`WARNING_TARGET_NEVER_ACTUATED`, setado em `_async_start_run`'s turn_on exception e em `_async_actuation_check_fired`) ou a tomada desligou sozinha antes do fim (`WARNING_TARGET_STOPPED_EARLY`, setado em `_async_target_state_changed`). So para regas AGENDADAS -- `water_now` nunca seta nem e afetado por isso, mesma exclusao do gate de pH. Em memoria apenas (nao sobrevive a restart); zerado no proprio schedule_id assim que ele inicia uma rega com sucesso de novo (`_async_start_run`). |
| `history` | Lista das regas concluidas nos ultimos 30 dias (mais recente primeiro), carregada do Store em `async_setup()` e atualizada a cada `_async_log_history`. Sobrevive a restart. |
| `last_run` | A entrada mais recente de `history`, ou `None`. |

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

#### `async_set_zone_options(default_duration, flow_rate_lph, number_of_pots, reservoir_volume_l, ph_entity_id, ph_min, ph_max, ec_entity_id, ph_entity_id_2, ph_min_2, ph_max_2, ec_entity_id_2)`

Atualiza as configuracoes opcionais da zona sem recarregar a entrada. Campos
com valor `None` permanecem inalterados. `ph_entity_id=""`/`ec_entity_id=""`
(e as versoes `_2`) sao valores explicitos validos (desativam o gate de pH /
limpam o EC), diferente de `None` (nao altera). Valida `ph_min <= ph_max` (e
`ph_min_2 <= ph_max_2` independentemente) contra o estado **efetivo**
(options atuais + patch desta chamada), nao so os campos presentes na mesma
chamada -- uma chamada que so eleva `ph_min` acima do `ph_max` ja salvo e
rejeitada com `ServiceValidationError`. `default_duration` e validado da
mesma forma contra o `max_duration` salvo. Desativar explicitamente um
reservatorio (`ph_entity_id=""` ou `ph_entity_id_2=""`) limpa os avisos em
`schedule_warnings` causados POR ELE -- os motivos so levam o prefixo
`"R1: "`/`"R2: "` quando os dois reservatorios estao em uso (ver
`_check_ph_gate`), entao esse prefixo decide qual aviso apagar quando o OUTRO
reservatorio continua configurado (desativar R2 nao pode apagar um aviso de
R1 ainda valido); so faz limpeza total quando o reservatorio desativado era o
unico gate em uso (avisos sem prefixo). Usado pelo painel de settings do card
para editar a duracao padrao da rega sem sair do dashboard.

#### `async_refill_reservoir()`

Zera o consumo rastreado, gravando `reservoir_remaining_l = reservoir_volume_l`
nas options. Chamado pelo servico `refill_reservoir` (sem parametros) e pelo
botao "Refil" do card.

#### `_deduct_reservoir_volume(liters)`

Subtrai `liters` de `reservoir_remaining_l` e grava o resultado (nunca abaixo
de zero) nas options. Chamado APENAS por `_async_log_history` -- reusa o
mesmo gate fail-safe que ja decide "essa rega realmente entregou agua?" em
vez de re-derivar essa logica; uma rega nunca-atuada, portanto, tambem nunca
desconta o reservatorio. No-op silencioso quando `reservoir_volume_l` nao
esta configurado (`0`). `number_of_pots == 0` (nao configurado, mesma
convencao do `totalVolumeMl` do card) e tratado como 1 vaso no calculo de
`total_liters` -- sem isso o reservatorio nunca era descontado numa zona que
so configurou vazao e volume, mesmo o card ja exibindo um volume nao-zero
para as mesmas regas no historico.

#### `async_add_schedule(schedule)`

Adiciona um horario ao final da lista. Se o `id` (opcional) colidir com um
horario existente, gera um novo id em vez de criar duplicata.

#### `async_update_schedule(schedule_id, **fields)`

Atualiza um horario existente. O ID e imutavel. Levanta
`ServiceValidationError` se `schedule_id` nao existir (nao e mais um no-op
silencioso).

#### `async_remove_schedule(schedule_id)`

Remove um horario pelo ID. Levanta `ServiceValidationError` se `schedule_id`
nao existir (nao e mais um no-op silencioso).

#### `async_water_now(duration)`

Inicia uma rega manual imediata. Sem duracao, usa `default_duration`.

#### `async_stop()`

Interrompe a rega atual e tenta desligar a entidade alvo.

#### `async_options_updated()`

Recalcula o proximo horario depois de uma alteracao nas options sem interromper
uma rega ativa.

#### `_async_start_run(duration, source, schedule_id)`

Resolve `resolve_target_services(target_domain)` ANTES de qualquer mutacao de
estado -- um dominio invalido (so possivel com uma entrada de config
corrompida a mao; o config flow ja restringe aos 4 dominios suportados)
falha alto sem deixar a zona travada em "regando" sem timer. Em seguida,
inicia a rega, grava o estado no Store (incluindo um snapshot de
`ph_value`/`ec_value`/`ec_unit` lido AGORA, para o log de historico) dentro
de um `try/except`: se o `async_save_entry` falhar (I/O do Store), TODO o
estado em memoria e revertido (`_is_watering=False` etc.) em vez de deixar a
zona presa em "Regando" para sempre sem timer nem turn_on enviado. So depois
do save bem-sucedido liga o alvo, arma imediatamente o timer de VERIFICACAO
DE ATUACAO e so entao o timer de desligamento (nessa ordem: para uma rega
com `duration < ACTUATION_GRACE` os dois disparam no mesmo instante, e
callbacks no mesmo instante rodam na ordem de registro -- a verificacao de
atuacao precisa ser a decisora, nao o timer generico de parada). Se o
`turn_on` em si lancar (dispositivo inalcancavel), desliga defensivamente e
delega a `_async_abort_run()`; para uma rega AGENDADA, marca
`schedule_warnings[schedule_id] = WARNING_TARGET_NEVER_ACTUATED` antes disso
(mesmo texto/badge do caminho de `_async_actuation_check_fired`). No inicio,
`schedule_warnings.pop(schedule_id, None)` remove qualquer aviso anterior
daquele horario (de pH ou de atuacao) -- ele esta prestes a regar de novo,
entao o aviso antigo nao se aplica mais.

#### `_async_finish_run(turn_off, remove_state, expected_run_id, log_history=True)`

Finaliza uma rega. Cancela timers, tenta desligar o alvo ate tres vezes,
confirma o estado atual (`_async_target_is_off`, exige `off`/`closed`
afirmativo) e preserva o Store se o desligamento nao for confirmado. Antes de
desligar, verifica se o alvo REALMENTE atuou EM ALGUM MOMENTO desta rega --
`self._active_actuated` (flag sticky setada pela verificacao de atuacao
adiada ou pelo listener ao ver o alvo ligado) OU `_async_target_is_actuated()`
(estado atual agora) -- se nenhum dos dois for verdadeiro, `log_history` e
forcado a `False` independente do valor passado: um desligamento (timer normal, `stop` manual, ou a corrida entre os
dois numa rega curtissima) sobre um alvo que nunca ligou nao pode virar uma
entrada de historico fantasma. A flag sticky e o que distingue esse caso de
uma PARADA EXTERNA legitima (alvo regou de verdade e foi desligado por um
automacao/usuario fora do card): nesse caso o alvo ja esta desligado no
instante em que `_async_finish_run` roda, mas a rega e registrada mesmo
assim porque `_active_actuated` ja tinha sido setada antes. Quando loga, usa
a duracao REAL decorrida (nao a solicitada -- uma rega parada cedo grava
quanto realmente regou). Quando o desligamento NAO e confirmado apos as tres
tentativas, o registro do Store sobrevive (rede de seguranca de recuperacao)
mas o historico/deducao ainda acontecem agora, se `history_actuated` for
verdadeiro -- para o registro sobrevivente nao ser logado de novo por um
restart futuro, `_async_store_mark_history_logged()` marca `history_logged:
true` nele ANTES de logar (ver `_async_recover_state`).

#### `_async_store_mark_actuated()`

Persiste `actuated: true` no registro do Store desta zona, no exato momento
em que a flag sticky `_active_actuated` vira `True` em memoria (verificacao
de atuacao adiada, listener do alvo, ou retomada pos-restart bem-sucedida).
Sem isso, um crash logo depois nao deixaria NENHUM rastro persistido de que o
alvo realmente atuou -- a recuperacao pos-restart (que nao tem estado em
memoria para consultar) nao teria como distinguir uma rega que genuinamente
regou (e travou) de uma cujo `turn_on` nunca chegou a fazer efeito antes do
crash. No-op se o registro ja sumiu do Store (rega ja terminou normalmente)
ou ja esta marcado. Usa `store.async_update_entry` (load-muta-save atomico
sob um unico lock) em vez de `async_load()` + `async_save_entry()` separados
-- essa segunda forma tinha uma race real com `_async_store_mark_history_
logged` para o MESMO registro (cada uma carregava seu proprio snapshot
desatualizado e a que salvasse por ultimo apagava o campo da outra;
reproduzido com uma interleaving forcada antes do fix).

#### `_async_store_mark_history_logged()`

Persiste `history_logged: true` no registro do Store desta zona. Chamado por
`_async_finish_run` bem antes de logar, mas SO quando o registro esta prestes
a sobreviver (desligamento nao confirmado). Sem isso, `_async_recover_state`
nao teria como saber que aquele registro sobrevivente JA foi logado e
descontado do reservatorio, e o logaria de novo no proximo restart --
duplicando a rega no historico e a deducao de volume para uma UNICA rega
fisica (achado real, corrigido; reproduzido empiricamente antes do fix:
`turn_off` falhando 3x -> log imediato -> restart -> log duplicado). Tambem
usa `store.async_update_entry` pelo mesmo motivo de `_async_store_mark_
actuated` (ver acima).

#### `_async_abort_run()`

Aborta uma rega que nao conseguiu atuar (ex.: `turn_on` lancou excecao).
Cancela timers, limpa todo o estado em memoria (inclusive o snapshot de
pH/EC) e so remove o registro do Store se o alvo estiver CONFIRMADO desligado
(`_async_target_is_off`) -- se o desligamento defensivo do chamador nao pode
ser confirmado, o registro e preservado para a recuperacao pos-restart, igual
a politica de `_async_finish_run`.

#### `_async_stop_timer_fired()`

Callback executado quando a duracao da rega termina.

#### `_async_actuation_check_fired(expected_run_id, grace)`

Verifica se o alvo saiu do estado desligado apos a janela de tolerancia para
dispositivos lentos. Se nao atuou, delega inteiramente a `_async_finish_run(
turn_off=True, ...)`, que tenta desligar ate tres vezes com confirmacao e
PRESERVA o Store se o alvo nunca confirmar desligado -- uma atuacao tardia
(o dispositivo so liga DEPOIS do aborto, ex. um retry de rota numa rede
mesh) nao fica sem nenhum vigilante: a recuperacao pos-restart pega o
registro preservado e tenta desligar de novo no proximo boot. Para uma rega
AGENDADA, marca `schedule_warnings[schedule_id] = WARNING_TARGET_NEVER_
ACTUATED` ANTES de chamar `_async_finish_run` (que limpa `_active_source`/
`_active_schedule_id`) -- mesmo badge `!`/tooltip do gate de pH no card,
sinalizando "tomada nao ligou" em vez de "pH fora do intervalo".

#### `_async_schedule_fired()`

Callback do proximo horario agendado. Ignora disparos sobrepostos e, quando o
gate de pH bloqueia (ver `_check_ph_gate`), pula a rega registrando um aviso
em `schedule_warnings` em vez de iniciar. O corpo roda em `try/finally`
garantindo que `_reschedule_next()` sempre execute (defesa extra: o
`duration` de cada horario ja e validado em `schedules`, mas o timer e
one-shot -- qualquer excecao aqui sem isso pararia o agendamento da zona ate
restart).

#### `_check_ph_gate()`

Verifica se a rega agendada pode comecar. Checa o reservatorio R1 e, se
`ph_entity_id_2` estiver configurado, TAMBEM o reservatorio R2 independente
-- so permite a rega se AMBOS passarem (o primeiro que falhar bloqueia). Por
reservatorio: sem `ph_entity_id` configurado esse reservatorio esta
desativado (permite sempre); com sensor ausente/indisponivel/valor nao
numerico OU nao finito (`NaN`/`inf`), bloqueia (falha segura); com leitura
fora de `[ph_min, ph_max]`, bloqueia. O motivo e prefixado com `R1:`/`R2:`
somente quando os dois reservatorios estao em uso (evita mudar a mensagem
para quem usa so R1). So se aplica a regas agendadas -- `water_now` sempre
ignora os dois.

#### `_check_ph_range(entity_id, ph_min, ph_max, label="")`

Helper reutilizado por `_check_ph_gate` para checar UM sensor de pH contra
sua faixa; contem toda a logica fail-safe (sensor ausente/valor invalido/
fora de faixa).

#### `_async_target_state_changed(event)`

Registrado incondicionalmente em `async_setup` (nao so enquanto rega): se a
zona NAO esta regando, delega a `_async_maybe_start_external_run` em vez de
ignorar o evento -- e assim que uma ativacao fora da integracao (botao
fisico, app do proprio dispositivo, outra automacao) e detectada. Enquanto
JA esta regando, detecta desligamento externo. Usa o estado atual da entidade (nunca o
snapshot do evento) e ignora eventos `off` durante a janela de atuacao para
evitar ecos atrasados. Quando o estado atual mostra o alvo ATUADO, seta a
flag sticky `_active_actuated = True` imediatamente (independente da janela
de graca) -- e o que permite uma parada externa legitima, mais tarde, ainda
ser registrada no historico mesmo o alvo ja estando desligado nesse momento.
So trata como parada externa LEGITIMA um estado em `confirmed_off_states`
(afirmativo `off`/`closed`) -- `unavailable`/`unknown` (ou a entidade
ausente do state machine) sao IGNORADOS em vez de finalizar a rega: tratar
isso como parada confirmada finalizaria com `turn_off=False` (nenhum
turn_off sequer tentado) e descartaria o registro de recuperacao sem
confirmacao, violando a mesma politica que `confirmed_off_states` garante em
todo o resto do codigo. O timer normal de parada (que usa `turn_off=True`
com retry/confirmacao/retencao) continua sendo quem encerra a rega nesses
casos. Quando a parada externa e realmente aceita (fora da janela de graca)
para uma rega AGENDADA, marca `schedule_warnings[schedule_id] =
WARNING_TARGET_STOPPED_EARLY` ANTES de chamar `_async_finish_run` --
ambiguo entre uma queda real de energia/conexao e uma parada externa
intencional (outra automacao, override manual), mas nao ha como distinguir
so pelo estado da entidade, entao os dois casos mostram o mesmo aviso. A
rega continua sendo registrada normalmente no historico (ela regou, so nao
completou o tempo previsto) -- o aviso e so informativo, nao afeta
`log_history`.

#### `_async_maybe_start_external_run()`

Chamado por `_async_target_state_changed` quando a zona NAO esta regando.
Ignora qualquer coisa que nao seja um estado atuado agora mesmo (`off`/
`closed`, `unavailable`/`unknown`, entidade ausente -- mesmo raciocinio
fail-safe de `off_states` usado em todo o resto do codigo); caso contrario
delega a `_async_start_external_run()`.

#### `_async_start_external_run()`

Rastreia uma rega iniciada FORA da integracao (botao fisico, app do proprio
dispositivo, outra automacao). O alvo ja esta confirmado atuado -- e
literalmente o que disparou este metodo -- entao pula a chamada de
`turn_on` e a verificacao de atuacao com janela de graca que
`_async_start_run` precisa para um comando que ela mesma acabou de emitir
(`_active_actuated` comeca `True`, nao `False`). Tudo o mais segue o MESMO
ciclo de vida de qualquer rega: persistencia no Store (`source: "external"`,
`schedule_id: None`, `actuated: true`), indicador "Regando" ao vivo no card,
e o timer de PARADA como rede de seguranca -- armado para
`default_duration` da zona (nao ha como saber quanto tempo quem ligou
pretendia deixar aberto, entao usa a mesma duracao padrao de um `water_now`
sem duracao explicita). O gate de pH NAO se aplica aqui: ele so trava uma
decisao que a integracao esteja prestes a tomar, e a essa altura o alvo ja
esta ligado -- nao ha mais nada a bloquear. Se o `async_save_entry` falhar,
reverte todo o estado em memoria SEM tentar desligar o alvo (nunca o
comandamos, entao nao ha base para presumir que deveria ser desligado; so a
nossa contabilidade falhou). Encerra pelos caminhos normais
(`_async_stop_timer_fired` no `finishes_at`, ou um desligamento externo
confirmado antes disso via `_async_target_state_changed`), entao historico e
deducao do reservatorio funcionam identicos a qualquer outra rega.

#### `_reschedule_next()`

Cancela o timer anterior e agenda um unico proximo disparo.

#### `_cancel_next()`, `_cancel_stop()`, `_cancel_actuation()`

Cancelam, respectivamente, o timer do proximo horario, o timer de desligamento
e o timer de verificacao de atuacao.

#### `_async_recover_state()`

Recupera regas interrompidas por restart. Regas expiradas recebem desligamento
defensivo; regas ainda ativas restauram tambem o snapshot de pH/EC
(`ph_value`/`ec_value`/`ec_unit` e as versoes R2) persistido no Store -- sem
isso, uma rega retomada que termina normalmente gravaria `None` no historico
mesmo com a leitura original salva. Recebem um novo timer de parada e sao
imediatamente verificadas contra `_async_target_is_actuated()` (uma retomada
nao ganha a janela de `ACTUATION_GRACE` de uma rega nova); se atuado, seta a
flag sticky `_active_actuated = True`. Se o alvo NAO estiver atuado, delega o
desligamento a `_async_finish_run(turn_off=True, ...)` (retry com confirmacao
+ preserva o Store se o alvo nao puder ser confirmado desligado -- mesma
politica de `_async_actuation_check_fired`) em vez de uma tentativa unica que
removeria o registro incondicionalmente. `duration`/`started_at` corrompidos
no Store nunca derrubam o setup: `duration` invalido e recalculado a partir
do intervalo `started_at..finishes_at` (`_coerce_stored_duration`) em vez de
um `int()` cru que lancava `ValueError`; um `finishes_at`/`started_at` naive
(sem timezone) e normalizado com `dt_util.as_utc()` antes de comparar com
`utcnow()` em vez de lancar `TypeError`. Uma rega que expirou durante o
downtime e tambem registrada no historico (ela rodou seu curso, so nao
pudemos ver) -- MAS somente quando o registro do Store carrega
`actuated: true` (persistido por `_async_store_mark_actuated`) E ainda nao
`history_logged: true` (persistido por `_async_store_mark_history_logged`).
As duas checagens corrigem achados reais: sem `actuated`, um registro cujo
`turn_on` nunca confirmou atuacao antes de um crash (o Store e salvo ANTES do
`turn_on` em `_async_start_run`) seria logado como uma rega fantasma sem
nenhuma evidencia; sem `history_logged`, um registro que sobreviveu porque o
desligamento nao foi confirmado (mas que `_async_finish_run` JA logou
naquele momento) seria logado DE NOVO aqui, duplicando a rega no historico e
a deducao do reservatorio para uma unica rega fisica -- reproduzido
empiricamente antes do fix. `started_at`/`recovered_started_at` naive (sem
timezone) sao normalizados com `dt_util.as_utc()` logo apos o parse em AMBOS
os ramos (retomada e expirado durante downtime) -- normalizar so
`finishes_at` (fix anterior) nao bastava: `_coerce_stored_duration`/
`_async_log_history` tambem subtraem `started_at` de um datetime aware, o que
lancava `TypeError` e derrubava o setup inteiro da zona com um Store
corrompido.

#### `_async_call_target_service(turn_on)`

Chama o servico correto para o dominio alvo: `homeassistant.turn_on/off` para
switch, light e input_boolean; `valve.open_valve/close_valve` para valvulas.

#### `_async_target_is_actuated()` e `_async_target_is_off()`

Consultam o estado atual da entidade. `_async_target_is_actuated` usa
`off_states` (inclui `unavailable`/`unknown` como "nao atuando" -- direcao
segura: nao presume que o alvo ligou so porque nao conseguimos confirmar).
`_async_target_is_off` usa `confirmed_off_states`, que EXCLUI
`unavailable`/`unknown`: decide se e seguro descartar o registro de
recuperacao do Store, e um alvo que so parou de reportar NAO e prova de que a
valvula fechou fisicamente.

#### `_async_wait(delay)`

Espera usando `async_call_later`, sem bloquear o event loop.

#### `_async_dispatch_update()`

Envia o sinal dispatcher que atualiza as tres entidades da zona.

#### `_async_log_history(started_at, finished_at, source, schedule_id, ph_value, ec_value, ec_unit)`

Registra uma rega concluida no log de historico (30 dias, `HISTORY_MAX_ENTRIES`
como teto absoluto independente da idade). Best-effort: uma falha de
armazenamento aqui nunca derruba o fluxo de finalizacao da rega (historico e
informativo, nao critico para seguranca). Atualiza `self._history`/`last_run`
em memoria com o resultado ja podado retornado pelo Store. Ao final, calcula o
volume TOTAL entregue nesta rega (`flow_rate_lph / 3600 * duration *
number_of_pots`, os mesmos valores ja usados no historico) e chama
`_deduct_reservoir_volume` -- reaproveita o mesmo call site/gate que ja decide
se a rega realmente aconteceu, entao uma rega descartada pelo gate (nunca
atuou) nunca desconta o reservatorio.

#### `_read_sensor_value(entity_id)` / `_read_sensor_unit(entity_id)`

Leitura best-effort do valor numerico/unidade atual de um sensor configuravel
(pH ou EC). Retornam `None` para entidade nao configurada, ausente,
indisponivel, valor nao numerico ou nao finito -- usados para o snapshot do
historico, onde uma leitura desconhecida deve simplesmente ser gravada como
desconhecida, nunca bloquear nada.

### `next_run.py`

Modulo puro, sem imports do Home Assistant.

#### `find_next_run(schedules, now, enabled)`

Retorna `(datetime, schedule)` do proximo horario valido. Trata virada de
semana, horarios desabilitados e DST. Um `days` malformado (nao lista/tupla
-- string, int, `None`, etc., so possivel com um Store/options editado a
mao) e tratado como "nenhum dia configurado" (schedule pulado) em vez de
lancar `TypeError`: antes desse fix, `weekday not in schedule.get("days",
[])` estourava para qualquer `days` nao-container, o que derrubava esta
funcao inteira e, via `_reschedule_next`, o `async_setup_entry` da zona
inteira por causa de UM horario corrompido -- contradizendo o proprio
contrato documentado aqui de que `time`/`days` invalidos degradam
graciosamente (mesmo tratamento que `_parse_schedule_time` ja da a um
`time` invalido).

#### `compute_next_run(schedules, now, enabled)`

Retorna somente o `datetime` do proximo horario.

#### `resolve_target_services(domain)`

Retorna o dominio e os servicos corretos para acionar o alvo.

#### `off_states(domain)`

Retorna os estados que significam "nao atuando" (usado para decidir se uma
rega deve ser abortada por falta de atuacao). Para valvula: `closed`,
`unavailable`, `unknown`; para switch/light/input_boolean: `off`,
`unavailable`, `unknown`.

#### `confirmed_off_states(domain)`

Mais estrito que `off_states`: exclui `unavailable`/`unknown`. Usado apenas
para decidir se e seguro descartar o registro de recuperacao do Store (nunca
para decidir se uma rega deve ser abortada) -- um dispositivo que so parou de
reportar nao e prova de que fechou fisicamente.

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

Salva (sobrescreve) o estado de uma rega usando lock para evitar conflito
entre zonas. **Nao e seguro para read-modify-write**: ler o estado atual com
`async_load()` e depois chamar `async_save_entry` com uma copia modificada e
DUAS operacoes com lock independentes (adquire/libera cada uma) -- entre elas
outro chamador pode fazer o mesmo ciclo para a MESMA `entry_id` e ter sua
mudanca apagada por um `save_entry` posterior que carrega um snapshot antigo.
Para mutar um campo de um registro existente, usar `async_update_entry` (ver
abaixo). `async_save_entry` continua correto para uma escrita "cega"
(sobrescrita completa e intencional, ex.: `_async_start_run` gravando o
payload inicial de uma rega nova).

#### `async_update_entry(entry_id, mutator)`

Le, muta e grava UMA `entry_id` atomicamente, com o lock preso do inicio ao
fim do ciclo (nunca liberado entre o load e o save). `mutator` recebe o
`run_state` atual (`None` se nao existir) e retorna o novo valor a persistir,
ou `None` para no-op. Existe para corrigir uma race real: antes desta funcao,
`IrrigationScheduler._async_store_mark_actuated`/`_async_store_mark_history_
logged` faziam `async_load()` + `async_save_entry()` separados -- reproduzido
com uma interleaving forcada, duas chamadas concorrentes para o MESMO
registro (uma marcando `actuated`, outra `history_logged`) faziam a que
salvasse por ULTIMO apagar o campo que a outra ja tinha persistido, porque
cada uma carregava seu proprio snapshot ANTES da gravacao da outra. Usar
sempre que a operacao for "mudar um campo de um registro que ja pode
existir", nunca uma sobrescrita cega completa.

#### `async_remove_entry(entry_id)`

Remove o estado runtime de uma zona.

#### `async_load_history(entry_id, max_age_days, max_entries)`

Carrega o log de regas concluidas de uma zona, ja podado (idade + teto de
quantidade). Podar tambem na LEITURA (nao so na escrita) importa para a
recuperacao pos-restart: se o HA ficou desligado alem da janela de retencao,
entradas antigas nao devem ressurgir so porque nada foi anexado desde entao.
`_prune_history` normaliza um `started_at` naive (sem timezone -- so possivel
com um Store corrompido/editado a mao) com `dt_util.as_utc()` antes de
comparar com o corte de idade, em vez de lancar `TypeError` e derrubar a
poda para TODAS as zonas que compartilham o mesmo Store.

#### `async_append_history(entry_id, record, max_age_days, max_entries)`

Insere uma rega concluida no inicio do log, poda e persiste. Retorna a lista
podada resultante (mais recente primeiro) para o scheduler atualizar seu
cache em memoria.

#### `_async_load_unlocked()`

Carrega o Store quando o chamador ja possui o lock. `entries` (regas
ativas/em andamento, apagada quando a rega termina) e `history` (regas
concluidas, anexado e podado, nunca apagado ao terminar) ficam
DELIBERADAMENTE no mesmo payload/lock/arquivo em vez de um segundo Store:
ja precisam da mesma disciplina de lock, e um unico arquivo evita os dois
saírem de sincronia.

### Plataformas de entidades

#### `switch.py - async_setup_entry(hass, entry, async_add_entities)`

Cria o switch `schedule_enabled`. `async_turn_on` e `async_turn_off` alteram
o agendamento geral da zona.

#### `sensor.py - async_setup_entry(hass, entry, async_add_entities)`

Cria o sensor `next_run`, que publica proximo horario, horarios, IDs das
entidades irmas, vazao por vaso, vasos, volume do reservatorio
(`reservoir_volume_l` e `reservoir_remaining_l`), configuracao do gate de pH,
`ec_entity_id` e os avisos de horarios pulados (`schedule_warnings`).

#### `binary_sensor.py - async_setup_entry(hass, entry, async_add_entities)`

Cria o binary sensor `watering`, com estado e dados da rega atual, alem de
`last_run` (rega mais recente concluida) e `history` (log de 30 dias).

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
| `set_zone_options` | Atualiza duracao padrao, vazao por vaso, vasos, volume do reservatorio, o gate de pH (sensor + faixa min/max) e o sensor de EC (so exibicao). |
| `refill_reservoir` | Zera o consumo rastreado: `reservoir_remaining_l = reservoir_volume_l`. Sem parametros. |

Exemplo:

```yaml
service: irrigation_scheduler.set_zone_options
  entity_id: sensor.garden_next_run
  default_duration: 900
  flow_rate_lph: 8
  number_of_pots: 12
  reservoir_volume_l: 1000
  ph_entity_id: sensor.reservatorio_ph
  ph_min: 5.5
  ph_max: 6.5
```

## Card Lovelace

Arquivo fonte: `frontend-src/src/card.ts`.

### Funcoes puras de `utils.ts`

| Funcao | Funcao |
|---|---|
| `parseTimeParts` | Faz parse e valida hora, minuto e segundo. |
| `formatTime` | Exibe horario sem segundos quando eles sao zero. |
| `dayLabels` | Retorna as abreviacoes dos dias, sempre em pt-BR (o card e Portuguese-only por design). |
| `dayInitials` | Retorna uma letra por dia (S T Q Q S S D), mesma ordem de `dayLabels`. Ambiguo de proposito -- a posicao fixa no indicador e que informa qual dia e, nao a letra isolada. |
| `allDaysLabel` | Retorna `Todos os dias`. |
| `isAllDays` | Detecta se os sete dias estao selecionados. |
| `formatDuration` | Formata segundos em segundos, minutos e horas. |
| `remainingSeconds` | Calcula segundos restantes ate `finishes_at`. |
| `formatRemaining` | Exibe contagem no formato `MM:SS` ou `H:MM:SS`. |
| `progressPct` | Calcula progresso de 0 a 100%. |
| `waterVolume` | Calcula litros recebidos por um vaso. |
| `perPotVolumeMl` | Calcula ml recebidos por vaso. |
| `durationSecondsForPerPotVolumeMl` | Inverso de `perPotVolumeMl`: calcula a duracao (segundos) que entrega um volume alvo a um vaso, dada a vazao. `null` sem vazao configurada. |
| `totalVolumeMl` | Calcula ml totais: ml por vaso multiplicado pelo numero de vasos. |
| `formatVolume` | Formata litros. |
| `formatVolumeFraction` | Formata "restante/total L" (cada lado arredondado a no maximo 1 casa decimal) -- usado pelo badge de volume do reservatorio. |
| `averageDailyVolumeL` | Media de litros/dia que os horarios HABILITADOS da zona consumiriam, na vazao/vasos atuais (volume por disparo x dias/semana do horario, somado e dividido por 7). Retorna `0` sem horario habilitado ou sem vazao configurada -- o chamador usa isso para esconder a estimativa de "quando vai acabar" em vez de mostrar um prazo sem sentido. |
| `formatReservoirEstimate` | "~3 h" / "~12 dias" / "~2 meses" ate o reservatorio esvaziar, dado o volume restante e o consumo medio diario. Unidade adaptativa: horas abaixo de 1 dia, dias ate 60, meses depois disso. Retorna `"Vazio"` se ja esta em 0, e `null` (sem estimativa) se o consumo medio e 0. |
| `formatMl` | Formata ml ou converte para litros acima de 1000 ml. |
| `sanitizeSchedules` | Remove horarios invalidos e normaliza os campos. |
| `sortSchedulesByTime` | Copia ordenada por horario crescente (so exibicao -- nao afeta qual horario dispara em seguida, isso e calculado por horario+dias independente da ordem da lista). |
| `timeToSeconds` | Converte uma hora para segundos desde meia-noite. |
| `toServiceTime` | Normaliza hora para `HH:MM:SS`. |
| `formatSensorReading` | Arredonda uma leitura de sensor (pH/EC) a 2 casas e anexa a unidade; `?` para valor nao finito. |
| `dayLabelFor` | "Hoje" / "Ontem" / "12/08" para uma data relativa a `nowIso`, ambas avaliadas no `timeZone` do SERVIDOR HA (nao o fuso do navegador) quando informado; `""` se nao parseavel. |
| `groupHistoryByDay` | Agrupa entradas de historico por dia CALENDARIO no `timeZone` do servidor (mesmo raciocinio de `dayLabelFor` -- sem isso, um admin em outro fuso veria uma rega agrupada no dia errado), somando o volume total de cada dia via `totalVolumeMl`. |
| `scheduleStatusToday` | Status do horario HOJE, no `timeZone` do servidor: `"warning"` (prioridade sobre tudo, de `schedule_warnings`), `"pending"` (hoje e um dos dias do horario e o horario ainda nao chegou), `"done"` (hoje e um dos dias, o horario ja passou, e existe uma entrada em `history` do MESMO `schedule_id` no MESMO dia calendario), ou `null` (horario desabilitado, hoje nao e um dos dias, ou o horario ja passou sem aviso E sem entrada de historico correspondente -- ambiguo, nao vira nem "certo" nem "errado"). |
| `sourceLabel` / `sourceIcon` | Rotulo ("agendada"/"manual"/"ativada no dispositivo") e icone mdi para o campo `source` de uma rega (`schedule`/`manual`/`external`); valores desconhecidos ou ausentes caem em "agendada" (comportamento ja existente antes de `external` existir). Usado no ultimo-rega, no historico e na barra "Regando" ao vivo. |

### Metodos do card

| Metodo | Funcao |
|---|---|
| `setConfig` | Valida e salva a configuracao YAML do card. |
| `getCardSize` | Informa o tamanho estimado para o Lovelace. |
| `render` | Renderiza erro de configuracao ou o card da zona. Alem do prefixo `sensor.`, exige que a entidade tenha os atributos `switch_entity_id`/`binary_sensor_entity_id` (contrato exclusivo do sensor `next_run` desta integracao) antes de renderizar -- qualquer outro sensor HA cai no erro de configuracao em vez de tentar renderizar com atributos ausentes. |
| `_renderCard` | Renderiza cabecalho em duas linhas: titulo + status/toggle/engrenagem na primeira; abaixo, uma linha por reservatorio "em uso" (`.header-badges`, grade de 6 colunas fixas -- rotulo/pH/EC/volume/estimativa/refil -- para R1 e R2 alinharem coluna a coluna). A linha R1 conta como em uso com pH OU EC configurados **OU** `reservoir_volume_l > 0` -- uma zona sem nenhum sensor de pH/EC mas com volume+vazao configurados ainda precisa mostrar os controles de volume/estimativa/refil. A linha R2 so aparece com pH2/EC2 configurados (nao herda o fallback de volume: os controles de volume ja aparecem uma vez na linha R1). Depois: proximo horario, ultima rega, separador, lista de horarios (sempre em ordem crescente via `sortSchedulesByTime`, independente da ordem de criacao), botoes de acao (`.action-circle`: dois circulos preenchidos, "+" abre o dialogo de adicionar horario e o play chama `water_now`) e settings. |
| `_renderReservoirRow` | Renderiza uma linha de badges (rotulo opcional "R1"/"R2" + pH + EC + volume + estimativa + botao de refil) como um ARRAY de siblings (nao um template combinado) -- cada badge precisa ser filho direto de `.header-badges` para a grade CSS alinhar as colunas corretamente entre as duas linhas. O rotulo "R1"/"R2" SO e passado quando as DUAS linhas estao visiveis (nada a desambiguar com um reservatorio so); caso contrario o chamador passa `""` e um placeholder invisivel ocupa a celula, mantendo as 6 colunas fixas nas duas linhas. O texto do badge de pH/EC NAO leva mais o sufixo " R2": o rotulo da linha ja desambigua quando presente. O badge de volume (`reservoir_remaining_l`/`reservoir_volume_l`), a estimativa e o botao de refil sao os MESMOS elementos repetidos nas duas linhas quando ambas existem (a zona so tem um reservatorio configurado no sentido de rastreamento -- so a leitura de pH/EC e por reservatorio fisico; ver "Opcao A" na decisao de design). |
| `_renderScheduleRow` | Renderiza um horario em duas linhas: hora + indicador fixo de 7 dias (`dayInitials`, cinza quando o dia nao esta marcado) + icone de status (via `scheduleStatusToday`) na linha de cima -- `!` amber (aviso em `schedule_warnings`, tooltip `"Aviso: ${warning}"`), `check-circle` verde ("Rega de hoje concluída") ou `clock-outline` neutro ("Ainda vai regar hoje"); nenhum icone quando o status e ambiguo. Duracao, volume total e ml por vaso na linha de baixo. O switch fica na coluna mais a esquerda da linha (fora do bloco de info), editar/excluir na coluna mais a direita. |
| `_renderDialog` | Renderiza o formulario de adicionar/editar horario. A duracao usa uma unica caixa hh:mm:ss (2 digitos cada, sem as setas de incremento do input number) em vez de campos separados de min/seg. Quando a vazao por vaso esta configurada, mostra tambem "Volume por vaso (ml)" calculado a partir da duracao. |
| `_renderSettings` | Renderiza duracao padrao, vazao por vaso, vasos, reservatorio, o gate de pH R1 (sensor + faixa min/max), o sensor de EC R1 (so exibicao) e os mesmos 3 campos para o reservatorio R2 independente. |
| `_sensorBadgeText` | Formata o texto do badge de pH/EC via uma funcao `render(value, unit)` fornecida pelo chamador -- o pH usa um sufixo fixo "PH" (ignora a unidade propria do sensor, evitando duplicar "PH 5.4pH"); o EC usa a unidade real do sensor. |
| `_phStatusClass` | Retorna `in-range`/`out-of-range`/`""` para colorir o badge de pH conforme a leitura atual esta dentro de `[ph_min, ph_max]`. |
| `_openMoreInfo` | Despacha o evento `hass-more-info` (dialogo nativo do HA, com o historico/grafico diario) para a entidade clicada -- usado pelos badges de pH/EC. |
| `_lastRunAttr` / `_historyAttr` | Leem e validam estruturalmente `last_run`/`history` dos atributos do binary_sensor. |
| `_lastRunText` | Formata a linha "Ultima rega: Hoje 06:00 · agendada · 6 min · 800 ml/vaso" (fonte via `sourceLabel`, tambem cobre "ativada no dispositivo"). |
| `_openHistory` / `_closeHistory` | Abrem/fecham o dialogo de historico. |
| `_renderHistoryDialog` | Renderiza o dialogo de historico: estatisticas do periodo (contagem, total) e a lista agrupada por dia via `groupHistoryByDay`. |
| `_renderHistoryDayGroup` | Renderiza o cabecalho de um dia (label + contagem + total) e suas entradas. |
| `_renderHistoryEntry` | Renderiza uma rega do historico: horario, fonte (via `sourceLabel`/`sourceIcon` -- agendada/manual/ativada no dispositivo), duracao, ml/vaso e pH/EC dos dois reservatorios (quando presentes; R2 sufixado " R2"). |
| `_waterNow` | Chama `water_now`. |
| `_stopWatering` | Chama `stop`. |
| `_refillReservoir` | Confirma com o usuario (`window.confirm`) e, se aceito, chama `refill_reservoir`. |
| `_toggleMaster` | Liga/desliga o agendamento geral. |
| `_toggleScheduleEnabled` | Habilita/desabilita um horario individual. |
| `_deleteSchedule` | Confirma e remove um horario. |
| `_saveDialog` | Combina hh:mm:ss em segundos, valida e chama add/update schedule. So fecha o dialogo se o servico confirmar sucesso; numa falha do backend (ex. `ServiceValidationError`), mantem o dialogo aberto e mostra a mensagem de erro em vez de fechar como se tivesse salvo. |
| `_onVolumeChange` | Converte o volume por vaso (ml) digitado de volta em hh:mm:ss usando a vazao da zona (`durationSecondsForPerPotVolumeMl`, inverso de `perPotVolumeMl`); no-op se a vazao nao estiver configurada. |
| `_saveSettings` | Valida (inclusive `ph_min <= ph_max` e `ph_min_2 <= ph_max_2`, independentemente) e chama `set_zone_options` com duracao padrao (min -> segundos), vazao, vasos, reservatorio e pH/EC dos dois reservatorios; so envia `ph_entity_id`/`ec_entity_id` (e as versoes `_2`) quando o campo foi de fato editado (string vazia e um valor explicito que desativa/limpa, diferente de "nao alterado"); nao chama o servico se nada mudou. So fecha o painel se o servico confirmar sucesso; numa falha do backend, mantem o painel aberto e mostra a mensagem de erro. |
| `_callService` | Chama `hass.callService` e retorna a Promise (em vez de disparar e esquecer) para que `_saveDialog`/`_saveSettings` possam reagir a falhas do backend em vez de fechar o dialogo/painel silenciosamente. |
| `_openAdd` / `_openEdit` | Abrem o formulario de horario. `_openAdd` sempre comeca com todos os campos zerados (horario `00:00`, nenhum dia, duracao `00:00:00`) -- nao pre-preenche mais com `default_duration` da zona. `_openEdit` carrega os valores do horario existente. |
| `_openSettings` / `_closeSettings` | Abrem/fecham as configuracoes do card. Fechar pelo icone de engrenagem (nao so pelo botao "Fechar") tambem reseta o formulario via `_closeSettings` -- reabrir depois nao deve mostrar valores digitados/abandonados de uma sessao anterior. |
| `_stopTicker` | Cancela a contagem regressiva de um segundo. |

### `editor.ts`

#### `IrrigationScheduleCardEditor.setConfig(config)`

Recebe a config do host do Lovelace (contrato do editor de cards: o host
chama `setConfig`, nao atribui uma propriedade `.config` diretamente). Sem
isso o host lanca `this._configElement.setConfig is not a function` e o
editor visual nunca carrega (cai para "editar via YAML").

#### `IrrigationScheduleCardEditor.render()`

Renderiza o `ha-form` do editor visual.

#### `_computeLabel(schema)`

Traduz os nomes dos campos do editor.

#### `_valueChanged(event)`

Emite `config-changed` com a configuracao atualizada. Le `event.detail.value`
como a configuracao COMPLETA do formulario (o `ha-form` do HA consolida
TODOS os campos em um unico evento `value-changed`, nunca emite um par
`{name, value}` por campo individual) e faz merge em `_config`. Antes desse
fix o handler lia `event.detail.name` -- sempre `undefined` no formato real
do `ha-form` -- entao `config-changed` nunca era despachado e o editor
visual nao salvava NENHUMA alteracao (so editar via YAML funcionava).
No-op se `detail.value` estiver ausente.

## Configuracoes armazenadas

| Chave | Unidade | Default | Uso |
|---|---:|---:|---|
| `enabled` | boolean | `true` | Agendamento geral. |
| `default_duration` | segundos | `600` | Duracao do Regar agora; editavel via options flow ou no painel de settings do card. |
| `max_duration` | segundos | `7200` | Limite de seguranca. |
| `flow_rate_lph` | L/h por vaso | `0` | Vazao usada no calculo. |
| `number_of_pots` | vasos | `0` | Multiplicador do volume total. |
| `reservoir_volume_l` | litros | `0` | Capacidade total do reservatorio. |
| `reservoir_remaining_l` | litros | = `reservoir_volume_l` | Volume restante rastreado; descontado a cada rega concluida (`_deduct_reservoir_volume`) e zerado (volta a cheio) pelo servico `refill_reservoir`. Nunca definido diretamente pelo usuario. |
| `ph_entity_id` | string | `""` | Sensor de pH (reservatorio 1); vazio desativa o gate. |
| `ph_min` / `ph_max` | pH (0-14) | `0` / `14` | Faixa que permite uma rega agendada comecar (reservatorio 1). |
| `ec_entity_id` | string | `""` | Sensor de EC (reservatorio 1); **so exibicao**, nunca trava uma rega. |
| `ph_entity_id_2` | string | `""` | Sensor de pH do reservatorio 2, independente do 1; vazio desativa esse gate. |
| `ph_min_2` / `ph_max_2` | pH (0-14) | `0` / `14` | Faixa que permite uma rega agendada comecar (reservatorio 2). |
| `ec_entity_id_2` | string | `""` | Sensor de EC (reservatorio 2); **so exibicao**. |
| `schedules` | lista | `[]` | Horarios da zona. |

## Historico de regas

Cada entrada de `history`/`last_run` (mais recente primeiro, 30 dias,
`HISTORY_MAX_ENTRIES` como teto):

| Campo | Uso |
|---|---|
| `started_at` / `finishes_at` | Horarios REAIS da rega (uma rega parada cedo grava o tempo que realmente durou). |
| `duration` | Segundos reais decorridos. |
| `source` | `schedule` ou `manual`. |
| `schedule_id` | ID do horario, ou `None` para `manual`. |
| `flow_rate_lph` / `number_of_pots` | Snapshot das configuracoes da zona NO MOMENTO da rega -- o volume historico continua correto mesmo se essas configuracoes mudarem depois. |
| `ph_value` / `ec_value` / `ec_unit` | Leitura de pH/EC do reservatorio 1 no INICIO da rega (`None` se nao configurado/indisponivel). `ec_unit` existe porque a unidade de EC varia por sensor (µS/cm, mS/cm); pH sempre exibe com o sufixo fixo "PH". |
| `ph_value_2` / `ec_value_2` / `ec_unit_2` | Mesma coisa, para o reservatorio 2 independente. |

Uma rega que nunca atuou nunca entra no historico (nenhuma agua foi
entregue), qualquer que seja o caminho que a encerre: `_async_abort_run`, a
verificacao de atuacao adiada, a retomada pos-restart sem atuacao confirmada,
o timer normal de parada, ou um `stop` manual -- `_async_finish_run` verifica
`_async_target_is_actuated()` antes de logar, entao mesmo uma corrida entre o
timer de parada e a verificacao de atuacao (regas com `duration <
ACTUATION_GRACE`) ou um `stop` manual disparado durante a janela de graca de
um alvo morto nao produzem uma entrada fantasma de `duration: 0`.

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
