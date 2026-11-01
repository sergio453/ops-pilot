# Quickstart: Memória semântica por usuário no chat

## Prerequisites

- Node.js 22 LTS
- Dependências instaladas (`npm install`), incluindo `@huggingface/transformers`
- Banco de dados SQLite padrão (`./data/opspilot.db`) ou `:memory:` em ambiente de testes

## 1) Validar gates obrigatórios do projeto

Executar typecheck estrito e suíte de testes:

```bash
npm run typecheck
npm test
```

**Expected outcome**:
- `npm run typecheck` passa sem erros (TypeScript estrito).
- Suíte completa de testes passa com status verde.

## 2) Revisar contratos e modelo de dados

- [spec.md](./spec.md)
- [research.md](./research.md)
- [data-model.md](./data-model.md)
- [contracts/chat-semantic-memory-contract.md](./contracts/chat-semantic-memory-contract.md)

**Expected outcome**:
- Compreensão das regras de similaridade (corte em 0.30, deduplicação em 0.92, limite top-3).
- Schema da tabela `memories` e formato do BLOB de embeddings documentados.

## 3) Executar testes focados do módulo de memória e endpoint HTTP

```bash
npm test -- src/memory/memory-store.test.ts src/http/server.test.ts
```

**Expected outcome**:
- Teste de busca sem palavras em comum: fato sobre animal/felino encontrado com consulta conceitual equivalente.
- Teste de deduplicação: fato similar com similaridade > 0.92 não gera novo registro na base.
- Teste de isolamento: usuário A não enxerga memórias do usuário B.
- Teste de esquecimento: fato esquecido com `forget` não é mais retornado pelo `recall`.
- Teste de integração `/chat`: prompt inclui contexto `MEMORY: <fact>` quando `userId` é informado.

## 4) Validação de ponta a ponta (Exemplo programático)

```typescript
import { SqliteMemoryStore } from "./src/memory/memory-store.js";

const store = new SqliteMemoryStore({ dbPath: ":memory:" });

// 1. Guardar fato
const record = await store.remember("user-1", "O cluster Kubernetes de produção roda na região us-east-1");
console.log("Memória salva:", record.id);

// 2. Consulta sem palavras em comum
const recalled = await store.recall("user-1", "onde fica nossa infraestrutura principal?");
console.log("Fatos recuperados:", recalled.map(r => r.fact));

// 3. Tentar duplicar fato semelhante
const dup = await store.remember("user-1", "O cluster K8s prod fica localizado em us-east-1");
console.log("É o mesmo ID de registro?", dup.id === record.id); // true

// 4. Esquecer fato
const forgot = await store.forget("user-1", record.id);
console.log("Esquecido:", forgot); // true
```

## Latest Validation Result

- Date: 2026-10-22
- Commands:
  - `npm test -- src/memory/memory-store.test.ts src/http/server.test.ts`
  - `npm run typecheck`
- Result:
  - Tests: PASS (todas as asserções de deduplicação, recall semântico e injeção no chat passaram)
  - Typecheck: PASS
