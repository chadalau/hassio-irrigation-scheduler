# SOL — Relatório consolidado de auditoria

**Projeto:** WaterGaia / Irrigation Scheduler para Home Assistant  
**Data da consolidação:** 2026-08-13  
**Base analisada:** working tree atual, incluindo alterações não commitadas  
**Revisões confrontadas:** `REVIEW-luna.md`, `REVIEW-deepseek.md`, `REVIEW-qwen37.md` e `REVIEW-deepseek-pro.md`

## 1. Conclusão executiva

O projeto tem uma base boa, testes extensos e várias defesas importantes para falhas de atuação. Mesmo assim, **não deve ser considerado pronto para produção sem correções**, principalmente por controlar um dispositivo físico capaz de permanecer ligado.

Resultado consolidado:

- **2 achados de severidade alta**;
- **6 achados de severidade média**;
- **7 achados de severidade baixa ou informativa**;
- **nenhum segredo exposto e nenhuma vulnerabilidade em dependências de runtime**;
- backend, frontend, bundle e testes atuais passam, mas há cenários críticos ainda sem testes.

Os dois bloqueadores são:

1. uma ativação externa pode ficar sem rastreamento e sem timer de desligamento;
2. no retorno do horário de verão, o próximo disparo pode ser calculado no passado em UTC e ser executado imediatamente/reagendado repetidamente.

As quatro revisões anteriores acertaram vários pontos, mas três delas subestimaram os riscos relacionados à ativação externa, e nenhuma identificou a falha temporal após a primeira ocorrência de um horário ambíguo.

## 2. O que foi validado das quatro revisões

### 2.1 Consenso correto

- A correção do editor visual está válida: `frontend-src/src/editor.ts:71-85` lê `ev.detail.value`, mescla a configuração e emite `config-changed`.
- O teste de regressão correspondente existe e passa.
- O token de geração `_run_id`, a confirmação de atuação, os retries de `turn_off`, o gate de pH fail-safe, a recuperação de execução persistida e o lock compartilhado do Store são boas proteções.
- O bundle compilado corresponde ao fonte atual.
- As suítes existentes passam: **164 testes backend HA**, **35 testes backend puro** e **153 testes frontend**.

### 2.2 Divergências corrigidas nesta consolidação

- A ausência de varredura no boot foi classificada como baixa ou até como comportamento aceitável. Para um controlador físico que promete timer de segurança para ativação externa, ela é parte de um **problema de segurança operacional alto**.
- A política DST `fold=0` foi considerada correta porque há um teste antes da primeira ocorrência. Esse teste não cobre o instante entre a primeira e a segunda ocorrência. Nesse intervalo o código retorna um instante que já passou em UTC.
- A marcação `history_logged` foi considerada proteção suficiente contra duplicidade. Ela evita duplicação, mas atualmente pode provocar **perda definitiva do histórico** quando a gravação falha.
- A Luna identificou corretamente o crash do card com `started_at` inválido. O problema foi reproduzido e permanece no código atual.

## 3. Achados de severidade alta

### A1 — Ativação externa pode ficar ligada sem rastreamento nem watchdog

**Arquivos:**

- `custom_components/irrigation_scheduler/scheduler.py:577-588`
- `custom_components/irrigation_scheduler/scheduler.py:836-838`
- `custom_components/irrigation_scheduler/scheduler.py:1054-1055`
- `custom_components/irrigation_scheduler/scheduler.py:1645-1659`
- `custom_components/irrigation_scheduler/scheduler.py:1707-1755`

**Problema 1 — boot com alvo já ligado:** `async_setup()` recupera o Store e só depois registra o listener. Não consulta o estado atual do alvo. Se a válvula/bomba já estava ligada e não existe uma execução persistida, nenhum evento novo é obrigatório; a integração não cria uma execução externa e não arma o timer de desligamento.

**Problema 2 — falha ao persistir execução externa:** ao detectar a ativação, `_async_start_external_run()` cria o estado em memória, mas, se `async_save_entry()` falhar, desfaz todo o rastreamento e retorna antes de armar `_unsub_stop`. O alvo continua ligado sem watchdog em memória.

**Problema 3 — serviço `stop` não ajuda:** `async_stop()` delega para `_async_finish_run()`, que retorna imediatamente quando `_is_watering` é falso. Portanto, depois de uma falha de persistência ou de uma ativação perdida no boot, o próprio serviço da integração não desliga defensivamente o alvo.

**Impacto:** irrigação por tempo indefinido, alagamento, esvaziamento do reservatório ou dano à bomba. A justificativa de “não fomos nós que ligamos” é uma decisão de autoridade, mas conflita com a promessa explícita de timer de segurança para ativações externas.

**Correção recomendada:**

1. registrar o listener e reconciliar imediatamente o estado atual do alvo após a recuperação;
2. se o alvo já estiver atuado e não houver run recuperado, iniciar rastreamento externo;
3. armar um watchdog em memória mesmo quando o Store falhar, mantendo retry de persistência e um aviso visível;
4. fazer `stop` executar um `turn_off` defensivo quando o alvo está confirmadamente atuado, mesmo sem run em memória;
5. documentar explicitamente a política adotada para ativações externas.

**Testes obrigatórios:**

- setup com alvo já `on` e Store vazio;
- setup com válvula já `open` e Store vazio;
- falha de `async_save_entry()` mantendo watchdog ativo;
- `stop` com alvo atuado e `_is_watering == False`;
- reconciliação sem duplicar run já recuperado do Store.

### A2 — DST fall-back pode agendar um instante já passado e disparar imediatamente

**Arquivos:**

- `custom_components/irrigation_scheduler/next_run.py:118-142`
- `custom_components/irrigation_scheduler/scheduler.py:1773-1783`
- `tests/test_next_run.py:238-250`

**Causa:** os candidatos ambíguos são sempre construídos com `fold=0` e comparados com `candidate <= now` como datetimes locais com o mesmo `tzinfo`. Durante a segunda ocorrência da hora repetida, essa comparação por relógio de parede pode aceitar a primeira ocorrência, embora ela já tenha passado na linha do tempo UTC.

**Reprodução confirmada:**

```text
zona: America/New_York
agora: 2024-11-03 01:15 fold=1 = 06:15 UTC
candidato retornado: 2024-11-03 01:30 fold=0 = 05:30 UTC
future_utc: False
```

O scheduler passa esse instante para `async_track_point_in_time`. Um instante passado tende a ser disparado imediatamente; ao recalcular, o mesmo candidato pode voltar a ser escolhido, criando disparos imediatos sucessivos.

O teste existente apenas verifica `00:30 -> 01:30 fold=0`; ele não testa o período depois da primeira ocorrência e antes da segunda.

**Correção recomendada:**

1. comparar candidatos e `now` por timestamp/UTC, nunca apenas pela ordem local;
2. gerar e validar explicitamente os folds possíveis;
3. definir a política: executar somente no primeiro fold ou escolher o primeiro instante futuro entre os folds;
4. garantir por assertiva interna que todo resultado é estritamente futuro em UTC.

**Testes obrigatórios:**

- antes da primeira ocorrência;
- entre as duas ocorrências (`now fold=1`);
- depois da segunda ocorrência;
- callback seguido de `_reschedule_next()` sem loop imediato;
- zonas com e sem DST.

## 4. Achados de severidade média

### M1 — Agendamentos no mesmo dia e horário deixam itens inalcançáveis

**Arquivos:**

- `custom_components/irrigation_scheduler/__init__.py:80-95`
- `custom_components/irrigation_scheduler/__init__.py:381-412`
- `custom_components/irrigation_scheduler/next_run.py:118-142`

Os schemas rejeitam IDs duplicados no `set_schedules`, mas não conflitos de `(dia, horário)`. Com dois itens habilitados na quinta-feira às `06:00`, `find_next_run()` escolhe o primeiro. Depois do disparo, ambos passam a apontar para a semana seguinte e o primeiro volta a vencer. O segundo nunca executa.

**Reprodução confirmada:** `a` e `b` no mesmo slot resultaram em `a` antes do horário e novamente em `a` para a semana seguinte.

**Correção recomendada:** rejeitar sobreposição de dia/horário em `add_schedule`, `update_schedule` e `set_schedules`. Se a intenção for permitir, será necessário implementar fila/merge explícito; a rejeição é mais simples e previsível.

**Testes:** conflito exato; conflito parcial de dias; update que cria conflito; horários iguais em dias disjuntos; item desabilitado.

### M2 — Histórico com data inválida pode derrubar o card inteiro

**Arquivos:**

- `frontend-src/src/card.ts:1311-1317`
- `frontend-src/src/utils.ts:539-571`

`_isHistoryRun()` aceita qualquer string em `started_at`. Depois do horário de hoje, `scheduleStatusToday()` cria `new Date(entry.started_at)` e chama `dayKey()` sem validar a data. `Intl.DateTimeFormat.format(Invalid Date)` lança `RangeError: Invalid time value`. O `render()` captura a exceção, mas substitui o card pelo erro genérico.

Já existe defesa semelhante em `groupHistoryByDay`, mas ela não protege `scheduleStatusToday`.

**Correção recomendada:** validar `Date.parse(started_at)` no type guard e também tornar `scheduleStatusToday()` tolerante a entradas inválidas. Usar ambas as camadas evita regressões por chamadas diretas do utilitário.

**Testes:** utilitário e render completo com `started_at: "not-a-date"`, duração inválida, `NaN`, timezone configurado e horário do schedule já passado.

### M3 — Store JSON estruturalmente corrompido pode impedir todas as zonas de iniciar

**Arquivo:** `custom_components/irrigation_scheduler/store.py:176-183`

`_async_load_unlocked()` trata apenas `None`. Assume que o payload é um dicionário e que `entries`/`history` também são mapeamentos. Conteúdo JSON válido como `[]`, `{"entries": []}` ou `{"history": "x"}` causa exceções posteriores em `setdefault`, `.get()` ou indexação.

Como as zonas compartilham o mesmo arquivo de Store, uma corrupção estrutural pode afetar todas elas.

**Correção recomendada:** validar cada nível, preservar somente seções com tipos corretos e reinicializar/quarentenar o restante com log claro. Validar também que cada entrada de `history` é lista e cada run ativo é dicionário.

**Testes:** payload top-level lista/string; `entries` lista; `history` string; histórico de uma zona não-lista; uma zona corrompida sem bloquear as demais.

### M4 — Commit não transacional pode perder histórico e ainda deduzir o reservatório

**Arquivos:**

- `custom_components/irrigation_scheduler/scheduler.py:1172-1195`
- `custom_components/irrigation_scheduler/scheduler.py:1229-1249`
- `custom_components/irrigation_scheduler/scheduler.py:1251-1319`

Quando o registro de runtime precisa sobreviver porque o `turn_off` não foi confirmado, o código marca `history_logged=True` **antes** de tentar `async_append_history()`. Se o append falhar, `_async_log_history()` captura a exceção e continua deduzindo o volume. No restart, `history_logged=True` impede nova tentativa. Resultado: histórico definitivamente ausente, mas reservatório reduzido.

**Correção recomendada:** introduzir um identificador estável por run e uma operação atômica/idempotente no Store que acrescente o histórico e marque o runtime como registrado sob o mesmo lock. A dedução do reservatório deve acontecer somente após commit bem-sucedido ou também ser idempotente pelo mesmo run ID.

**Testes:** falha no append; falha ao marcar; restart após falha intermediária; retry sem histórico duplicado nem dupla dedução.

### M5 — Nova execução durante retry de desligamento descarta a contabilidade da anterior

**Arquivo:** `custom_components/irrigation_scheduler/scheduler.py:1102-1170`

Se uma nova execução externa começar durante o backoff de `turn_off`, `_run_id` muda e `_async_finish_run()` retorna antes de remover/preservar corretamente o registro anterior, gravar histórico e deduzir o reservatório. A proteção evita desligar a execução nova, mas mistura proteção de atuação com commit contábil.

**Impacto:** perda de histórico e volume em uma janela estreita, além da possibilidade de o Store da execução nova substituir o registro da anterior para o mesmo `entry_id`.

**Correção recomendada:** separar “não tocar no alvo da nova geração” de “finalizar contabilmente a geração antiga”. Capturar um snapshot imutável do run anterior e fazer o commit por `run_id`, sem retornar antes da etapa contábil.

**Testes:** iniciar run B durante o primeiro e segundo backoff do run A; confirmar que B não é desligado e A é contabilizado exatamente uma vez.

### M6 — Parada rápida de execução externa é ignorada e supercontabilizada

**Arquivo:** `custom_components/irrigation_scheduler/scheduler.py:1607-1643`

O grace period é necessário para comandos `turn_on` iniciados pela integração, pois um `off` pode ser eco atrasado. Para uma execução externa, porém, a atuação já foi confirmada antes do rastreamento. Se o ator desligar dentro dos primeiros 15 segundos, o evento é ignorado; a integração mantém o run até o tempo padrão e registra/deduz a duração completa.

**Correção recomendada:** aplicar o grace apenas às fontes `schedule`/`manual` ainda aguardando estabilização, ou criar regra própria para `SOURCE_EXTERNAL`. Execução externa confirmada deve encerrar ao primeiro estado comprovadamente off.

**Testes:** parada externa em 1 s, no limite do grace e após o grace; garantir duração real e dedução real.

## 5. Achados baixos e informativos

### B1 — Dependências de desenvolvimento vulneráveis

`npm audit` reportou **8 vulnerabilidades**: 4 moderadas, 2 altas e 2 críticas. As cadeias incluem `happy-dom`, `vitest`, `vite`, `esbuild` e `serialize-javascript`. `npm audit --omit=dev` reportou **0 vulnerabilidades**, portanto o bundle/runtime distribuído não está afetado diretamente, mas a máquina de desenvolvimento e o CI ficam expostos ao processar testes/conteúdo não confiável.

**Ação:** atualizar `happy-dom`, `vitest` e `@rollup/plugin-terser` em branch própria, pois as correções sugeridas envolvem versões major; depois executar typecheck, 153 testes, build, smoke e comparar o bundle.

### B2 — Options flow pode quebrar ao abrir opções previamente corrompidas

`custom_components/irrigation_scheduler/config_flow.py:245-291` converte diretamente opções persistidas com `int()`/`float()`. O scheduler possui fallback para opções ruins, mas abrir o fluxo pode lançar `ValueError`/`TypeError` caso uma config entry tenha sido editada ou migrada com valores inválidos.

**Ação:** helpers seguros de coerção com limites e defaults, acompanhados de log e testes para strings, `None`, booleanos e números não finitos.

### B3 — Validação cruzada de pH no frontend é incompleta

Conforme DeepSeek, `frontend-src/src/card.ts:966-979` só compara mínimo e máximo quando ambos foram parseados do formulário. Alterar apenas um campo pode deixar o backend rejeitar a operação. Não há corrupção, mas a experiência é inconsistente.

**Ação:** comparar o valor editado com fallback para o valor atual exibido.

### B4 — Diálogos não implementam o padrão mínimo de acessibilidade

`frontend-src/src/card.ts:1066-1096` e `1158-1258` têm `role="dialog"` e `aria-modal="true"`, mas não têm `aria-labelledby`, foco inicial, restauração de foco, trap de foco nem fechamento por `Escape`.

**Ação:** nome acessível, gerenciamento de foco e testes de teclado.

### B5 — Dispatch/reschedule duplicado após dedução do reservatório

O listener de atualização de options acionado por `_deduct_reservoir_volume()` já reagenda e despacha; `_async_finish_run()` repete as operações. É idempotente, mas produz trabalho e eventos redundantes.

**Ação:** centralizar o dispatch ou suprimir o listener durante a atualização interna.

### B6 — Documentação e smoke test estão desatualizados

- `README.md:10` diz “six services”, mas a tabela contém **8 serviços**.
- `frontend-src/smoke.mjs:62` procura “Seg” e “Qua”, enquanto o card usa iniciais de um caractere; a condição imprime `false` e não falha o smoke.
- Comentários sobre R2 e algumas docstrings de fontes de execução não refletem o comportamento atual.

**Ação:** corrigir textos e transformar as verificações relevantes do smoke em assertivas reais.

### B7 — Ausência de automação de qualidade no repositório

Não há pipeline CI nem configuração de lint/type checking Python (`pyproject.toml`, Ruff ou mypy). Os testes locais são bons, mas regressões dependem de execução manual.

**Ação:** CI com pytest HA/puro, TypeScript typecheck, Vitest, build, smoke, `npm audit --omit=dev`, `compileall` e `git diff --check`. Avaliar Ruff em etapa inicial não bloqueante.

## 6. Falsos positivos e itens já resolvidos

- **Editor visual `detail.name`: resolvido.** O código atual usa `detail.value` e há teste.
- **`float(None)` no envio normal do config flow:** o schema do Home Assistant rejeita o valor antes do handler; não é o mesmo que a fragilidade de opções já persistidas descrita em B2.
- **Registro duplicado de serviços:** protegido por `has_service`; idempotente.
- **`setdefault` do RuntimeStore compartilhado:** não foi confirmado como race funcional no modelo assíncrono atual.
- **`turn_off=False` ao receber estado off confirmado:** correto; o dispositivo já está desligado.
- **Meia-noite como valor inicial do formulário:** horário válido.
- **Serviço chamado usando a entidade sensor da zona:** o backend resolve corretamente a config entry.
- **Bundle alterado pelo build:** artefato esperado e consistente com o fonte.

## 7. Plano recomendado de correção

### Fase 1 — bloquear riscos físicos

1. corrigir reconciliação/segurança de ativação externa (A1);
2. corrigir comparação temporal/DST (A2);
3. adicionar todos os testes adversariais desses dois itens;
4. executar suíte completa antes de avançar.

### Fase 2 — integridade de dados e agendamento

1. rejeitar conflitos de slots (M1);
2. robustecer estrutura do Store (M3);
3. tornar commit de histórico/dedução idempotente e transacional (M4);
4. separar finalização física da contábil na troca de geração (M5);
5. corrigir grace de execução externa (M6).

### Fase 3 — frontend e cadeia de desenvolvimento

1. filtrar histórico inválido (M2);
2. atualizar dependências de desenvolvimento (B1);
3. corrigir validação de pH e acessibilidade;
4. atualizar README, comentários e smoke;
5. adicionar CI.

## 8. Critérios de aceite antes de publicar

- Todo `next_run` retornado deve ser estritamente futuro quando comparado em UTC.
- Toda atuação confirmada deve possuir watchdog, mesmo que a persistência falhe.
- `stop` deve conseguir desligar um alvo confirmado como atuado mesmo sem run rastreado.
- Nenhum slot de agenda habilitado pode ficar silenciosamente inalcançável.
- Corrupção parcial do Store não pode impedir as demais zonas de carregar.
- Histórico e dedução devem ser exatamente uma vez por run, inclusive após falhas e restart.
- Uma entrada de estado malformada nunca deve derrubar o card inteiro.
- Suítes backend/frontend, typecheck, build e smoke devem passar.
- `npm audit --omit=dev` deve continuar em zero; vulnerabilidades do toolchain devem ser removidas ou formalmente justificadas.

## 9. Verificações executadas nesta consolidação

- leitura integral das quatro revisões solicitadas;
- confronto dos achados com backend, frontend e testes atuais;
- reprodução do bug DST com `fold=1` e comparação UTC;
- reprodução do starvation de dois schedules no mesmo slot;
- inspeção das coberturas existentes para DST, Store, histórico e ativação externa;
- `npm audit`: 8 vulnerabilidades somente no ambiente de desenvolvimento;
- `npm audit --omit=dev`: 0 vulnerabilidades;
- resultados já confirmados no mesmo working tree: 164 testes backend HA, 35 testes puros, 153 testes frontend, typecheck/build/compileall aprovados e bundle consistente.

## 10. Status final

**PRECISA DE ALTERAÇÃO — NÃO APROVADO PARA PRODUÇÃO NESTE ESTADO.**

As correções A1 e A2 são bloqueadoras. Depois delas, M3–M6 devem ser tratadas antes de confiar no histórico, na dedução do reservatório e no comportamento sob falhas/races. Os demais itens podem ser concluídos na sequência, sem misturá-los à correção de segurança física.

## 11. Remediação aplicada em 2026-08-13

Todos os itens deste relatório foram tratados no working tree atual:

- **A1:** reconciliação do alvo no setup, watchdog anterior à persistência e `stop` defensivo;
- **A2:** seleção do próximo disparo pela linha do tempo UTC, com regressão para `fold=1`;
- **M1:** rejeição de schedules habilitados que compartilham dia e horário;
- **M2:** validação de datas/durações do histórico no card e guarda no utilitário;
- **M3:** reparo tolerante de payload e seções estruturalmente inválidas do Store;
- **M4/M5:** `run_uid` persistente, append idempotente, remoção condicional e ledger de dedução exatamente-uma-vez;
- **M6:** parada de fonte externa não usa o grace destinado ao eco de comandos internos;
- **B1:** toolchain atualizado; `npm audit` e `npm audit --omit=dev` em zero;
- **B2/B3:** coerção segura do options flow e validação de pH contra valores efetivos;
- **B4:** nomes acessíveis, foco, restauração, trap de Tab, Escape e `aria-label` em controles por ícone;
- **B5/B6/B7:** dispatch interno controlado, documentação/smoke corrigidos e CI com pytest, Ruff, typecheck, Vitest, build, smoke, audit e verificação do bundle.

Verificação pós-correção:

- **176 testes backend HA passaram**;
- **33 testes backend puro passaram e 3 dependentes de tzdata foram pulados no Python local**; a suíte HA executou os cenários DST;
- **154 testes frontend passaram**;
- TypeScript, build Rollup, smoke do bundle, `compileall`, Ruff e `git diff --check` passaram;
- auditoria npm completa: **0 vulnerabilidades**.

**STATUS PÓS-REMEDIAÇÃO: APROVADO PELAS SUÍTES AUTOMATIZADAS.** A validação final em uma instalação Home Assistant com o dispositivo físico real continua recomendada antes da publicação.

### Complemento após a revisão Sonnet

O achado adicional sobre a colisão entre recuperação de downtime e reconciliação de ativação externa também foi corrigido. `_async_recover_state()` sinaliza quando o registro original precisa continuar pendente, e `RuntimeStore.async_create_entry()` impede atomicamente que um evento externo concorrente sobrescreva `run_uid`, origem, timestamps ou o diário de contabilidade existente. Foram acrescentados testes de regressão para preservação e criação condicional do registro.

Após esse complemento, a suíte completa passou com **176 testes backend HA**, mantendo os **154 testes frontend**, typecheck, build, smoke, Ruff, `compileall`, `git diff --check` e auditoria npm em zero vulnerabilidades.
