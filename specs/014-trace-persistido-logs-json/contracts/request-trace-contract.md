# Contract: Request Trace Persistence & Retrieval

**Feature**: `014-trace-persistido-logs-json`  
**Related Spec**: [spec.md](../spec.md)

## 1) `POST /chat`

## Request Body

Mantém contrato atual de entrada de chat.

```json
{
  "message": "string",
  "strategy": "string",
  "reflect": false,
  "maxIterations": 6,
  "conversationId": "optional-string",
  "userId": "optional-string"
}
```

## Response Headers (200)

- `X-Request_Id`: `<requestId>`

## Response Body (200)

Resposta existente acrescida de `requestId`.

```json
{
  "requestId": "string",
  "answer": "string",
  "trace": [
    {
      "type": "string",
      "content": "string",
      "node": "string"
    }
  ],
  "metrics": {
    "llCalls": 0,
    "latencyMs": 0,
    "historyMessages": 0,
    "memoryHits": 0
  },
  "conversationId": "string"
}
```

## Error Responses

- `400` validação de payload
- `422` estratégia desconhecida
- `504` timeout
- `500` erro interno

Em todos os status, o `requestId` deve estar disponível quando a requisição já tiver entrado no fluxo de execução observável.

A implementação estabelece correlação antes do parser JSON: respostas 400 (inclusive JSON malformado), 422, 504 e 500 também incluem body/header. Payload inválido e estratégia desconhecida não criam registro de execução. Falha de persistência retorna 500 com `error: persistence_error`, sem detalhes internos.

---

## 2) `GET /requests/:id`

## Path Params

- `id` (string): `requestId`

## Response Body (200)

```json
{
  "request": {
    "requestId": "string",
    "conversationId": "optional-string",
    "strategy": "string",
    "reflect": false,
    "status": "success",
    "startedAt": "2026-11-01T12:00:00.000Z",
    "finishedAt": "2026-11-01T12:00:01.234Z",
    "metrics": {
      "llCalls": 0,
      "latencyMs": 0,
      "historyMessages": 0,
      "memoryHits": 0,
      "promptTokens": 0
    }
  },
  "trace": [
    {
      "eventIndex": 0,
      "eventType": "thought",
      "node": "roteador",
      "metadata": {
        "timestamp": "2026-11-01T12:00:00.100Z"
      },
      "payload": {
        "content": "..."
      }
    }
  ]
}
```

## Semântica de ordenação

- A lista `trace` retorna estritamente ordenada por `eventIndex` crescente.
- Durante a execução, `request.status` é `running`, `finishedAt` é nulo e métricas finais podem ser nulas; o trace contém os eventos já persistidos. Estados finais são `success`, `timeout` e `error`.
- O registro inclui também `userId` nullable, `route`, `traceCount`, `errorCode`/`errorMessage` nullable e `metrics.modelUsed` nullable. `conversationId` e métricas desconhecidas são null; payload ausente é null. O parâmetro aceita string não vazia (não exige formato UUID); identificador desconhecido retorna 404.

## Error Responses

- `404`: requestId inexistente
- `400`: requestId inválido
- `500`: erro interno

---

## 3) Structured Log Contract (`src/obs/logger.ts`)

Para cada evento de trace persistido ou processado, emitir uma linha JSON independente (JSONL):

```json
{"timestamp":"...","requestId":"...","eventIndex":0,"eventType":"thought","node":"roteador","status":"running","payloadSize":123}
```

## Logging rules

- Exatamente 1 linha JSON por evento.
- Somente metadados permitidos.
- Não incluir segredos, credenciais ou payloads sensíveis completos.
- Chaves consistentes para ingestão operacional automatizada.

Há ainda uma linha de conclusão por requisição finalizada, inspirada no nó de resposta solicitado:

```json
{"timestamp":"2026-11-01T12:00:01.234Z","requestId":"...","eventIndex":3,"eventType":"done","node":"resposta","status":"success","route":"react","tokens":42}
```

`route` e `tokens` são metadados adicionais permitidos; tokens desconhecidos são omitidos no log. `done` não representa outro evento persistido nem incrementa `traceCount`. Status de sucesso usa `success` em vez de `ok` para manter o modelo de dados. O campo `request` com conteúdo bruto do exemplo não é emitido; a correlação usa `requestId`.
