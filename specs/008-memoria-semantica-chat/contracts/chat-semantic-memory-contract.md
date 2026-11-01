# Contract: Chat com memória semântica por usuário

## Scope

Contrato da interface HTTP `POST /chat` e do subsistema de memória semântica (`MemoryStore`), com suporte a persistência e recuperação contextual baseada em embeddings locais.

## HTTP Interface Contract

### Request: `POST /chat`

```json
{
  "message": "Qual é a base de dados em produção?",
  "strategy": "react",
  "reflect": false,
  "maxIterations": 6,
  "conversationId": "c4b14d80-5fc5-4f49-b003-8d697b6fa202",
  "userId": "user-ops-42"
}
```

- `message` (string, obrigatório): Consulta ou comando enviado pelo usuário.
- `strategy` (string, opcional): Nome da estratégia de raciocínio (default: `"react"`).
- `reflect` (boolean, opcional): Se ativa auto-reflexão (default: `false`).
- `maxIterations` (number, opcional): Limite de passos (default: `6`).
- `conversationId` (string, opcional): ID da conversa para continuidade de histórico.
- `userId` (string, opcional): ID do usuário para recuperação semântica personalizada.

### Response (Success: `200 OK`)

```json
{
  "answer": "A base principal de produção é o cluster MySQL hospedado na AWS.",
  "trace": [...],
  "metrics": {
    "iterations": 2,
    "durationMs": 420,
    "historyMessages": 4,
    "memoryHits": 1
  },
  "conversationId": "c4b14d80-5fc5-4f49-b003-8d697b6fa202"
}
```

- `metrics.memoryHits`: Número inteiro representando quantos fatos semânticos foram recuperados e injetados no prompt.

---

## Programmatic Interface: `MemoryStore`

### `remember(userId: string, fact: string): Promise<MemoryRecord>`
- Armazena um fato em linguagem natural para o usuário especificado.
- Gera embedding via modelo local normalizado.
- Aplica regra de deduplicação: se a similaridade com um fato pré-existente do mesmo usuário for $\ge 0.92$, não grava novo registro e retorna a memória existente.

### `recall(userId: string, query: string, limit?: number): Promise<MemoryRecord[]>`
- Busca as memórias mais relevantes para a consulta no espaço semântico do usuário.
- Calcula similaridade por produto escalar / cosseno entre embedding da query e embeddings das memórias salvas.
- Filtra apenas memórias com score $\ge 0.30$.
- Ordena decrescente por score de similaridade.
- Limita o resultado ao valor de `limit` (padrão: 3).
- **Garantia semântica**: Fatos relevantes são recuperados mesmo quando não compartilham nenhuma palavra em comum com a query (ex: "tenho um felino siamês" para a query "quais animais de estimação?").

### `forget(userId: string, memoryId: string): Promise<boolean>`
- Remove permanentemente a memória identificada por `memoryId`.
- Retorna `true` se a memória existia e pertencia ao `userId` indicado, sendo deletada.
- Retorna `false` se a memória não existe ou pertence a outro `userId` (sem alterar nada).

---

## Behavior Rules

1. **Isolamento de usuário**: Memórias do `user-A` jamais podem ser recuperadas por consultas do `user-B`.
2. **Injeção no prompt**: As memórias recuperadas são inseridas no topo do prompt antes do histórico conversacional, no formato:
   ```text
   MEMORY: <fato 1>
   MEMORY: <fato 2>
   USER: <histórico>
   ASSISTANT: <histórico>
   USER: <mensagem atual>
   ```
3. **Ausência de `userId`**: Quando `userId` não é informado na chamada de `/chat`, nenhuma busca de memória ocorre (`memoryHits = 0`), mantendo o comportamento padrão do chat.
4. **Armazenamento de embedding**: Vetor gerado localmente com 384 dimensões em ponto flutuante de 32 bits, persistido em coluna `BLOB` no SQLite.

---

## Error Semantics

- **400 Bad Request**: Validação Zod falha (ex: `message` vazia, tipos incorretos).
- **422 Unprocessable Entity**: Estratégia desconhecida.
- **504 Gateway Timeout**: Tempo limite de resposta excedido.
- **500 Internal Server Error**: Erro inesperado no processamento.
