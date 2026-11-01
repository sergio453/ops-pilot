# Data Model: Trace Persistido + Logs JSON

**Feature**: `014-trace-persistido-logs-json`  
**Spec**: [spec.md](./spec.md)

## Entities

## 1) RequestRecord (`requests`)

Representa uma execução única de `/chat` e suas métricas operacionais.

**Fields**

- `requestId` (string, PK): identificador único da requisição.
- `conversationId` (string, nullable): conversa associada quando houver.
- `userId` (string, nullable): usuário associado, conforme entrada do chat.
- `route` (string): rota/estratégia solicitada; `strategy` identifica a estratégia efetivamente executada, incluindo reflexão.
- `strategy` (string): estratégia efetivamente utilizada na execução.
- `reflect` (boolean): indica se camada reflexiva foi solicitada.
- `status` (enum): `running | success | timeout | error`; o registro é criado com `running`.
- `startedAt` (datetime string): início da execução.
- `finishedAt` (datetime string, nullable): fim da execução (inclui erro/timeout).
- `latencyMs` (integer, nullable): latência final registrada.
- `llCalls` (integer, nullable): chamadas de modelo registradas.
- `historyMessages` (integer, nullable): quantidade de mensagens históricas usadas.
- `memoryHits` (integer, nullable): quantidade de memórias recuperadas.
- `promptTokens` (integer, nullable): estimativa de tokens de prompt, quando disponível.
- `modelUsed` (string, nullable): modelo reportado pela estratégia, quando disponível.
- `traceCount` (integer, default 0): total de eventos persistidos para a requisição.
- `errorCode` (string, nullable): código resumido em caso de falha.
- `errorMessage` (string, nullable): mensagem resumida operacional.

**Validation Rules**

- `requestId` obrigatório e não vazio.
- `status` obrigatório e limitado ao enum definido.
- `latencyMs`, `llCalls`, `traceCount`, `historyMessages`, `memoryHits`, `promptTokens` não negativos quando presentes.
- `finishedAt` obrigatório para status terminal (`success`, `timeout`, `error`).
- Para `running`, `finishedAt` permanece nulo e métricas finais podem ser nulas. A transição para estado terminal ocorre uma única vez; eventos tardios após timeout não alteram o resultado final.

---

## 2) TraceEventRecord (`trace_events`)

Representa um evento individual de trace associado à requisição.

**Fields**

- `id` (string ou inteiro, PK técnico): identificador interno da linha.
- `requestId` (string, FK -> `requests.requestId`): vínculo com a requisição.
- `eventIndex` (integer): posição sequencial do evento dentro da requisição (inicia em 0).
- `eventType` (string): tipo do evento de trace (`thought`, `action`, `observation`, `plan`, `critique`, `answer`, `route`, ou equivalente suportado pelo domínio).
- `node` (string): nó/componente emissor do evento.
- `content` (string, nullable): conteúdo textual do evento, quando houver.
- `payloadJson` (string JSON, nullable): payload estruturado do evento quando aplicável.
- `metadataJson` (string JSON): metadados de observabilidade do evento.
- `createdAt` (datetime string): timestamp de persistência do evento.

**Validation Rules**

- (`requestId`, `eventIndex`) deve ser único para garantir ordem estável por requisição.
- `eventIndex` obrigatório e não negativo.
- `node` obrigatório e não vazio.
- `metadataJson` obrigatório e JSON válido.

---

## 3) LogEventLine (JSONL de observabilidade)

Representa a linha de log emitida por `src/obs/logger.ts` para cada evento.

**Allowed Metadata Fields**

- `timestamp`
- `requestId`
- `eventIndex`
- `eventType`
- `node`
- `status` (quando aplicável)
- `payloadSize` (quando aplicável)
- `route` e `tokens` (quando aplicável no evento de conclusão)

**Constraints**

- Uma linha JSON por evento.
- Não incluir payload bruto completo nem segredos.
- Estrutura determinística para facilitar parse automatizado.
- Além das linhas dos eventos de trace, há uma linha de conclusão `eventType: done`, `node: resposta`, com status terminal, rota e tokens conhecidos. Essa linha operacional não aumenta `traceCount`.

---

## Relationships

- `RequestRecord 1:N TraceEventRecord`
  - Uma requisição possui zero ou mais eventos de trace.
  - Todo evento pertence a exatamente uma requisição.

---

## State Transitions

## Request lifecycle

1. `running` (registro criado em `requests`; eventos gravados em `trace_events` com incremento de `eventIndex`)
2. Durante a execução, consultas podem retornar `running`, métricas parciais e os eventos já persistidos.
3. Terminal:
   - `success` (resposta concluída)
   - `timeout` (deadline atingido)
   - `error` (falha interna)

## Query lifecycle (`GET /requests/:id`)

1. Validação de `requestId`
2. Busca em `requests`
3. Se não encontrado: retorno not-found explícito
4. Se encontrado: carregar `trace_events` ordenados por `eventIndex` e devolver resposta consolidada

---

## Indexing Strategy (Design-level)

- PK em `requests.requestId`.
- Índice/constraint único em (`trace_events.requestId`, `trace_events.eventIndex`).
- Índices auxiliares em `trace_events.requestId` e `requests.startedAt` para leitura operacional.
