# Implementation Plan: Memória semântica por usuário no chat

**Branch**: `008-memoria-semantica-chat` | **Date**: 2026-10-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-memoria-semantica-chat/spec.md`

## Summary

Implementar subsistema de memória semântica contextual para o agente de chat escopado por `userId`. O sistema utiliza geração local de embeddings vetoriais com `sentence-transformers/all-MiniLM-L6-v2` via `@huggingface/transformers` com lazy singleton, persistência em SQLite na tabela `memories` (com embeddings em coluna `BLOB`), operações de deduplicação semântica no armazenamento (`remember` com threshold $> 0.92$), recuperação semântica ordenada por produto escalar/cosseno (`recall` com limite Top-3 e corte mínimo $\ge 0.30$), remoção sob demanda (`forget`) e injeção automática de fatos recuperados no prompt do endpoint `POST /chat` (`MEMORY: <fato>`), preservando total isolamento entre usuários e retrocompatibilidade com o fluxo conversacional existente.

## Technical Context

**Language/Version**: TypeScript ESM (`strict: true`) em Node.js 22 LTS

**Primary Dependencies**: `@huggingface/transformers` (para modelo de embedding local `all-MiniLM-L6-v2` com pooling mean e normalização $L_2$), `express`, `zod`, `node:sqlite` (`DatabaseSync`)

**Storage**: SQLite com `OPSPILOT_DB` (padrão `./data/opspilot.db`), tabela `memories` (`id`, `user_id`, `fact`, `embedding`, `created_at`), índices por `(user_id, created_at DESC)` e suporte nativo a `:memory:` para testes determinísticos sem I/O de disco

**Testing**: `node --test` via `tsx` (`npm test`) + `npm run typecheck`

**Target Platform**: Serviço backend Node.js 22 local/servidor

**Project Type**: Backend web-service

**Performance Goals**:
- Instanciação de embedding via lazy singleton para carregar pesos do modelo uma única vez
- Comparação vetorial em memória via Float32Array e buffers binários
- Consulta de `recall` e injeção de contexto no prompt com overhead mínimo (< 50ms)

**Constraints**:
- Isolamento estrito de dados entre usuários: consultas e exclusões nunca cruzam fronteiras de `userId`
- Deduplicação semântica automática para similaridades $> 0.92$
- Corte de relevância mínima em $0.30$ para evitar ruído no contexto
- Limite máximo de 3 memórias recuperadas injetadas no prompt
- Preservar integridade dos contratos de erro existentes (`400`, `422`, `504`)
- Nunca ler `.env` diretamente nem commitar credenciais (Princípio V da Constituição)

**Scale/Scope**: Módulo de geração de embeddings (`src/memory/embeddings.ts`), store de memórias SQLite (`src/memory/memory-store.ts`), extensão de parâmetros do endpoint `POST /chat` em `src/http/server.ts` e suíte de testes em `src/memory/memory-store.test.ts` e `src/http/server.test.ts`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Type-safe architecture and boundary validation**: PASS  
  Campo opcional `userId` validado na borda HTTP com `zod`. Tipos estritos (`MemoryRecord`, `EmbeddingVector`, `MemoryStore`) definidos sem `any`.
- **MVC and separation of responsibilities**: PASS  
  Geração de embeddings e persistência vetorial isoladas em `src/memory/` (camada de modelo/store). O controller `src/http/server.ts` orquestra a chamada de recall sem acoplamento a detalhes de tensores ou queries SQL.
- **Pure logic and explicit error handling**: PASS  
  Funções de normalização, similaridade de cossenos, produto escalar e serialização são puras em `src/memory/embeddings.ts`. Validações de entradas vazias disparam erros explícitos.
- **Test-first quality gates**: PASS  
  Testes automatizados cobrem recuperação sem palavras em comum, deduplicação $> 0.92$, corte $\ge 0.30$, isolamento entre usuários e injeção no prompt do chat, mantendo `npm test` e `npm run typecheck` 100% verdes.
- **Secure and operationally safe development**: PASS  
  Execução de embedding 100% local sem dependência de chaves de API externas. Nenhuma leitura direta de `.env`.

**Post-Design Re-check**: PASS. Os artefatos de pesquisa, modelo de dados e contratos respeitam integralmente todos os princípios da constituição.

## Project Structure

### Documentation (this feature)

```text
specs/008-memoria-semantica-chat/
├── plan.md              # Este arquivo (resultado do /speckit-plan)
├── research.md          # Decisões arquiteturais e resolução de incógnitas
├── data-model.md        # Entidades, schema SQL de memories e transições de estado
├── quickstart.md        # Guia de validação e execução ponta a ponta
├── contracts/
│   └── chat-semantic-memory-contract.md # Contrato HTTP do /chat e interface MemoryStore
├── checklists/
│   └── requirements.md  # Checklist de qualidade da especificação
└── tasks.md             # Tarefas de implementação (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── memory/
│   ├── embeddings.ts          # Lazy singleton do modelo all-MiniLM-L6-v2, pooling e similaridade
│   ├── memory-store.ts        # SqliteMemoryStore com remember, recall, forget e tabela memories
│   └── memory-store.test.ts   # Testes unitários de similaridade, dedup e isolamento
├── http/
│   ├── server.ts              # Endpoint /chat aceitando userId e injetando MEMORY no prompt
│   └── server.test.ts         # Testes de integração do endpoint /chat com contexto de memória
└── store/
    └── sqlite-conversation-store.ts # Histórico conversacional existente
```

**Structure Decision**: A feature encapsula a lógica de embeddings e persistência de memória em `src/memory/`, integrando-se suavemente ao controller HTTP existente em `src/http/server.ts`, com validação por testes unitários e de integração via `node --test` e `tsx`.

## Complexity Tracking

Nenhuma violação de constituição identificada; tabela de exceções não se aplica.
