# Quickstart: Servidor MCP OpsPilot

## Prerequisites

- Node.js 22 LTS
- Dependências instaladas com `npm install`
- Branch da feature `006-opspilot-mcp-server`

## 1) Validar gates obrigatórios

```bash
npm run typecheck
npm test
```

**Expected outcome**:

- Typecheck sem erros
- Suíte de testes verde

## 2) Revisar contrato MCP da feature

Consultar [contracts/mcp-server-tools.md](./contracts/mcp-server-tools.md).

**Expected outcome**:

- Nome do servidor definido como `opspilot`
- Catálogo com exatamente 3 tools no escopo
- Regra de IO (stdout protocolo, stderr diagnóstico) explicitada

## 3) Revisar modelo de dados da integração

Consultar [data-model.md](./data-model.md).

**Expected outcome**:

- Entidades cobrem identidade do servidor, catálogo de tools, entradas e saídas operacionais
- Transições de estado cobrem sucesso e falha das chamadas

## 4) Subir servidor MCP localmente

```bash
npm run mcp
```

**Expected outcome**:

- Processo inicia sem emitir logs de diagnóstico em stdout
- Servidor fica pronto para handshake MCP via stdio

## 5) Executar validação focal do servidor MCP

```bash
npm test -- src/mcp/server.test.ts
```

**Expected outcome**:

- Teste valida que a listagem de tools contém exatamente:
  - `list_alerts`
  - `open_incident`
  - `resolve_incident`

## 6) Rodar validação completa do repositório

```bash
npm run typecheck
npm test
```

**Expected outcome**:

- Feature MCP integrada sem regressões no fluxo atual

## Latest Validation Result

- Date: 2026-10-17
- Commands:
  - `npm run typecheck`
  - `npm test`
  - `node --import tsx --test src/mcp/server.test.ts`
- Result:
  - Typecheck: PASS
  - MCP server tests: PASS (8 passed, 0 failed)
  - Full suite: PASS (43 passed, 0 failed)
