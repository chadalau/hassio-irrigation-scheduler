# Revisão adversarial independente — watergaia

**Status: PRECISA DE ALTERAÇÃO**

Revisão do estado encontrado, incluindo `tests/integration/test_ph_gate.py`. Não alterei código de produção nem testes. O comando de build gerou/atualizou o artefato `custom_components/irrigation_scheduler/frontend/irrigation-schedule-card.js`; isso deve ser tratado como efeito do teste de build ao avaliar o working tree.

## Arquivos revisados

- Backend: `custom_components/irrigation_scheduler/{__init__.py,config_flow.py,scheduler.py,store.py,sensor.py,switch.py,binary_sensor.py,const.py,services.yaml}`.
- Frontend: `frontend-src/src/{card.ts,utils.ts,types.ts}`, testes Vitest e configuração/package.
- Testes backend, com atenção a `tests/integration/test_ph_gate.py`, além dos demais testes em `tests/`.
- Documentação/contratos consultados: `README.md`, `FUNCTIONS.md`.

## Achados

### CRÍTICO — pH `NaN` pode liberar um disparo agendado

**Cenário/evidência:** em `scheduler.py`, `_check_ph_gate()` faz `value = float(state.state)` e somente testa `value < ph_min` e `value > ph_max`. Para o estado textual `"nan"`, ambos os testes são falsos; a função retorna `(True, None)`. Assim, com sensor configurado e leitura `nan`, o scheduler pode acionar fisicamente a válvula, contrariando o requisito fail-safe para valor não parseável. O teste cobre `not-a-number`, mas não `nan`/`NaN`.

**Sugestão:** rejeitar explicitamente `math.isfinite(value)` antes das comparações; adicionar casos `nan`, `NaN` e, idealmente, valores com unidade/representação inesperada.

### ALTO — recuperação de estado persistido não valida `started_at`/`duration`

**Cenário/evidência:** `_async_recover_state()` valida apenas `finishes_at`; em seguida atribui `started_at = parse_datetime(...)` (pode ser `None`) e executa `int(run_state.get("duration", 0))` sem validação/clamp. Um payload de storage truncado/adulterado com `finishes_at` futuro e `duration: "x"` faz o setup falhar; com `started_at` inválido, o estado ativo fica inconsistente. Em um mecanismo de irrigação, falha de boot sem tentativa defensiva de desligamento é uma regressão de segurança física.

**Sugestão:** validar tipo, timezone, coerência `started_at <= finishes_at`, duração inteira positiva e limite máximo; diante de payload inválido, tentar desligar defensivamente e manter/remover o registro conforme confirmação de estado off, sem abortar o setup.

### MÉDIO — `set_zone_options` permite intervalo pH invertido em chamadas parciais

**Cenário/evidência:** `_validate_ph_range()` compara apenas `ph_min` e `ph_max` presentes na mesma chamada. Porém o serviço documenta campos independentemente opcionais. Após `ph_min=5, ph_max=6`, uma chamada apenas com `ph_min=10` é aceita e persiste `10..6`; o card também envia alterações parciais. Isso transforma a configuração em uma faixa impossível e bloqueia permanentemente os disparos agendados até correção manual. Os testes verificam apenas os dois limites na mesma chamada.

**Sugestão:** validar o estado efetivo combinando opções atuais + patch antes de salvar, ou exigir ambos os limites quando qualquer um for alterado. Manter a semântica de `ph_entity_id: ""` como desabilitação.

### MÉDIO — semântica de vazão por vaso está documentada, mas não é imposta/observável no backend

**Cenário/evidência:** `utils.ts` trata `flow_rate_lph` como vazão **por vaso** e multiplica pelo número de vasos apenas para exibir volume total; o scheduler envia uma única ativação do alvo, sem medição, rateio ou validação de que o alvo realmente atende cada vaso. Se o usuário informar a vazão total da linha (interpretação natural de “vazão da zona”), o card exibe total superestimado por `number_of_pots`. Não há teste de contrato cobrindo claramente “por vaso” versus “total da zona”.

**Sugestão:** tornar a unidade/semântica explícita na UI e documentação (“L/h por vaso”), ou mudar para vazão total e não multiplicar por vasos. Adicionar teste de regressão para 2 vasos e uma vazão conhecida.

### BAIXO — volume do reservatório é apenas metadado

**Cenário/evidência:** `reservoir_volume_l` é salvo e exibido no painel, mas não participa de cálculo de consumo, alerta de insuficiência ou bloqueio. `FUNCTIONS.md` inclusive o chama de “reservado para uso futuro”. Isso atende persistência, mas a UX pode sugerir uma proteção que não existe.

**Sugestão:** rotular claramente como informativo/“uso futuro”, ou implementar cálculo de consumo acumulado e alerta/bloqueio com requisitos explícitos. Não bloquear água apenas por esse valor sem sensor/estado de nível.

### BAIXO — testes backend não executaram neste ambiente

O pacote/executável `pytest` não está disponível no `PATH`, e `C:\Python314\python.exe -m pytest -q` falhou com `No module named pytest`. Portanto, a robustez real de scheduler, config flow, serviço novo e `test_ph_gate.py` não foi validada em runtime nesta revisão. A inspeção estática acima permanece aplicável.

## Falsos positivos percebidos / pontos aprovados

- O pH gate está corretamente restrito a disparos agendados; `water_now` é override manual explícito.
- O timer de desligamento é armado imediatamente após o comando de ligar, e há tentativa defensiva em falhas de atuação.
- O listener usa estado atual e token de geração, reduzindo risco de evento atrasado desligar uma execução nova.
- `set_zone_options` preserva opções não enviadas e permite desabilitar o gate com string vazia; os testes existentes cobrem essa intenção.
- A multiplicação por `number_of_pots` em `totalVolumeMl()` não é, por si só, bug se o contrato “vazão por vaso” for realmente o produto pretendido.
- O frontend tem reatividade por atributos do sensor, sinal de dispatcher e ticker de 1 s durante rega; não encontrei regressão óbvia de build/registro no caminho revisado.

## Testes/comandos executados

- `pytest -q` — **não executado**: comando não reconhecido.
- `python -m pytest -q` — **falhou no ambiente**: `C:\Python314\python.exe: No module named pytest`.
- `npm test -- --run` em `frontend-src` — **PASSOU**, 2 arquivos, 63 testes.
- `npm run build` em `frontend-src` — **PASSOU**, Rollup gerou `custom_components/irrigation_scheduler/frontend/irrigation-schedule-card.js`.
- Inspeção estática de diff/status — o diretório não é reconhecido como repositório Git neste ambiente; não foi possível distinguir alterações prévias das geradas pelo build via Git.

## Conclusão

Não aprovar por causa do bypass de `NaN` no gate físico e da recuperação de storage sem validação robusta. Corrigir os achados CRÍTICO/ALTO, acrescentar testes adversariais correspondentes e repetir a suíte backend/frontend antes de considerar **APROVADO**.
