# Revisao Consolidada — watergaia

**Status: PRECISA DE ALTERACAO**

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
