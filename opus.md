# opus.md — Revisão completa de código

**Revisor:** Claude Opus 5
**Data:** 2026-08-21
**Base analisada:** `main` @ `702e8cc`, working tree limpo, `v0.11.2`
**Método:** leitura integral do backend (`custom_components/irrigation_scheduler/`, 8 arquivos, ~3.900 linhas)
e do frontend (`frontend-src/src/`, 5 arquivos, ~3.900 linhas), mais `services.yaml`, `strings.json`,
traduções, CI e configuração. Cada achado foi confrontado com o código-fonte real do
Home Assistant **2026.2.3** (instalado num venv temporário só pra isso) ou reproduzido
com um script isolado — não é revisão só por leitura.

---

## 1. Conclusão executiva

A base continua sólida: as correções do `SOL.MD`/`sonnet.md` estão todas no lugar e a disciplina de
"nunca deixe a válvula aberta sem vigia" aparece consistentemente no código. Mesmo assim encontrei
**3 achados de severidade alta**, **3 de severidade média** e **10 itens de código morto/limpeza** —
nenhum deles coberto pelas suítes atuais. Dois desses achados não sobreviveram à verificação:
M2 (retratado, ver §3) e B9 (incorreto, ver §4).

Os três achados altos são:

1. **`services.yaml` é inválido pro schema do próprio HA** — as 8 descrições de serviço são
   silenciosamente descartadas em runtime (duas linhas `mode: box` indentadas no seletor errado).
2. **A URL do card nunca volta a ser registrada** depois que a última zona é descarregada — um
   simples "Recarregar" na única zona quebra o card até reiniciar o HA.
3. **Um desligamento defensivo que falha no boot não é reexecutado durante a sessão** — o alvo pode
   ficar ligado sem nenhum timer vigiando, e o registro de recuperação preservado ainda pode ser
   sobrescrito por uma rega agendada posterior.

### Estado das suítes

| Suíte | Comando | Resultado |
|---|---|---|
| Frontend (vitest) | `npm test` | **173 passed** |
| TypeScript | `npm run typecheck` | OK |
| Build + drift do bundle | `npm run build` + `git status` | OK, **sem drift** |
| Smoke | `node smoke.mjs` | SMOKE OK |
| Backend puro | `pytest tests/test_next_run.py tests/test_schedules.py` | **33 passed, 3 skipped** |
| Backend HA | `pytest tests` | **NÃO EXECUTÁVEL neste Windows** (ver §5) |
| Ruff (regras do CI) | `ruff check custom_components tests` | All checks passed |

---

## 2. Achados de severidade ALTA

### A1 — `services.yaml` inválido: TODAS as descrições de serviço são descartadas

**Arquivos:** `custom_components/irrigation_scheduler/services.yaml:230-235` e `:258-263`

Duas linhas `mode: box` que pertencem ao seletor `number` dos campos `ph_max`/`ph_max_2` acabaram
indentadas dentro do seletor `text:` dos campos seguintes (`ec_entity_id` e `ec_entity_id_2`):

```yaml
    ph_max:
      selector:
        number:
          min: 0
          max: 14
          step: 0.1          # <-- o "mode: box" deveria estar AQUI
    ec_entity_id:
      selector:
        text:
          mode: box          # <-- e foi parar AQUI (TextSelector não aceita "mode")
```

`TextSelector` não aceita a chave `mode`. Confirmado empiricamente contra o HA 2026.2.3:

```
>>> selector.selector({'text': {'mode': 'box'}})
vol.Invalid: extra keys not allowed @ data['mode']

>>> _SERVICES_SCHEMA(yaml.safe_load(open('services.yaml')))
vol.Invalid: extra keys not allowed @ data['set_zone_options']['fields']['ec_entity_id']['selector']['mode']
```

**Impacto.** `homeassistant/helpers/service.py::_load_services_file` captura `vol.Invalid` e
**retorna `{}`** — não só o campo defeituoso, o **arquivo inteiro**:

```python
    except (HomeAssistantError, vol.Invalid) as ex:
        _LOGGER.warning("Unable to parse services.yaml for the %s integration: %s", ...)
        return {}
```

Ou seja, em Ferramentas do desenvolvedor → Ações, os oito serviços do `irrigation_scheduler`
aparecem sem nome, sem descrição, sem seletor de alvo e sem nenhum campo. Os serviços continuam
**funcionando** quando chamados (o card chama direto, e o registro usa `schema=None`), então a falha
é invisível a não ser que alguém leia o `WARNING` no log ou tente montar uma automação pela UI.

**Correção.** Mover as duas linhas `mode: box` pro seletor `number` a que pertencem (ou apagá-las —
`box` já é o default pra `number` com `step`). Depois disso `_SERVICES_SCHEMA` valida limpo, verificado.

**Teste sugerido.** Um teste que carrega `services.yaml` e o passa por
`homeassistant.helpers.service._SERVICES_SCHEMA`, além de conferir que todo campo aceito por
`SET_ZONE_OPTIONS_SCHEMA` está documentado no YAML. Isso teria pego o erro no commit em que ele entrou.

---

### A2 — A URL do card não é reregistrada: recarregar a única zona quebra o card

**Arquivos:** `custom_components/irrigation_scheduler/__init__.py:218-219`, `:225`, `:255-260`

`async_setup()` (uma vez por processo) registra o caminho estático **e** a URL de módulo extra.
`async_unload_entry()` remove a URL quando a **última** entrada descarrega:

```python
    if unload_ok and not hass.config_entries.async_loaded_entries(DOMAIN):
        _async_unregister_services(hass)
        _async_unregister_frontend(hass)      # remove_extra_js_url
```

`async_setup_entry()` já compensa isso pros **serviços** (`await _async_register_services(hass)` na
linha 225), mas **não** pro frontend. E `async_setup()` não roda de novo: quando o componente já está
configurado, adicionar uma entrada chama só `async_setup_entry`.

Verificado no código do HA 2026.2.3: `ConfigEntry.async_unload` marca o estado como
`UNLOAD_IN_PROGRESS` **antes** de chamar o handler, e `async_loaded_entries` só conta `LOADED` — logo,
descarregando a última (ou única) zona a condição é verdadeira e a URL some.

**Impacto.** Depois de qualquer um destes, com **uma única zona** configurada:

- botão "Recarregar" da integração;
- atualização via HACS (que recarrega a entrada);
- remover a zona e adicionar de novo.

…a URL `/irrigation_scheduler/card.js` deixa de ser servida como módulo extra. O card já carregado
no navegador continua funcionando, mas qualquer aba nova mostra
*"Custom element doesn't exist: irrigation-schedule-card"* até reiniciar o HA. Isso quebra a promessa
explícita do README ("The integration registers it automatically — **no manual Resources entry**").

**Atenção na correção:** chamar `_async_register_frontend()` de novo **não** funciona como está.
`hass.http.async_register_static_paths` faz `app.router.add_route("GET", url_path, ...)`, e o aiohttp
3.13.3 levanta na segunda vez (reproduzido):

```
RuntimeError: Added route will never be executed, method GET is already registered
```

A correção precisa separar as duas metades: o caminho estático registrado **uma vez por processo**
(flag em `hass.data[DOMAIN]`) e `add_extra_js_url` chamado a cada `async_setup_entry` — este é
idempotente, o `UrlManager` guarda as URLs num `frozenset`.

**Teste sugerido.** Configurar uma zona, descarregá-la, configurar outra e afirmar que
`CARD_JS_URL in hass.data[DATA_EXTRA_MODULE_URL].urls`. O `test_frontend.py` atual cobre
registro e remoção, mas nunca o ciclo remove→registra.

---

### A3 — Desligamento defensivo que falha no boot fica sem nova tentativa na sessão inteira

**Arquivos:** `custom_components/irrigation_scheduler/scheduler.py:1981-1987`, `:591-598`, `:1815-1845`

No caminho "a rega terminou durante o downtime", se o `turn_off` defensivo falha (o caso comum: o
dispositivo ainda está `unavailable` logo após o boot), o registro é preservado de propósito e a
função retorna `True`:

```python
            else:
                _LOGGER.error(
                    "Defensive turn_off of %s failed; keeping runtime state "
                    "so the next boot retries for %s", ...)
                return True
```

Nesse ponto: `_is_watering` continua `False`, **nenhum timer de parada foi armado**, e
`async_setup()` pula a reconciliação externa justamente porque `recovery_pending` é `True`
(a correção do achado do `sonnet.md`, que está correta).

O problema é o que acontece **depois**, ainda na mesma sessão. Quando o dispositivo volta e reporta
`on`, o listener dispara → `_is_watering` é `False` → `_async_maybe_start_external_run()` →
alvo ligado → `_async_start_external_run()` arma o `_unsub_stop`… e aí
`store.async_create_entry()` retorna `False` (o registro pendente ocupa o `entry_id`), então o
caminho de reversão **cancela o próprio timer que acabou de armar** (`self._cancel_stop()`) e volta.

**Resultado: o alvo fica confirmadamente ligado, sem timer, sem watchdog e sem nenhuma nova
tentativa de desligamento até o próximo reinício do Home Assistant.** Para uma integração que
controla água, essa é exatamente a categoria de risco que o A1 do `SOL.MD` tentou fechar — só que
agora numa janela diferente. Cada mudança de estado subsequente do alvo reentra no mesmo caminho e
desiste de novo.

**Agravante (mesmo achado).** `_async_start_run()` persiste com `async_save_entry()`
(scheduler.py:971), que **sobrescreve incondicionalmente**. Se um horário agendado disparar mais
tarde na mesma sessão, ele apaga o registro de recuperação preservado — o `run_uid` original, o
histórico e a dedução daquela rega interrompida somem, e o "próximo boot vai tentar de novo" nunca
acontece. A proteção do `async_create_entry()` foi aplicada só ao caminho externo.

Há um mitigante parcial: se um horário agendado disparar, a rega nova acaba fechando a válvula no
seu próprio `finishes_at`. Mas numa zona com o interruptor mestre desligado, ou sem horários
habilitados, não há nada.

**Correção sugerida.** Armar uma retentativa limitada dentro da própria sessão em vez de esperar o
próximo boot — por exemplo um `async_call_later` com backoff (ou reagir ao alvo voltar de
`unavailable`) que refaz o `turn_off` defensivo enquanto o registro pendente existir, encerrando
quando o alvo for confirmado desligado (aí sim removendo o registro e, se `actuated`, logando o
histórico). Complementarmente, fazer o caminho normal de `_async_start_run` respeitar um registro
pendente em vez de sobrescrevê-lo cegamente.

**Teste sugerido.** Registro no Store com `finishes_at` no passado + `turn_off` que falha no boot;
depois do setup, tornar o alvo disponível/ligado e avançar o relógio — o alvo deve acabar
desligado e o registro removido, sem depender de reinício.

---

## 3. Achados de severidade MÉDIA

### M1 — O histórico nos atributos estoura o limite de 16 KB do recorder

**Arquivo:** `custom_components/irrigation_scheduler/binary_sensor.py:64-65`

`binary_sensor.<zona>_watering` expõe a lista inteira de histórico (até
`HISTORY_MAX_ENTRIES = 200` registros de ~14 campos) como atributo de estado. O recorder do HA tem
um teto rígido (`db_schema.py:94`, `MAX_STATE_ATTRS_BYTES = 16384`) e, ao ultrapassá-lo, **descarta
todos os atributos** da entidade e loga um aviso:

```
"State attributes for %s exceed maximum size of %s bytes.
 This can cause database performance issues; Attributes will not be stored"
```

Medido com um registro realista (377 bytes cada):

| regas em 30 dias | payload dos atributos | |
|---|---|---|
| 30 | 11,9 KB | ok |
| 60 | 23,2 KB | **acima do limite** |
| 90 | 34,6 KB | **acima do limite** |
| 200 (teto) | 76,3 KB | **acima do limite** |

Ou seja, **a partir de ~44 regas no período** (menos de 1,5 rega/dia — dois horários diários já
passam disso) o recorder para de gravar os atributos dessa entidade. Além do banco, esse payload é
reserializado e enviado por websocket pra cada dashboard conectado a **cada** escrita de estado
(início/fim de rega, mudança de opções).

**Correção sugerida.** Declarar `_unrecorded_attributes = frozenset({"history", "last_run"})` na
entidade (o HA suporta isso justamente pra este caso) e/ou reduzir o que vai pro atributo — por
exemplo expor só os N últimos e servir o histórico completo por um comando websocket/serviço com
resposta. A primeira opção é uma linha e resolve o lado do banco.

---

### M2 — ~~O options flow não consegue APAGAR um sensor de pH/EC~~ (RETRATADO)

**Arquivo:** `custom_components/irrigation_scheduler/config_flow.py`

**Este achado estava errado, e a correção que escrevi para ele foi revertida.**

O relato original: `user_input.get(CONF_PH_ENTITY_ID, current_ph_entity)` torna
"campo limpo" indistinguível de "campo intocado", então a UI de opções nunca consegue
remover um sensor. A parte factual continua verdadeira. O que estava errado foi a conclusão
de que isso é um defeito a corrigir invertendo o default.

O que eu não vi ao escrever a §3: existe um teste de regressão explícito,
`test_options_flow_preserves_ph_ec_when_keys_omitted`, vindo do achado A1 da rodada de
revisão de 2026-08-12, que fixa exatamente o comportamento atual. Ele reprovou no CI e
mostrou que o comportamento é uma decisão deliberada, já auditada — não um descuido.

E a decisão está certa, pela assimetria das consequências:

- tratar chave ausente como "limpar" dá o poder de remover o sensor pela UI, mas
  qualquer save em que o campo não volte no payload **desativa silenciosamente o portão
  de pH** — a zona passa a regar sem nunca checar o pH, e ninguém percebe até o badge de
  aviso parar de aparecer. É regressão de segurança;
- tratar chave ausente como "não mexer" custa apenas a capacidade de limpar o sensor
  **naquele formulário**. O diálogo de configurações do próprio card já limpa, mandando
  `ph_entity_id=""` explicitamente via `set_zone_options`.

Ou seja: a capacidade não se perde, só não está naquela UI — e o modo de falha do outro
caminho é muito pior. Nenhum dos dois testes (o antigo ou o meu) prova o que o frontend
realmente envia; ambos montam `user_input` na mão. Sem essa evidência, a opção conservadora
é a correta.

**A limitação real que o M2 descrevia — a UI de opções não conseguir remover um sensor —
foi resolvida depois, do jeito seguro:** um checkbox explícito "remover sensor" ao lado de
cada sensor configurado (`clear_ph_entity_id` e companheiros), de modo que a limpeza é
**declarada** em vez de inferida da ausência da chave. A leitura conservadora da chave
ausente continua intacta, então o modo de falha perigoso nunca existe. Marcar "remover" e
escolher uma entidade diferente no mesmo save volta como erro em vez de honrar um dos dois
silenciosamente, e o checkbox só aparece quando há o que remover.
`vol.Optional(chave, default="")` continua não servindo: o `EntitySelector` rejeita `""`.

### M3 — `_suppress_options_dispatch_once` pode ficar preso e engolir a PRÓXIMA atualização

**Arquivo:** `custom_components/irrigation_scheduler/scheduler.py:820`, `:905-907`

```python
        self._suppress_options_dispatch_once = True
        self.hass.config_entries.async_update_entry(self.entry, options=options)
```

A flag assume que exatamente um disparo do update listener virá em seguida. Mas o HA 2026.2.3
(`config_entries.py:2478`) faz:

```python
        if not changed:
            return False        # os update_listeners NÃO são chamados
```

Se as opções resultarem idênticas às atuais, nenhum listener roda e a flag fica `True`
indefinidamente — a **próxima** alteração legítima de opções (o usuário desligar o interruptor
mestre, editar um horário, salvar as configurações) é então silenciosamente suprimida: sem
`_reschedule_next()` e sem `_async_dispatch_update()`, o card não atualiza e o próximo horário não é
recalculado até algo mais disparar um dispatch.

A janela é estreita (exige `run_uid is None` — registro legado — com o reservatório já em 0), mas o
padrão é frágil por construção.

**Correção sugerida.** `async_update_entry` retorna `bool`; usar o retorno pra só manter a supressão
quando a atualização realmente aconteceu:

```python
        self._suppress_options_dispatch_once = True
        if not self.hass.config_entries.async_update_entry(self.entry, options=options):
            self._suppress_options_dispatch_once = False
```

---

## 4. Código morto e limpeza (severidade BAIXA)

| # | Arquivo | Item |
|---|---|---|
| B1 | `scheduler.py:1370` | `self._history, inserted = await ...async_append_history(...)` — **`inserted` nunca é usado** (RUF059). O `async_append_history` foi feito idempotente por `run_uid` e devolve esse sinal justamente pro chamador decidir se contabiliza; quem protege a dedução hoje é só o journal `reservoir_accounted_runs`. Hoje é inofensivo, mas é uma intenção documentada que o chamador não honra. |
| B2 | `scheduler.py:55`, `:101` | Imports mortos: `callback` (de `homeassistant.core`) e `DOMAIN` (de `.const`). |
| B3 | `scheduler.py:114` | O reexport de `compute_next_run` "for backwards compatibility" **não tem nenhum consumidor**: os testes importam de `next_run` direto. |
| B4 | `frontend-src/src/utils.ts:58,73` | `allDaysLabel()` e `isAllDays()` só são usados pelos próprios testes (`tests/utils.test.ts:732-741`). O card passou a usar a faixa fixa de 7 iniciais e nunca mais os chamou. Ficam fora do bundle (tree-shaking), mas são peso morto no fonte + testes. |
| B5 | `frontend-src/src/card.ts:1568-1576` | JSDoc órfão: o bloco que documenta `_sensorBadgeText` ("Formats a header badge…") ficou acima de `_phStatusClass`, que tem o seu próprio logo abaixo. |
| B6 | `frontend-src/src/card.ts:1322` vs `:1328` | R1 testa `entry.ph_value !== null`, R2 testa `typeof entry.ph_value_2 === "number"`. Um registro de histórico antigo (anterior ao campo) tem `undefined`, que passa no primeiro teste e renderiza `· ? PH`. Padronizar no `typeof`. |
| B7 | `frontend-src/src/card.ts:1717,1740,1745,1750,1755,1764` | `_callService` faz `console.error` e **relança**; esses seis chamadores não tratam a rejeição → *unhandled promise rejection* no console, e o usuário não vê nenhum feedback quando o backend recusa (ex.: `remove_schedule` com id inexistente levanta `ServiceValidationError`). Os dois diálogos já tratam corretamente — só as ações diretas não. |
| B8 | `frontend-src/src/card.ts:157,166` | Defaults mortos: `_formTime = "06:00"` e `_formDurationMin = 15` nunca são vistos — `_openAdd()` sobrescreve com `"00:00"`/`0` e `_openEdit()` com os valores do horário. |
| B9 | ~~`frontend-src/src/utils.ts:39`~~ | **ACHADO INCORRETO, retirado.** A hora sem zero a esquerda para entrada de 1 digito e comportamento DELIBERADO, travado por teste (`tests/utils.test.ts`: "formats 1-digit components without padding the hour"). Nao alterado. |
| B10 | `scheduler.py:653` | `_validate_schedule_slots` monta `slot = (day, schedule_time)`; um `day` não-hasheável (lista, vindo de options editadas à mão) levanta `TypeError` em vez de degradar como o resto do módulo faz. |

Extras menores: `strings.json` define o erro `default_duration_too_high` também na seção `config`,
mas o passo `user` nunca o emite; `store.py` e `__init__.py` põem `_LOGGER = ...` no meio dos imports
(E402, não habilitado); os testes têm 4 imports mortos (`test_external_activation.py:13`,
`test_init.py:10`, `test_ph_gate.py:13`, `test_target_failure_warnings.py:14`).

---

## 5. Observações sobre o processo

**A suíte de integração não roda neste Windows.** `pytest-homeassistant-custom-component` instala
normalmente no Python 3.13, mas o HA 2026.2.3 importa `fcntl` (POSIX) em
`homeassistant/runner.py`, então a coleta morre antes do primeiro teste:

```
ModuleNotFoundError: No module named 'fcntl'
```

Os 176 testes citados no `sonnet.md` devem ter sido executados em Linux/WSL ou CI. O WSL desta
máquina tem só Python 3.14 sem `ensurepip`, então rodá-los localmente exigiria
`apt install python3.13 python3.13-venv` — não fiz essa alteração de sistema. **Nenhum dos achados
acima depende dessa suíte**: A1 e M3 foram verificados executando o código do próprio HA, A2 e A3
por rastreamento do caminho de código contra o fonte do HA 2026.2.3, M1 por medição do payload, e
o restante por leitura + ferramentas estáticas.

**O ruleset do Ruff no CI é estreito.** `pyproject.toml` seleciona apenas `E9, F63, F7, F82` — não
pega imports mortos (`F401`), variáveis não usadas (`F841`/`RUF059`) nem `B`/`SIM`. Metade dos itens
da §4 sairia de graça com `select = ["E", "F", "B", "SIM", "RUF"]` (+ `I` pra ordenação de imports,
que também está inconsistente em `scheduler.py`/`__init__.py`).

**Nada valida `services.yaml`.** O A1 é a prova de que um erro de indentação de uma linha derruba
oito descrições de serviço sem quebrar nenhum teste. É o teste de maior custo-benefício da lista.

---

## 6. Ordem de correção sugerida

1. **A1** — duas linhas de YAML, impacto imediato na UI, risco zero.
2. **M1** — uma linha (`_unrecorded_attributes`), evita degradação do banco.
3. **A2** — separar registro estático (uma vez) de `add_extra_js_url` (por entrada).
4. **A3** — o mais delicado: mexe no núcleo de recuperação, precisa de teste dedicado antes.
5. **M3**, **M2**, depois a limpeza da §4 num commit próprio, junto com o alargamento do Ruff.

---

## 7. Correções aplicadas (2026-08-21)

Todos os achados foram corrigidos, na ordem sugerida acima. Resumo do que mudou:

| # | Correção | Arquivos |
|---|---|---|
| A1 | As duas linhas `mode: box` voltaram pro seletor `number` de `ph_max`/`ph_max_2`. `_SERVICES_SCHEMA` valida limpo. | `services.yaml` |
| M1 | `_unrecorded_attributes = frozenset({"history", "last_run"})` — o recorder para de receber o payload grande; o card continua recebendo tudo pela máquina de estados. | `binary_sensor.py` |
| A2 | `_async_register_frontend` passou a ser chamado também em `async_setup_entry`. As duas metades foram separadas: caminho estático **uma vez por processo** (flag `DATA_CARD_PATH_REGISTERED`, porque o aiohttp rejeita rota duplicada) e `add_extra_js_url` **por entrada** (idempotente via `frozenset`). | `__init__.py` |
| A3 | **Watchdog de desligamento**: todo caminho que preserva o registro por não conseguir confirmar o alvo desligado (recuperação no boot, laço de retry do `_async_finish_run`, `_async_abort_run`) agora arma um retry na sessão atual, com backoff `(5, 15, 30, 60, 120, 300, 600)` s. O listener liquida o registro assim que o alvo reporta desligado. Esgotado o backoff, loga erro e mantém o registro pro próximo boot (contrato antigo preservado). Além disso, `_async_start_run` liquida a contabilidade do registro pendente **antes** do `async_save_entry` que o sobrescreveria. | `scheduler.py` |
| M3 | O flag `_suppress_options_dispatch_once` só permanece setado quando `async_update_entry` retorna `True` (ou seja, quando um listener realmente vai rodar). | `scheduler.py` |
| M2 | **REVERTIDO** — o achado foi retratado (ver §3). O comportamento original (chave ausente = não mexer) foi restaurado, agora com o raciocínio das consequências documentado no código. | `config_flow.py` |
| §4 | B1 (documentado por que o flag de idempotência não é consultado), B2/B3 (imports e reexport mortos), B4 (`allDaysLabel`/`isAllDays` removidos), B5 (JSDoc órfão realocado), B6 (`typeof === "number"` nos dois reservatórios), B7 (`_callServiceNotifying` → toast `hass-notification` em vez de rejeição não tratada), B8 (inicializadores mortos), B10 (dia não-hasheável ignorado). **B9 era achado incorreto** — ver a tabela da §4. | vários |
| Extra | E402 (`_LOGGER` entre imports) corrigido; imports ordenados; ruleset do Ruff ampliado para `E,F,B,SIM,RUF,I,BLE` (ignorando só `E501`); probe morto do `smoke.mjs` (`"Próximo"` → `"Próxima"`) corrigido. | `pyproject.toml`, `store.py`, `__init__.py`, `smoke.mjs` |

### Testes de regressão adicionados

| Arquivo | Cobre |
|---|---|
| `tests/test_services_yaml.py` (novo, 3 testes) | A1: valida o YAML contra o schema do HA, confere que todo serviço registrado está descrito e que `set_zone_options` documenta exatamente os campos que aceita. Fora de `tests/integration` de propósito: não precisa da fixture `hass`. |
| `tests/integration/test_frontend.py` (+2) | A2: registrar → descarregar a última → registrar de novo; e o caminho real do usuário (`async_reload` da única zona). |
| `tests/integration/test_shutdown_watchdog.py` (novo, 4 testes) | A3: retry fecha o alvo na mesma sessão; o listener liquida o registro quando o alvo reporta desligado; o watchdog desiste após o último passo mantendo o registro; uma rega nova liquida a contabilidade pendente em vez de sobrescrevê-la. |
| `tests/integration/test_config_flow.py` (+1) | Um sensor devolvido no payload é preservado — companheiro do `test_options_flow_preserves_ph_ec_when_keys_omitted` já existente, que cobre a chave ausente. (O teste de "limpar" que eu tinha adicionado foi removido junto com a reversão do M2.) |
| `frontend-src/tests/card.test.ts` (+5) | B6 (registro legado sem `ph_value` não renderiza "?") e B7 (falha em ação direta vira `hass-notification`, com mensagem do backend ou fallback genérico). |

### Verificação executada

Rodada primeiro localmente e depois **no CI (Linux)**, que é onde a suíte de integração
finalmente pôde rodar — e onde o M2 foi desmascarado.

| Suíte | Resultado |
|---|---|
| Backend completo (CI) | **186 passed, 1 failed** → após reverter o M2: espera-se 186 passed (o teste removido era meu) |
| Frontend (CI) | **176 passed** |
| TypeScript / build / smoke | OK |
| Ruff (ruleset novo, CI) | All checks passed |
| Backend executável no Windows | **39 passed** (`test_services_yaml` + `test_next_run` + `test_schedules`) |
| `services.yaml` vs `_SERVICES_SCHEMA` do HA 2026.2.3 | **VALID** |

**Os testes novos de A1, A2 e A3 passaram todos no CI na primeira tentativa** — incluindo
os quatro do watchdog de desligamento, que era a mudança mais delicada. A única falha do
run foi `test_options_flow_preserves_ph_ec_when_keys_omitted`, o teste pré-existente que
contradizia o M2; ele estava certo, e o M2 foi revertido (§3).

**Lição registrada:** o achado M2 foi escrito sem procurar por um teste que já fixasse
aquele comportamento. O nome do teste (`..._preserves_ph_ec_when_keys_omitted`) descreve
exatamente a decisão que eu propus inverter. Uma busca por testes tocando o campo antes de
classificar o comportamento como defeito teria evitado o falso positivo.
