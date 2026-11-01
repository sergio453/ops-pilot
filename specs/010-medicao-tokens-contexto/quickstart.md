# Quickstart: Medição e instrumentação de tokens do contexto

## Prerequisites

- Node.js 22 LTS
- Dependências instaladas (`npm install`)
- Banco de dados SQLite padrão (`./data/opspilot.db`) ou `:memory:` em ambiente de testes
- Servidor HTTP iniciado localmente para testes manuais (`npm run dev:http`)
- Utilitário `curl` instalado para execução de `conversa-longa.sh`

---

## 1) Validar gates obrigatórios do projeto

Executar typecheck estrito e a suíte completa de testes:

```bash
npm run typecheck
npm test
```

**Expected outcome**:
- `npm run typecheck` passa sem erros (TypeScript estrito).
- Suíte completa de testes passa com status 100% verde.

---

## 2) Revisar artefatos de design

- [spec.md](./spec.md)
- [plan.md](./plan.md)
- [research.md](./research.md)
- [data-model.md](./data-model.md)
- [contracts/context-tokens-contract.md](./contracts/context-tokens-contract.md)

---

## 3) Executar testes focados do contexto e endpoint HTTP

```bash
npm test -- src/context/tokens.test.ts src/http/server.test.ts
```

**Expected outcome**:
- Teste de `estimateTokens`: strings de 0, 4, 15, 100 caracteres retornam exatamente `Math.ceil(chars / 4)`.
- Teste de extração LangChain: mensagens com `usage_metadata` têm `input_tokens` extraído corretamente.
- Teste de fallback: quando `usage_metadata` está ausente, o fallback estimado é utilizado sem lançar erros.
- Teste do breakdown: `calculateContextBreakdown` separa as contagens de `memories`, `history` e `userMessage`.
- Teste do endpoint `/chat`: resposta HTTP 200 contém `metrics.promptTokens` e `metrics.contextBreakdown`.

---

## 4) Execução do script `conversa-longa.sh`

Em um terminal com o servidor ativo (`npm run dev:http` ou `npm run dev:http:env`):

```bash
chmod +x ./conversa-longa.sh
./conversa-longa.sh
```

**Expected outcome**:
- O script realiza múltiplos turnos sequenciais em uma mesma conversa.
- A cada turno, o terminal exibe o valor de `PromptTokens` crescendo conforme o histórico é acumulado.
- Finalização com código de saída 0.

