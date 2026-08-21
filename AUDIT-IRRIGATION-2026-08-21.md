# Auditoria de codigo — Irrigation Scheduler v0.12.0

**Data:** 2026-08-21  
**Commit auditado:** `1b70046` (`v0.12.0`)  
**Escopo:** backend Python, persistencia, servicos, config flow, entidades, frontend Lit/TypeScript, bundle e testes.  
**Metodo:** leitura estatica integral das superficies de maior risco, rastreamento dos fluxos de atuacao/recuperacao, lint, compilacao e execucao das suites disponiveis.  
**Alteracoes no produto:** nenhuma. Este arquivo e apenas o relatorio.

## Conclusao executiva

**Status: PRECISA DE ALTERACAO.**

O plugin tem boa defesa em profundidade: persiste o estado antes de ligar o alvo, limita duracoes, confirma desligamentos, tenta novamente, preserva um journal de recuperacao, trata pH de forma fail-safe e possui uma suite ampla. Nao encontrei injecao, execucao arbitraria, segredo exposto ou bypass direto do gate de pH.

Foi confirmado, porem, um defeito de severidade **ALTA** no ciclo de unload/reload: um watchdog criado pelo scheduler antigo pode sobreviver ao unload e atuar sobre a instancia nova. Tambem foram encontrados dois riscos de corrida de severidade **MEDIA** e um defeito de interface de severidade **BAIXA**. Ha ainda uma decisao arquitetural de seguranca que precisa ser aceita conscientemente: durante o shutdown do Home Assistant, uma rega ativa fica fisicamente ligada e sem timer local ate o proximo boot.

## Achados

### A1 — ALTA — Watchdog pode sobreviver ao unload e desligar uma rega da instancia recarregada

**Evidencias:** `scheduler.py:624-643`, `scheduler.py:1277-1293`, `scheduler.py:1975-2001`, `scheduler.py:2032-2065`, `scheduler.py:2089-2111`.

`async_unload()` cancela o watchdog existente antes de encerrar a rega. Se o `turn_off` executado por `_async_finish_run()` nao for confirmado, o proprio encerramento arma um **novo** watchdog. Nao existe uma segunda limpeza depois desse `await`, nem um flag de scheduler descarregado.

Em um reload comum, a sequencia possivel e:

1. o scheduler A entra em unload e nao confirma o alvo desligado;
2. A arma um watchdog para dali a 5 segundos e termina o unload;
3. o scheduler B e criado e recupera/inicia uma rega usando o mesmo alvo e o mesmo `entry_id`;
4. o callback ainda vivo de A executa `turn_off` sem saber que B agora e o dono;
5. A ainda pode ler e liquidar o registro **atual** do Store, que ja pode pertencer a B.

O impacto nao se limita a interromper irrigacao. O scheduler antigo pode registrar antecipadamente a execucao nova, descontar o volume planejado e remover o journal de recuperacao dela. A checagem `self._is_watering` do watchdog protege apenas contra uma rega nova no mesmo objeto antigo; ela nao conhece a nova instancia criada pelo reload.

**Correcao recomendada:** impedir que `_async_arm_shutdown_watchdog()` arme callbacks durante unload, limpar novamente o watchdog em `finally` depois de `_async_finish_run()`, e vincular cada watchdog ao `run_uid` que ele recebeu. Antes de atuar ou liquidar o Store, confirmar que a entrada ainda contem esse mesmo `run_uid`. Adicionar teste de regressao: unload com `turn_off` nao confirmado, reload imediato, nova rega e avanco alem do primeiro backoff.

### M1 — MEDIA — Um `turn_off` antigo ja em voo pode fechar uma execucao nova

**Evidencias:** `scheduler.py:1178-1188`, `scheduler.py:1228-1247`, `scheduler.py:1295-1300`.

Ao iniciar o encerramento, `_async_finish_run()` muda `_is_watering` para `False` **antes** de aguardar o servico de desligamento. Isso permite que `water_now` ou uma ativacao externa crie outra execucao enquanto o `turn_off` anterior ainda esta em voo.

O token `_run_id` e verificado antes de emitir cada tentativa e novamente depois, mas ele nao pode cancelar um comando que ja foi despachado. Em dispositivo lento/assincromo, o desligamento antigo pode ser aplicado depois do novo `turn_on`, fechando a rega nova. Os testes atuais cobrem uma nova execucao durante o intervalo entre retries, mas o mock de servico retorna imediatamente e nao cobre a janela dentro do `await self._async_call_target_service(False)`.

**Correcao recomendada:** serializar transicoes fisicas de start/finish por zona com um lock de ciclo de vida, ou impedir um novo start ate a tentativa de desligamento anterior terminar. Se a experiencia exigir start imediato, a instancia deve detectar que o `turn_off` antigo concluiu depois e reafirmar o estado ligado da geracao atual de forma controlada.

### M2 — MEDIA — Marcacao `actuated` no Store nao pertence explicitamente a uma execucao

**Evidencias:** `scheduler.py:1334-1360`, `scheduler.py:1511-1530`, `scheduler.py:1712-1750`.

`_async_store_mark_actuated()` altera qualquer registro atual daquele `entry_id`; o mutator nao compara `run_uid`. O check de `_run_id` feito pelo timer de atuacao ocorre antes de aguardar o lock do Store, e o listener de estado nem passa um identificador esperado para essa escrita.

Se o callback esperar o lock enquanto a execucao antiga termina e uma nova entrada substitui o Store, a confirmacao da execucao antiga pode marcar a nova como `actuated=True`. Depois de um crash/restart, isso permite contabilizar como rega real uma execucao nova que talvez nunca tenha aberto o alvo.

**Correcao recomendada:** capturar o `run_uid` no ponto em que a atuacao e observada e fazer o mutator retornar no-op quando `current["run_uid"]` for diferente. Aplicar o mesmo principio a toda escrita tardia do ciclo de vida.

### B1 — BAIXA — Contador visual nao reinicia quando o card e reconectado ao DOM

**Evidencias:** `frontend-src/src/card.ts:199-215`, `frontend-src/src/card.ts:1677-1683`.

`disconnectedCallback()` para o intervalo, mas nao existe `connectedCallback()` correspondente. O ticker so e criado em `updated()`. Se o mesmo elemento for removido e recolocado enquanto a entidade continua regando e nenhuma propriedade reativa mudar, o countdown/progresso pode permanecer congelado ate chegar uma nova atualizacao do Home Assistant.

**Correcao recomendada:** reiniciar o ticker em `connectedCallback()` quando `_isWatering()` for verdadeiro (ou solicitar uma atualizacao explicita) e testar detach/reattach do mesmo elemento.

## Risco arquitetural que exige decisao

### R1 — Shutdown do Home Assistant deixa o alvo ligado sem timer ate o proximo boot

**Evidencias:** `scheduler.py:624-643`; comportamento documentado no README como recuperacao de execucao ativa apos restart.

Quando `hass.state` e `CoreState.stopping`, o unload ja cancelou o timer de parada, o check de atuacao, o listener e o watchdog; em seguida retorna sem enviar `turn_off`. O Store permite retomar ou encerrar no proximo boot, mas nao limita fisicamente a duracao enquanto o Home Assistant estiver desligado. Se o boot demorar ou nao ocorrer, uma valvula sem timeout proprio pode permanecer aberta alem de `max_duration`.

Isso parece intencional para manter irrigacao continua durante um restart, portanto foi classificado como **risco de projeto**, nao como defeito oculto. Para uma integracao que controla agua, recomendo uma politica fail-close configuravel (preferencialmente padrao), ou exigir/documentar explicitamente um watchdog local no dispositivo.

## Verificacoes executadas

| Verificacao | Resultado |
|---|---|
| `ruff check custom_components tests` | passou |
| `compileall custom_components` | passou |
| Backend puro (`test_schedules`, `test_next_run`, `test_services_yaml`) | **36 passed, 1 skipped** |
| Backend completo em Docker (Python 3.13 + Home Assistant 2026.2.3 + PHCC) | **190 passed em 21,71 s** |
| Frontend Vitest | **176 passed** |
| TypeScript `tsc --noEmit` | passou |
| Build Rollup | passou; bundle sem diff |
| Smoke test do card | passou |
| `git diff --check` | passou |

### Ambiente Docker utilizado

A suite completa foi executada em um conteiner Linux descartavel baseado em `python:3.13-slim`, com o repositorio montado como somente leitura. O `pytest-homeassistant-custom-component` resolveu e instalou Home Assistant **2026.2.3**, exatamente a versao minima declarada em `manifest.json`. O conteiner foi removido automaticamente ao terminar.

A imagem operacional local `ghcr.io/home-assistant/home-assistant:stable` foi identificada como Home Assistant **2026.8.2** sobre Python **3.14.6**/musl. Ela nao foi usada para a suite porque a combinacao PHCC + dependencias de teste ainda nao oferece uma resolucao instalavel para esse ABI; isso e uma limitacao do ambiente de testes, nao do plugin.

Os 190 testes existentes passarem nao invalida A1/M1/M2: esses achados correspondem a intercalacoes assincronas sem caso de regressao na suite atual, conforme os cenarios listados na secao seguinte.

## Cobertura recomendada

1. Unload com desligamento nao confirmado seguido de reload e nova rega.
2. Novo `water_now` enquanto o `turn_off` anterior esta bloqueado dentro do servico.
3. Callback antigo de atuacao esperando o lock enquanto o Store recebe um `run_uid` novo.
4. Card removido e reinserido no DOM durante uma rega.
5. Teste/decisao explicita para a politica fisica durante shutdown prolongado.

## Prioridade sugerida

1. Corrigir A1 antes da proxima versao.
2. Fechar M1 e M2 com ownership por `run_uid` e serializacao do ciclo de vida.
3. Decidir/documentar R1.
4. Corrigir B1 e adicionar os quatro testes de regressao.

---

## Resposta e correcoes aplicadas (v0.12.1)

**Verificacao dos achados.** Os quatro achados de codigo foram confirmados por leitura do
codigo real, um a um, antes de qualquer alteracao. Nenhum foi aceito por confianca no
relatorio, e nenhum se revelou falso.

**A1 confirmado e corrigido.** A cadeia descrita e exata: `async_unload()` limpava o
watchdog ANTES de `_async_finish_run()`, e e esse mesmo `_async_finish_run()` que rearma um
watchdog no ramo de desligamento nao confirmado. Como `async_call_later` nao esta vinculado
ao config entry, o timer sobrevivia ao unload segurando referencia ao scheduler descartado.
Tres camadas de correcao, nao uma:

1. flag `_unloaded`, setada no inicio de `async_unload()`: um scheduler em teardown nao arma
   mais nenhum callback. Nada se perde, porque o registro sobrevive no Store e a instancia
   recarregada arma o proprio watchdog em `_async_recover_state()`;
2. `_async_clear_shutdown_watchdog()` tambem num `finally` depois do `await`, para que
   nenhum timer sobreviva ao metodo por caminho nenhum;
3. **ownership por `run_uid`**: cada watchdog guarda o `run_uid` para o qual foi armado e,
   antes de atuar no alvo OU de liquidar o Store, confirma que o registro atual ainda carrega
   esse mesmo uid (`_async_watchdog_owns_record`). Um registro que mudou de dono, ou que ja
   foi liquidado, faz o watchdog se desarmar sem tocar em nada.

As tres camadas nao sao redundantes, e um teste que falhou no CI deixou isso explicito. No
cenario mais comum do A1 -- unload com desligamento nao confirmado seguido de reload -- a
instancia nova **retoma a mesma rega** (o registro continua no Store com `finishes_at` no
futuro). Um watchdog orfao da instancia velha carregaria o MESMO `run_uid` do registro
retomado, entao a camada 3 sozinha o deixaria agir. Quem protege esse caso e a camada 1
(`_unloaded`) somada a 2 (`finally`). A camada 3 cobre o caso complementar: o registro trocar
de dono para uma rega diferente.

**M2 confirmado e corrigido.** `_async_store_mark_actuated()` agora recebe o `run_uid`
capturado no ponto em que a atuacao foi observada, e o mutator vira no-op quando o registro
atual carrega outro uid -- a mesma disciplina que `_async_store_mark_history_logged()` ja
seguia.

**B1 confirmado e corrigido.** `connectedCallback()` reinicia o ticker quando a zona esta
regando. Vale registrar o metodo: uma tentativa intermediaria de provar o teste desligando
so o `connectedCallback` deu falso-negativo e quase levou a conclusao errada de que B1 nao
existia. O que decidiu foi rodar o teste contra o codigo original em `git HEAD` e contra o
corrigido: **falha antes, passa depois**. O teste tem dentes e isso esta anotado nele.

**M1 aceito, nao corrigido nesta versao.** O achado procede. A ressalva e que
`_is_watering = False` antes do `await` e deliberado e documentado (impede que o eco do
proprio `turn_off` reentre em `_async_finish_run`), e que `_run_id` rejeita callbacks mas nao
cancela um comando ja despachado ao dispositivo. Serializar as transicoes fisicas com um lock
de ciclo de vida mexe na parte do scheduler com mais invariantes acopladas e exige bateria
propria de testes de corrida; foi adiado deliberadamente para nao atrasar a correcao do A1,
que ja estava em producao via HACS.

**R1 permanece decisao em aberto.** Nao ha alteracao de comportamento nesta versao.

### Testes de regressao adicionados

| Teste | Cobre |
|---|---|
| `test_unload_never_leaves_a_watchdog_behind` | A1: nenhum timer sobrevive ao unload com desligamento nao confirmado |
| `test_reload_leaves_no_orphan_able_to_touch_the_resumed_run` | A1 ponta a ponta: unload -> reload -> a instancia velha nao tem nada que possa disparar, e disparar a mao e inerte |
| `test_watchdog_stands_down_when_the_record_changed_hands` | A1: ownership por `run_uid` isolado |
| `test_mark_actuated_never_stamps_another_runs_record` | M2 |
| `restarts the countdown when the same element is reattached` | B1 |
| `does not start a ticker for a zone that is not watering` | B1 (contraprova) |

Cobre os itens 1, 3 e 4 da secao "Cobertura recomendada". O item 2 (novo `water_now`
enquanto o `turn_off` anterior esta bloqueado dentro do servico) acompanha o M1, adiado.
