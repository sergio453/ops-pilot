# Research Notes: Conversa persistente no chat

## Decision 1: Criar `ConversationStore` SQLite separado do `SqliteOpsStore`

- **Decision**: Manter uma store dedicada para conversas (`create`, `append`, `lastMessages`) com
  tabela `messages` associada a uma tabela de `conversations`.
- **Rationale**: Isola responsabilidades e evita acoplamento indevido com o domínio operacional de
  alertas/incidentes já coberto pelo `SqliteOpsStore`.
- **Alternatives considered**:
  - Adicionar mensagens conversacionais no mesmo store de operações.
  - Persistir conversa em memória apenas durante o processo.
  - Persistir histórico em arquivo JSON sem schema relacional.

## Decision 2: Criar conversa automaticamente para `conversationId` ausente ou desconhecido

- **Decision**: Quando não houver `conversationId`, gerar um novo ID; quando houver ID inexistente,
  criar conversa com o mesmo valor informado e seguir o fluxo.
- **Rationale**: Evita erro desnecessário para o cliente e reduz fricção de integração,
  preservando continuidade quando o cliente controla o ID.
- **Alternatives considered**:
  - Retornar erro 404 para ID desconhecido.
  - Retornar erro 422 para ID desconhecido.
  - Exigir `conversationId` obrigatório em toda chamada.

## Decision 3: Limitar composição de contexto às 12 últimas mensagens cronológicas

- **Decision**: Buscar no máximo 12 mensagens históricas por conversa, ordenar cronologicamente e
  compor texto rotulado (`USER:`/`ASSISTANT:`) antes da mensagem atual.
- **Rationale**: Controla crescimento de prompt e custo, mantendo contexto recente mais relevante.
- **Alternatives considered**:
  - Usar histórico completo sem limite.
  - Limitar por caracteres/tokens em vez de número de mensagens.
  - Compor histórico como objetos estruturados em vez de texto rotulado.

## Decision 4: Persistir somente mensagem do usuário e resposta final

- **Decision**: Registrar apenas duas mensagens por ciclo bem-sucedido: entrada do usuário e resposta
  final do assistente.
- **Rationale**: Mantém histórico limpo e alinhado ao contrato funcional, sem ruído interno de trace.
- **Alternatives considered**:
  - Persistir trace completo de raciocínio no histórico.
  - Persistir eventos de erro e timeout como mensagens conversacionais.
  - Persistir somente mensagens de usuário.

## Decision 5: Expor `historyMessages` como métrica de observabilidade

- **Decision**: Incluir `historyMessages` no campo `metrics` da resposta de sucesso, com a contagem
  de mensagens históricas realmente usadas para compor o prompt.
- **Rationale**: Permite auditoria de uso de contexto sem exigir acesso ao armazenamento interno.
- **Alternatives considered**:
  - Não expor a métrica e manter apenas logs internos.
  - Expor apenas um booleano de “houve histórico”.
  - Expor o histórico completo na resposta.
