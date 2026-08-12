# Revisao Consolidada — watergaia

**Status original: PRECISA DE ALTERACAO** · **Status apos correcoes
(2026-08-12): todos os achados abaixo foram corrigidos** — ver secao
"Correcoes aplicadas" ao final deste documento para o detalhe de cada um e
os testes de regressao adicionados.

## Revisores

| Revisor | Modelo | Resultado |
|---|---|---|
| DeepSeek | `opencode-go/deepseek-v4-flash` | Precisa de alteracao |
| Luna | `opencode-go/gpt-5.6-luna` | Precisa de alteracao |
| Qwen | `opencode-go/qwen3.7-max` | Aprovado, mas sem executar a suite HA |

O Qwen aprovou por analise estatica e nao executou os testes de integracao.
DeepSeek e Luna identificaram o mesmo problema critico de pH. A validacao
independente confirmou os achados criticos abaixo.

## Achados confirmados

### CRITICO — `NaN` no sensor de pH libera a valvula

**Arquivo:** `custom_components/irrigation_scheduler/scheduler.py`,
`_check_ph_gate()`.

`float("nan")` nao gera excecao, e as comparacoes `nan < minimo` e
`nan > maximo` retornam `False`. Assim, o gate retorna permitido e uma rega
agendada pode ligar a valvula com uma leitura de pH invalida.

**Correcao necessaria:** rejeitar valores nao finitos com `math.isfinite()` e
adicionar testes para `nan`, `NaN` e `-nan`.

### ALTO — recovery com `duration` corrompido aborta o setup

**Arquivo:** `custom_components/irrigation_scheduler/scheduler.py`,
`_async_recover_state()`.

O codigo executa `int(run_state["duration"])` sem validar o valor. Um Store
corrompido com `duration: "abc"` causa `ValueError` durante o setup da zona.
Nesse caminho nao ocorre desligamento defensivo e a integracao pode nao carregar.

**Correcao necessaria:** validar `started_at`, `duration`, timezone e coerencia
do payload. Em payload invalido, executar recovery fail-safe sem derrubar o
setup da zona.

### MEDIO — schedule corrompido mata a cadeia de agendamento

**Arquivo:** `custom_components/irrigation_scheduler/scheduler.py`,
`_async_schedule_fired()`.

Um horario com `duration: "abc"` causa `ValueError` antes de
`_reschedule_next()`. Como o timer e one-shot, a zona pode deixar de agendar
novas regas ate restart ou alteracao manual das options.

**Correcao necessaria:** validar e filtrar schedules corrompidos, e garantir
`_reschedule_next()` em `finally` no callback.

### MEDIO — atualizacao parcial pode inverter faixa de pH

**Arquivo:** `custom_components/irrigation_scheduler/__init__.py`,
`_validate_ph_range()`.

O servico aceita `ph_min` e `ph_max` individualmente, mas compara apenas os
valores presentes na mesma chamada. Uma chamada parcial que altere somente
`ph_min` pode salvar `ph_min > ph_max` usando o limite antigo.

**Correcao necessaria:** combinar options atuais com o patch antes de validar,
ou exigir os dois limites quando qualquer limite for alterado.

### MEDIO — semantica da vazao precisa ser explicita

O card calcula `flow_rate_lph` como vazao **por vaso** e multiplica pelo numero
de vasos para chegar ao total. Isso esta de acordo com a solicitacao atual,
mas labels como `Vazao (L/h)` podem ser interpretadas como vazao total da zona.

**Correcao/documentacao necessaria:** usar `Vazao por vaso (L/h)` no config flow,
options, servico, card e README. Adicionar teste de contrato, por exemplo:
8 L/h, 12 vasos e 900 segundos = 2 L por vaso e 24 L totais.

## Achados menores confirmados

- `set_schedules` sem a chave `schedules` gera `KeyError` cru.
- O teste de unload nao lista `SERVICE_SET_ZONE_OPTIONS` em `ALL_SERVICES`.
- O card pode chamar `set_zone_options` com payload vazio ao salvar sem alteracao.
- `reservoir_volume_l` e metadata para uso futuro; ainda nao reduz rega nem gera alerta.
- O selector de pH aceita qualquer entidade do dominio `sensor`; o gate falha
  fechado se o valor nao for numerico.
- O Store de recovery ainda deve validar o tipo de `duration` antes de retomar.

## Pontos aprovados

- Timer de desligamento e armado imediatamente depois do `turn_on`.
- Janela de atuacao, token `_run_id`, retry de `turn_off` e preservacao do Store
  foram confirmados como corretos.
- Gate de pH nao interfere em `water_now`, que e um override manual explicito.
- Contrato sensor -> card esta alinhado, incluindo vazao, vasos, reservatorio
  e campos de pH.
- Servicos por entidade, dispositivo e area continuam cobertos.

## Testes executados

| Suite | Resultado |
|---|---|
| Backend HA 2026.2.3 + PHCC | **77 passed** |
| Backend puro | **28 passed** |
| Frontend Vitest | **63 passed** |
| Frontend typecheck | **0 erros** |
| Frontend build | **OK** |

Os testes atuais passam, mas ainda nao cobrem os cenarios `NaN`, Store com
`duration` invalido, schedule corrompido e patch parcial de pH. Por isso a
revisao nao esta aprovada.

## Proxima rodada recomendada

1. Corrigir o bypass `NaN` do pH gate.
2. Tornar recovery e schedules defensivos contra payload corrompido.
3. Validar faixa de pH usando options atuais + patch.
4. Clarificar a unidade `L/h por vaso`.
5. Adicionar testes de regressao e executar novamente os tres reviewers.

## Correcoes aplicadas — 2026-08-12

Todos os itens da rodada recomendada acima, mais os achados menores, foram
corrigidos nesta sessao (verificado empiricamente, nao so por leitura
estatica — reproduzi o bypass de `NaN` e o crash de recovery/schedule antes
de corrigir):

1. **CRITICO `NaN` no pH gate** — `_check_ph_gate()` agora rejeita valores
   nao finitos com `math.isfinite()` apos o `float()`. Testes cobrindo
   `nan`/`NaN`/`-nan`/`inf`/`-inf` adicionados a
   `test_scheduled_run_skipped_when_ph_sensor_unusable`.
2. **ALTO recovery com `duration` corrompido** — `_async_recover_state()` usa
   `_coerce_stored_duration()` (calcula a partir de `started_at..finishes_at`
   em vez de um `int()` cru) e nunca mais derruba o setup da zona. Como
   bonus, uma rega retomada agora tambem re-verifica atuacao
   (`_async_target_is_actuated()`) em vez de so re-armar o timer de parada —
   fechando de quebra o achado B10 (recovery sem checar atuacao).
3. **MEDIO schedule corrompido mata o agendamento** — a property `schedules`
   filtra itens com `duration` invalida/fora de faixa (mesmo criterio ja
   usado para itens nao-dict); `_async_schedule_fired` roda em
   `try/finally` como defesa extra.
4. **MEDIO patch parcial inverte a faixa de pH** — `async_set_zone_options`
   valida `ph_min <= ph_max` contra o estado EFETIVO (options atuais + patch),
   nao so os campos da mesma chamada; levanta `ServiceValidationError`.
5. **MEDIO unidade `L/h` ambigua** — relabeled para "Vazao por vaso (L/h)" /
   "Flow rate per pot (L/h)" em `strings.json`, traducoes, `services.yaml` e
   no card; teste de contrato explicito (8 L/h, 12 vasos, 900s = 2 L/vaso,
   24 L total) adicionado.
6. **Achados menores**: `set_schedules` sem a chave `schedules` agora levanta
   `ServiceValidationError` (nao mais `KeyError` cru); `add_schedule` com id
   colidindo gera um id novo em vez de duplicar; `update_schedule`/
   `remove_schedule` com id inexistente levantam erro em vez de no-op
   silencioso; o "proximo horario" do card usa o fuso do servidor HA
   (`hass.config.time_zone`), nao o do navegador; o campo de pH no painel de
   settings nao reverte mais visualmente ao valor antigo quando limpo; o
   painel de settings nao chama mais o servico quando nada mudou;
   `ALL_SERVICES` no `test_init.py` agora inclui `set_zone_options`.
   **Nao corrigido de proposito**: o seletor de entidade de pH/EC continua
   aceitando qualquer `sensor.*` (sem filtro por `device_class`) — filtrar
   esconderia sensores DIY validos sem `device_class` correto, e o gate ja e
   fail-safe para uma entidade errada.

Alem da correcao dos achados, esta sessao tambem adicionou uma feature nova:
sensor de EC opcional (`ec_entity_id`, so exibicao, nunca trava uma rega,
espelhando `ph_entity_id`) e badges de pH/EC ao lado do nome da zona no card
mostrando a leitura ao vivo, clicaveis para abrir o dialogo nativo de
historico do Home Assistant (`hass-more-info`) em vez de um grafico custom.

**Validacao final (2026-08-12):**

| Camada | Verificacao | Resultado |
|---|---|---|
| Backend puro | `pytest tests/test_next_run.py tests/test_schedules.py` | 28 passed |
| Backend + HA | `pytest tests -q` (HA 2026.2.3 + PHCC) | 91 passed |
| Frontend | `npm run typecheck` / `npm run test` / `npm run build` | 0 erros / 71 passed / bundle reconstruido |
