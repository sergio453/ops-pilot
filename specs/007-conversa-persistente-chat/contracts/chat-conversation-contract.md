# Contract: Chat com conversa persistente

## Scope

Contrato funcional do endpoint `POST /chat` com suporte a conversa persistente e composição de
histórico.

## Request contract

- **Method**: `POST`
- **Path**: `/chat`
- **Body**
  - `message` (obrigatório): texto da nova solicitação do usuário
  - `strategy` (opcional): estratégia de execução
  - `reflect` (opcional): habilita camada de reflexão conforme regras existentes
  - `maxIterations` (opcional): limite de iterações da estratégia
  - `conversationId` (opcional): identificador de conversa para continuidade de contexto

## Response contract (success)

- **Status**: `200`
- **Body**
  - `answer`: resposta final ao usuário
  - `trace`: rastreabilidade da execução
  - `metrics`: métricas de execução, incluindo `historyMessages`
  - `conversationId`: identificador da conversa usada na execução

## Conversation behavior contract

1. Se `conversationId` não for enviado, o sistema cria nova conversa e retorna o ID gerado.
2. Se `conversationId` for enviado e não existir, o sistema cria conversa com o mesmo ID e segue.
3. O prompt da estratégia usa até as 12 mensagens mais recentes da conversa, em ordem cronológica.
4. Apenas mensagem do usuário e resposta final do assistente são persistidas no histórico.
5. `metrics.historyMessages` informa a quantidade de mensagens históricas usadas no prompt da chamada.

## Error semantics

- **400**: payload inválido com lista de issues de validação.
- **422**: estratégia desconhecida.
- **504**: timeout de execução.
- **500**: erro interno não classificado.

> A introdução de conversa persistente não altera os contratos de erro acima.

## Validation contract

- Deve existir teste automatizado cobrindo:
  - criação de conversa sem `conversationId`;
  - continuidade com mesmo `conversationId`;
  - criação com `conversationId` informado inexistente;
  - contagem correta de `historyMessages`;
  - composição cronológica do histórico no prompt;
  - preservação dos erros `400`, `422` e `504`.
