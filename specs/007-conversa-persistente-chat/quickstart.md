# Quickstart: Conversa persistente no chat

## Prerequisites

- Node.js 22 LTS
- Dependências instaladas com `npm install`
- Branch da feature `007-conversa-persistente-chat`

## 1) Validar gates obrigatórios

```bash
npm run typecheck
npm test
```

**Expected outcome**:

- Typecheck sem erros
- Suíte de testes verde

## 2) Revisar contratos da feature

- [contracts/chat-conversation-contract.md](./contracts/chat-conversation-contract.md)
- [data-model.md](./data-model.md)

**Expected outcome**:

- Regras de criação/reuso de `conversationId` claras
- Limite e ordenação do histórico definidos
- Métrica `historyMessages` explicitada

## 3) Executar validação focada do endpoint e store

```bash
npm test -- src/http/server.test.ts src/store/sqlite-conversation-store.test.ts
```

**Expected outcome**:

- Cenário sem `conversationId` retorna ID de conversa e `historyMessages = 0`
- Cenário com conversa existente reaproveita contexto e incrementa `historyMessages`
- Persistência em `:memory:` funciona de forma determinística

## 4) Validar comportamento de continuidade

Executar duas requisições consecutivas com o mesmo `conversationId` no ambiente local e verificar:

1. primeira resposta com `conversationId` esperado;
2. segunda resposta com `historyMessages > 0`;
3. composição de histórico respeitando ordem cronológica e limite de 12 mensagens.

**Expected outcome**:

- Continuidade contextual comprovada de ponta a ponta
- Contrato de observabilidade de histórico atendido

## 5) Revalidar regressões de contrato de erro

```bash
npm test -- src/http/server.test.ts
```

**Expected outcome**:

- Erros de validação continuam retornando `400`
- Estratégia desconhecida continua retornando `422`
- Timeout continua retornando `504`

## Latest Validation Result

- Date: 2026-10-19
- Commands:
  - `npm test -- src/http/server.test.ts src/store/sqlite-conversation-store.test.ts`
  - `npm run typecheck`
- Result:
  - Focused tests: PASS
  - Typecheck: PASS
