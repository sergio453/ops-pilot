# Data Model: Conversa persistente no chat

## Entities

### Conversation

- **Fields**: `id`, `created_at`
- **Purpose**: Identificar unicamente um fio de conversa reaproveitável entre chamadas de chat.
- **Validation rules**:
  - `id` não pode ser vazio após normalização
  - `id` deve ser único no conjunto de conversas
  - `created_at` obrigatório no momento da criação

### ConversationMessage

- **Fields**: `id`, `conversation_id`, `role`, `content`, `created_at`
- **Purpose**: Persistir cada troca relevante (usuário e resposta final) associada a uma conversa.
- **Validation rules**:
  - `conversation_id` deve referenciar conversa existente
  - `role` limitado a `user` ou `assistant`
  - `content` não pode ser vazio
  - `created_at` obrigatório para ordenação cronológica

### ChatRequest

- **Fields**: `message`, `strategy`, `reflect`, `maxIterations`, `conversationId`
- **Purpose**: Representar entrada validada do endpoint `/chat` com suporte a continuidade de
  contexto.
- **Validation rules**:
  - `message` obrigatório e não vazio
  - `conversationId` opcional, mas quando presente não pode ser vazio
  - demais campos mantêm validação já existente da API

### ChatResponse

- **Fields**: `answer`, `trace`, `metrics`, `conversationId`
- **Purpose**: Representar saída bem-sucedida com rastreabilidade e observabilidade de histórico.
- **Validation rules**:
  - `conversationId` obrigatório em sucesso
  - `metrics.historyMessages` deve refletir a contagem de histórico efetivamente aplicada

## Derived Views / Query Shapes

### ConversationHistoryForPrompt

- **Input**: `conversationId`, `limit=12`
- **Output**: coleção ordenada cronologicamente de mensagens (`role`, `content`) para composição do
  prompt
- **Rule**: quando houver mais de 12 registros, retornar apenas os 12 mais recentes

### ChatMetricsView

- **Input**: resultado da estratégia + histórico carregado
- **Output**: objeto `metrics` incluindo `historyMessages`
- **Rule**: `historyMessages` = tamanho da coleção usada na composição (não do total persistido)

## State Transitions

### Conversation lifecycle

- `request_received -> conversation_resolved_or_created -> history_loaded -> prompt_composed`

### Message persistence lifecycle (success path)

- `strategy_completed -> user_message_persisted -> assistant_message_persisted -> response_returned`

### Failure lifecycle

- `validation_failed -> response_400`
- `unknown_strategy -> response_422`
- `execution_timeout -> response_504`
- `internal_error -> response_500`

> Em caminhos de falha, o contrato de erro existente permanece inalterado.
