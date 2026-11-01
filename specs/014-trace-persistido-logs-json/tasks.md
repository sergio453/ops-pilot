# Tasks: Trace Persistido + Logs JSON

**Feature**: `014-trace-persistido-logs-json`
**Input**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/request-trace-contract.md](./contracts/request-trace-contract.md), [quickstart.md](./quickstart.md).
**Organização**: tarefas por história, em ordem de dependência. Caminhos de código relativos à raiz do repositório.
**Testes**: exigidos pela constituição IV e previstos no plano; escrever os testes de cada comportamento antes da implementação e confirmar a falha esperada. Usar `node:test`, estratégias falsas e SQLite temporário ou `:memory:` sem chamadas ao provedor.
**Formato**: `- [ ] Tnnn [P?] [USn?] descrição com caminho`. `[P]` indica trabalho em arquivos distintos, sujeito às dependências abaixo.

## Phase 1: Setup

**Objetivo**: preparar a validação usando a infraestrutura existente, sem novas dependências.

- [X] T001 Executar `npm test` e `npm run typecheck` definidos em `package.json`, registrar eventuais falhas preexistentes em `specs/014-trace-persistido-logs-json/quickstart.md` e conferir os pontos de injeção de estratégias/stores em `src/http/server.test.ts` antes de alterar o fluxo.

## Phase 2: Foundational

**Objetivo**: estabelecer tipos e fronteiras compartilhadas antes das histórias.

- [X] T002 Definir interfaces e schemas zod de `RequestRecord`, `TraceEventRecord`, `LogEventLine` e `RequestTraceStore` em `src/obs/types.ts`, incluindo criação, append, finalização e lookup; preservar todos os campos do modelo. Aplicar literalmente as restrições: `requestId` "obrigatório e não vazio"; `status` "obrigatório e limitado ao enum definido" (`running | success | timeout | error`); `conversationId`, `finishedAt`, `latencyMs`, `llCalls`, `historyMessages`, `memoryHits`, `promptTokens`, `errorCode`, `errorMessage` nullable; `traceCount` default 0; métricas "não negativos quando presentes"; `finishedAt` "obrigatório para status terminal". Validar datas e os inteiros definidos no modelo, mantendo `finishedAt` nulo em `running`.
- [X] T003 Definir em `src/obs/types.ts` os schemas de evento e de resposta histórica: `id` técnico inteiro, FK `requestId`, `eventIndex` "obrigatório e não negativo", iniciando em 0; `node` "obrigatório e não vazio"; `content` e `payloadJson` nullable; `metadataJson` "obrigatório e JSON válido"; `createdAt` datetime; unicidade de (`requestId`, `eventIndex`). Definir classes de erro de domínio em `src/obs/errors.ts` para lookup inexistente, colisão de ID e falha de persistência, traduzíveis na fronteira HTTP.

**Checkpoint**: contratos compartilhados tipados e validados; nenhuma história depende de uma implementação concreta de store.

## Phase 3: US1 — Correlacionar uma execução de chat (P1, MVP)

**Objetivo**: retornar um identificador exclusivo no corpo e no header `X-Request_Id`.
**Teste independente**: chamar `/chat` com estratégia falsa, comparar body/header e provar IDs distintos em chamadas concorrentes; manter os campos anteriores da resposta.

- [X] T004 [US1] Adicionar testes de contrato em `src/http/request-trace.test.ts` para igualdade body/header em sucesso, unicidade em chamadas concorrentes e correlação em respostas 400, 422, 504 e 500, preservando códigos de erro e contratos existentes.
- [X] T005 [US1] Criar o `requestId` com `randomUUID()` no início do fluxo `/chat` em `src/http/server.ts`, antes da validação do corpo; incluir `X-Request_Id` e `requestId` nas respostas de sucesso e erro, inclusive JSON malformado via tratamento de erro do parser, e validar a saída HTTP com zod sem remover `answer`, `trace`, `metrics` ou `conversationId` existentes.
- [X] T006 [US1] Executar os testes de correlação de `src/http/server.test.ts` e conferir regressões de conversa, reflexão e métricas usando os scripts de `package.json`.

**Checkpoint**: US1 utilizável sem persistência; FR-001 a FR-003 e SC-001 demonstráveis.

## Phase 4: US2 — Persistir rastros e métricas da requisição (P1)

**Objetivo**: registrar ciclo de vida, métricas e eventos incrementais, emitindo uma linha JSON de metadados por evento.
**Teste independente**: executar `/chat` contra store injetada, consultar o store diretamente e comparar eventos persistidos com linhas JSON; repetir com falha e timeout depois de emitir um evento.

### Testes primeiro

- [X] T007 [P] [US2] Criar `src/store/sqlite-request-trace-store.test.ts` cobrindo criação `running`, todos os campos/nullable do modelo, validações, FK, índices únicos, colisão sem sobrescrita, eventos vazios, atualização atômica de `traceCount`, finalização única e reabertura de banco em arquivo temporário para comprovar durabilidade; manter testes isolados com `:memory:` nos demais casos.
- [X] T008 [P] [US2] Criar `src/obs/logger.test.ts` com sink capturável para provar uma linha parseável por evento, inclusive conteúdo com quebras de linha, e allowlist exclusiva `timestamp`, `requestId`, `eventIndex`, `eventType`, `node`, `status`, `payloadSize`; inserir segredos fictícios em payloads e garantir ausência na saída.
- [X] T009 [P] [US2] Ampliar `src/agents/trace.test.ts` para testar emissão incremental por callback opcional com `node` de origem, ordem e equivalência com trace final, incluindo reflexão sem duplicação, falha após evento e compatibilidade de chamadas sem callback.
- [X] T010 [P] [US2] Criar `src/http/request-trace.test.ts` com store/logger injetados para provar registro inicial, métricas finais e parciais, persistência incremental antes de resolver a estratégia, falha/timeout com trace parcial, isolamento de requisições concorrentes, erro de store e ausência de finalização duplicada ou eventos tardios após timeout.

### Implementação

- [X] T011 [US2] Implementar `src/store/sqlite-request-trace-store.ts` com `DatabaseSync`, configuração `OPSPILOT_DB` (default `./data/opspilot.db`, suporte `:memory:`), criação idempotente de `requests`/`trace_events` coexistindo com tabelas atuais, FK ativada, PK de request e constraint única (`request_id`, `event_index`), índices de lookup e `started_at`; usar statements parametrizados, validações de T002/T003 e mapeamento explícito snake_case/camelCase.
- [X] T012 [US2] Implementar criação, append e finalização no store em `src/store/sqlite-request-trace-store.ts`: persistir `node`, conteúdo e payload original (inclusive `action`), JSON válido e sequência local iniciando em zero; atualizar evento/contador em transação; aplicar "A transição para estado terminal ocorre uma única vez; eventos tardios após timeout não alteram o resultado final"; manter métricas desconhecidas nulas e estado parcial legível em falha.
- [X] T013 [P] [US2] Implementar serializador puro e sink injetável em `src/obs/logger.ts`, respeitando "Uma linha JSON por evento", "Não incluir payload bruto completo nem segredos" e "Estrutura determinística"; selecionar somente a allowlist de T008 sem espalhar objetos de payload ou mensagens de erro brutas.
- [X] T014 [US2] Acrescentar callback opcional de emissão e identificação de `node` em `src/agents/types.ts` e helper em `src/agents/trace.ts`, preservando chamadas e formatação existentes; manter o callback no escopo de cada execução e propagar erros de observabilidade explicitamente, sem callbacks globais.
- [X] T015 [US2] Integrar emissão incremental em `src/agents/react.ts`, `src/agents/plan-and-execute.ts` e `src/agents/reflection.ts`; consumir eventos do grafo durante a execução quando necessário, atribuir o nó real, propagar callback por wrappers e garantir que cada evento final corresponda a uma emissão, sem republicar traces ao concatenar reflexão. Preservar métricas e respostas atuais.
- [X] T016 [US2] Criar serviço de ciclo de vida em `src/obs/request-trace-service.ts` para coordenar store e logger: abrir `running`, sequenciar eventos por request, persistir e emitir uma única linha por evento aceito, finalizar sucesso/timeout/erro uma vez e bloquear callbacks tardios; repetir geração de UUID apenas em colisão de chave, nunca sobrescrever registros nem repetir em outros erros de banco.
- [X] T017 [US2] Integrar serviço, store e logger por injeção em `src/http/server.ts`; abrir registro após validação e resolução da estratégia antes da execução observável, capturar a estratégia efetiva/reflexão, associar conversationId e métricas (`llCalls`, latência, histórico, memórias, tokens), finalizar antes da resposta e preservar dados parciais em falha. Manter requestId em 400/422 sem exigir registro de execução; traduzir falhas de persistência em erro operacional explícito e mensagens seguras.
- [X] T018 [US2] Executar os testes de store, logger, trace e HTTP de `src/store/sqlite-request-trace-store.test.ts`, `src/obs/logger.test.ts`, `src/agents/trace.test.ts` e `src/http/server.test.ts`, confirmando igualdade entre eventos aceitos, linhas JSON e `traceCount`, além de ausência de regressões nas estratégias existentes.

**Checkpoint**: US2 verificável diretamente no store sem endpoint histórico; FR-004 a FR-007 e SC-004 cobertos. Durabilidade demonstrada por reabertura do banco; SC-002 em produção exige amostragem operacional posterior.

## Phase 5: US3 — Recuperar histórico completo por requestId (P2)

**Objetivo**: expor registro e trace ordenado em `GET /requests/:id`.
**Teste independente**: sem executar chat, semear registro e eventos no store, consultar HTTP repetidamente e comparar ordem; validar 404, ID inválido, zero eventos e registro `running`.

- [X] T019 [P] [US3] Adicionar testes de lookup em `src/store/sqlite-request-trace-store.test.ts` para sequência fora da ordem de inserção, timestamps iguais, isolamento por requestId, nenhum evento e ID inexistente; exigir leitura coerente de registro/trace e ordem por `event_index`.
- [X] T020 [P] [US3] Adicionar testes HTTP em `src/http/request-trace.test.ts` para GET 200 conforme contrato (payloads e métricas preservados), repetição com ordem estável, registro `running` com métricas nulas, 404 sem dados parciais, 400 para ID inválido e 500 seguro em falha de store; usar IDs não vazios desconhecidos para 404, sem impor UUID ao parâmetro.
- [X] T021 [US3] Implementar lookup consistente em `src/store/sqlite-request-trace-store.ts`, retornando registro e eventos com `ORDER BY event_index ASC`, JSON desserializado validado, resultado inexistente explícito e suporte a registro sem eventos ou ainda `running`.
- [X] T022 [US3] Implementar consulta no serviço em `src/obs/request-trace-service.ts` e rota `GET /requests/:id` em `src/http/server.ts`, validando ID string não vazio e saída com zod, mapeando `request.metrics`, `trace.eventType`, `metadata` e `payload` segundo `specs/014-trace-persistido-logs-json/contracts/request-trace-contract.md`; traduzir erros para 400/404/500 sem dados parciais ou detalhes internos.
- [X] T023 [US3] Executar os testes de leitura de `src/store/sqlite-request-trace-store.test.ts` e `src/http/server.test.ts`, incluindo ciclo completo POST → GET com a mesma correlação e recuperação após reabrir banco temporário.

**Checkpoint**: FR-008 a FR-010 e SC-003 verificáveis com leituras repetidas e timestamps empatados.

## Phase 6: Polish & validação transversal

- [X] T024 Executar `npm test` e `npm run typecheck` de `package.json`, corrigir regressões introduzidas nos arquivos da feature e registrar os resultados reais em `specs/014-trace-persistido-logs-json/quickstart.md`.
- [X] T025 Atualizar e executar `specs/014-trace-persistido-logs-json/quickstart.md` com configuração SQLite em arquivo para teste de reinício, pré-requisitos do provedor para smoke test manual, comparação body/header, GET ordenado e 404; documentar testes determinísticos com estratégias falsas para falha/timeout e inspeção JSONL com segredo fictício, distinguindo resultados executados de cenários ainda não executados.
- [X] T026 Revisar rastreabilidade FR-001 a FR-010 e SC-001 a SC-004 em `specs/014-trace-persistido-logs-json/tasks.md`, marcar somente tarefas efetivamente concluídas e documentar em `specs/014-trace-persistido-logs-json/quickstart.md` a medição de latência de lookup (< 500 ms para trace típico em banco local, conforme plano) e o procedimento de amostragem de persistência em produção para SC-002, sem alegar medição de produção local.

## Dependencies & Execution Order

```text
T001 → T002 → T003 → US1 (T004–T006) → US2 (T007–T018) → US3 (T019–T023) → T024–T026
```

- US1 precisa apenas dos contratos compartilhados; entrega o MVP sem banco novo.
- US2 usa a correlação de US1; pode ser validada diretamente pelo store, independentemente de US3.
- US3 usa o store de US2; seus testes usam dados semeados, sem depender de uma chamada real ao modelo.
- T007–T010 podem ser escritos em paralelo após US1, pois alteram arquivos distintos; confirmar falhas antes de implementar o comportamento correspondente.
- T011 → T012; T014 → T015; T012 + T013 + T015 → T016 → T017 → T018.
- T013 pode ocorrer em paralelo com T011/T012 depois dos testes, pois só depende dos contratos compartilhados e do teste de logger.
- T019 e T020 podem ocorrer em paralelo após US2; ambos precedem T021/T022. T021 → T022 → T023.
- Alterações em `src/http/server.ts` e `src/http/server.test.ts` de histórias diferentes devem ser sequenciais.

## Exemplos de execução paralela por história

- **US1**: não há tarefas marcadas `[P]`; teste → implementação → validação compartilham a mesma fronteira HTTP.
- **US2**: escrever T007 (store), T008 (logger), T009 (trace) e T010 (HTTP) em paralelo; após falhas confirmadas, implementar T013 junto com T011/T012. Integrar somente quando dependências estiverem prontas.
- **US3**: escrever T019 (store) e T020 (HTTP) em paralelo, depois implementar lookup antes da rota.

## Implementation Strategy

1. Preparar baseline e schemas compartilhados.
2. Entregar US1 como MVP: requestId único e correlação body/header, com testes independentes.
3. Acrescentar US2: store durável, eventos incrementais, logs seguros e estados terminais, sem depender da rota de consulta.
4. Acrescentar US3: recuperação histórica validada e ordenação estável.
5. Executar gates completos e quickstart; registrar evidências e limitações de medição. Geração de tarefas não implica implementação concluída.

## Cobertura planejada

| Requisitos | História / tarefas |
|---|---|
| FR-001–FR-003, SC-001 | US1: T004–T006; colisão no store em T007/T016 |
| FR-004–FR-006, SC-002 | US2: T007, T009–T012, T014–T018; validação operacional T025–T026 |
| FR-007, SC-004 | US2: T008, T010, T013, T016–T018 |
| FR-008–FR-010, SC-003 | US3: T019–T023 |

**Hooks**: `.specify/extensions.yml` ausente na geração; nenhum hook before_tasks/after_tasks registrado.

## Conclusão da implementação — 2026-11-01

26/26 tarefas concluídas. Os testes HTTP novos estão em `src/http/request-trace.test.ts`; os existentes de histórico/sumarização permanecem em `src/http/server.test.ts`. Testes diretos das estratégias estão em `src/agents/streaming.test.ts`. A suíte integral passou 90/90; a rodada final após o teste adicional de reinício passou 10/10; typecheck aprovado. Ver evidências e limites em [quickstart.md](./quickstart.md). A amostragem de produção de SC-002 permanece como procedimento operacional documentado, sem alegação de execução local. Nenhum hook before_implement/after_implement configurado.


