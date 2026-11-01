# Data Model: Memória semântica por usuário

## Entities

### Memory (`memories` table)

- **Fields**:
  - `id` (TEXT, PRIMARY KEY): Identificador único da memória (UUID v4).
  - `user_id` (TEXT, NOT NULL): Identificador do usuário proprietário da memória.
  - `fact` (TEXT, NOT NULL): Conteúdo textual do fato armazenado.
  - `embedding` (BLOB, NOT NULL): Vetor denso de embedding serializado em bytes (Float32Array little-endian, 384 dimensões = 1536 bytes).
  - `created_at` (TEXT, NOT NULL): Data/hora de criação em formato ISO-8601 UTC.
- **Indexes**:
  - `idx_memories_user_created`: Índice composto em `(user_id, created_at DESC)` para aceleração de buscas e deleções escopadas por usuário.
- **Validation rules**:
  - `user_id` não pode ser vazio após normalização (`trim()`).
  - `fact` não pode ser vazio após normalização (`trim()`).
  - `embedding` deve ser um vetor não vazio, normalizado com norma $L_2 = 1.0$.
  - deduplicação: Se `cosineSimilarity(novo_embedding, existente) >= 0.92` para o mesmo `user_id`, a inserção é evitada.

### MemoryRecord (TypeScript model)

- **Structure**:
  ```typescript
  export interface MemoryRecord {
    id: string;
    userId: string;
    fact: string;
    embedding: Float32Array;
    createdAt: string;
  }
  ```

### ChatRequest (Update)

- **Fields**:
  - `message` (string, obrigatório, min 1)
  - `strategy` (string, opcional, default "react")
  - `reflect` (boolean, opcional, default false)
  - `maxIterations` (number, opcional, default 6)
  - `conversationId` (string, opcional)
  - `userId` (string, opcional): Identificador do usuário para recuperação e vinculação de memórias semânticas.
- **Validation rules**:
  - `userId`, se informado, deve ser string não vazia após `trim()`.

### ChatResponse (Update)

- **Fields**:
  - `answer` (string): Resposta do agente.
  - `trace` (array): Rastreabilidade das etapas executadas.
  - `metrics` (object): Métricas de execução (`iterations`, `durationMs`, `historyMessages`, `memoryHits`).
  - `conversationId` (string): Identificador da conversa ativa.

## Operations & State Transitions

### 1. `remember(userId, fact)`

- Entrada: `userId: string`, `fact: string`
- Passos:
  1. Valida `userId` e `fact` (não vazios).
  2. Gera embedding vetorial para `fact` e normaliza ($L_2$).
  3. Recupera memórias existentes para `userId`.
  4. Calcula similaridade com memórias existentes:
     - Se encontrar registro com similaridade $\ge 0.92$, retorna a memória existente (deduplicação).
  5. Se não for duplicado, persiste nova tupla em `memories` com `id = UUID`, `embedding = BLOB`.
  6. Retorna o novo `MemoryRecord`.

### 2. `recall(userId, query, limit = 3)`

- Entrada: `userId: string`, `query: string`, `limit: number` (padrão 3)
- Passos:
  1. Valida `userId` (não vazio). Se `query` for vazia, retorna `[]`.
  2. Gera embedding vetorial para `query` e normaliza.
  3. Carrega todas as memórias do usuário em `memories WHERE user_id = ?`.
  4. Calcula produto escalar / cosseno entre embedding da consulta e cada memória.
  5. Filtra itens com score $\ge 0.30$.
  6. Ordena decrescente pelo score de similaridade.
  7. Retorna até `limit` registros ordenados.

### 3. `forget(userId, memoryId)`

- Entrada: `userId: string`, `memoryId: string`
- Passos:
  1. Valida `userId` e `memoryId`.
  2. Consulta memória por `id`.
  3. Se não existir ou pertencer a outro `user_id`, retorna `false` (sem alterar nada).
  4. Executa `DELETE FROM memories WHERE id = ? AND user_id = ?`.
  5. Retorna `true` se ao menos 1 linha foi afetada.

### 4. Ciclo de Prompt no `/chat` com Memória

- Entrada no controller: `req.body` com `userId` opcional.
- Se `userId` presente:
  - Invoca `memoryStore.recall(userId, message, 3)`.
  - Injeta cada fato retornado no início do prompt formatado como `MEMORY: <fact>`.
  - Concatena com histórico recente de conversa (`USER: ...`, `ASSISTANT: ...`).
  - Finaliza com a mensagem atual (`USER: <message>`).
- Persistência:
  - A mensagem do usuário é opcionalmente armazenada como fato na memória ou apenas consultada conforme fluxo.
