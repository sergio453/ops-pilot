# Tasks: Memória semântica por usuário no chat

**Input**: Design documents from `/specs/008-memoria-semantica-chat/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/chat-semantic-memory-contract.md](./contracts/chat-semantic-memory-contract.md)

**Tests**: Testes automatizados são obrigatórios nesta feature conforme Princípio IV da Constituição e cenários de aceitação de [spec.md](./spec.md).

**Organization**: Tasks agrupadas por user story para permitir implementação e validação independentes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependência direta)
- **[Story]**: User story alvo (`[US1]`, `[US2]`, `[US3]`)
- Todos os itens incluem caminho exato de arquivo

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Preparar estrutura mínima de componentes, dependências e interfaces de tipos para o módulo de memória semântica.

- [X] T001 Validar dependência `@huggingface/transformers` em `package.json` e configuração de execução para modelos locais de embeddings
- [X] T002 [P] Definir tipos e interfaces `EmbeddingVector`, `EmbeddingGenerator`, `MemoryRecord`, `MemoryStore` e `MemoryStoreOptions` em `src/memory/embeddings.ts` e `src/memory/memory-store.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infraestrutura básica de tensores vetoriais e persistência SQLite que bloqueia todas as user stories.

**⚠️ CRITICAL**: Nenhuma user story deve iniciar antes da conclusão desta fase.

- [X] T003 Implementar funções puras de manipulação vetorial em `src/memory/embeddings.ts`: `normalizeEmbedding` com norma L2 = 1.0, `dotProduct`, `cosineSimilarity`, `serializeEmbedding` serializando `Float32Array` em Buffer little-endian de 1536 bytes (384 dimensões), e `deserializeEmbedding`
- [X] T004 [P] Implementar gerador de embeddings local em `src/memory/embeddings.ts` com lazy singleton usando `sentence-transformers/all-MiniLM-L6-v2` (`mean_pooling`, normalização de tensores e fallback determinístico de 384 dimensões para testes offline)
- [X] T005 [P] Implementar inicialização da tabela `memories` e índices no SQLite em `src/memory/memory-store.ts`: colunas `id` (TEXT, PRIMARY KEY), `user_id` (TEXT, NOT NULL), `fact` (TEXT, NOT NULL), `embedding` (BLOB, NOT NULL), `created_at` (TEXT, NOT NULL) e índice `idx_memories_user_created` em `(user_id, created_at DESC)`
- [X] T006 Implementar validações de restrições de domínio e mapeamento de tuplas SQLite em `src/memory/memory-store.ts`: `user_id` não pode ser vazio após normalização (`trim()`), `fact` não pode ser vazio após normalização (`trim()`), e `embedding` deve ser um vetor não vazio normalizado com norma $L_2 = 1.0$

**Checkpoint**: Fundação pronta - implementação de user stories pode iniciar de forma independente.

---

## Phase 3: User Story 1 - Relembrar fatos relevantes no chat (Priority: P1) 🎯 MVP

**Goal**: Recuperar memórias relevantes do usuário no momento da conversa para gerar respostas contextualizadas no chat, mesmo quando a pergunta não repete as mesmas palavras do fato salvo.

**Independent Test**: Salvar fato textual para um usuário e realizar pergunta semanticamente equivalente com vocabulário diferente via `recall(userId, query, 3)`, validando retorno do fato (score $\ge 0.30$) e injeção do prefixo `MEMORY: <fato>` no prompt do endpoint `POST /chat`.

### Tests for User Story 1

- [X] T007 [P] [US1] Adicionar testes unitários em `src/memory/memory-store.test.ts` validando recuperação semântica `recall` de fatos relevantes sem palavras em comum, corte mínimo de similaridade $\ge 0.30$, ordenação decrescente por relevância e limite máximo de 3 memórias
- [X] T008 [P] [US1] Adicionar testes de integração em `src/http/server.test.ts` validando injeção de contexto `MEMORY: <fato>` no topo do prompt de `POST /chat` antes de `USER:`/`ASSISTANT:` e incremento de `metrics.memoryHits` quando `userId` for informado

### Implementation for User Story 1

- [X] T009 [US1] Implementar método `recall(userId: string, query: string, limit = 3)` em `src/memory/memory-store.ts` carregando memórias escopadas por `user_id`, calculando produto escalar/cosseno com o embedding da consulta, filtrando por score $\ge 0.30$, ordenando decrescente e limitando em até `limit` registros
- [X] T010 [US1] Atualizar schema de validação Zod da requisição em `src/http/server.ts` para aceitar `userId` opcional como string não vazia após `trim()`
- [X] T011 [US1] Integrar recuperação contextual no endpoint `POST /chat` em `src/http/server.ts`, invocando `memoryStore.recall(userId, message, 3)`, compondo prompt com prefixos `MEMORY: <fato>` e expondo contagem em `metrics.memoryHits`

**Checkpoint**: User Story 1 (MVP) completa e testável de forma independente.

---

## Phase 4: User Story 2 - Evitar duplicidade de memórias (Priority: P2)

**Goal**: Evitar registros duplicados de fatos semanticamente equivalentes para manter uma memória limpa e útil por usuário.

**Independent Test**: Invocar `remember` duas vezes com fatos de similaridade $\ge 0.92$ para o mesmo usuário e validar que o segundo retorno reaproveita o registro original sem duplicar linhas em `memories`; para usuários distintos, ambos mantêm registros independentes.

### Tests for User Story 2

- [X] T012 [P] [US2] Adicionar teste unitário em `src/memory/memory-store.test.ts` validando regra de deduplicação semântica no `remember`: quando `cosineSimilarity(novo_embedding, existente) >= 0.92` para o mesmo `user_id`, a inserção é evitada e o registro existente é retornado
- [X] T013 [P] [US2] Adicionar teste unitário em `src/memory/memory-store.test.ts` validando isolamento estrito entre usuários: fatos similares cadastrados para `user-A` e `user-B` não são deduplicados entre si

### Implementation for User Story 2

- [X] T014 [US2] Implementar método `remember(userId: string, fact: string)` em `src/memory/memory-store.ts` gerando embedding vetorial normalizado ($L_2 = 1.0$), calculando similaridade contra memórias existentes do `userId`, evitando inserção quando similaridade $\ge 0.92$ e persistindo novo registro em `memories` com `id` UUID v4 e `created_at` ISO-8601 UTC
- [X] T015 [US2] Integrar persistência automática da mensagem do usuário em `src/http/server.ts` via `memoryStore.remember(userId, message)` durante o fluxo de `POST /chat` quando `userId` estiver presente

**Checkpoint**: User Story 2 completa e testável de forma independente junto à US1.

---

## Phase 5: User Story 3 - Esquecer memórias específicas (Priority: P3)

**Goal**: Remover um fato específico da memória de um usuário pelo identificador, garantindo que não apareça em recuperações futuras e protegendo contra remoção de memórias de outros usuários.

**Independent Test**: Criar fato com `remember`, deletar via `forget(userId, memoryId)`, verificar retorno `true` e ausência em `recall`; tentar deletar com outro `userId` e verificar retorno `false` sem alterar dados.

### Tests for User Story 3

- [X] T016 [P] [US3] Adicionar teste unitário em `src/memory/memory-store.test.ts` validando `forget(userId, memoryId)` com remoção definitiva do registro e comportamento ao tentar remover identificador inexistente
- [X] T017 [P] [US3] Adicionar teste unitário em `src/memory/memory-store.test.ts` garantindo que tentativa de esquecer memória pertencente a outro `userId` retorna `false` e não deleta o registro

### Implementation for User Story 3

- [X] T018 [US3] Implementar método `forget(userId: string, memoryId: string)` em `src/memory/memory-store.ts` validando `userId` e `memoryId`, executando `DELETE FROM memories WHERE id = ? AND user_id = ?` e retornando `true` se ao menos uma linha foi afetada ou `false` caso contrário

**Checkpoint**: Todas as user stories (US1, US2, US3) completas e funcionalmente integradas.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validação final de conformidade, cobertura de testes e integridade de tipos em toda a aplicação.

- [X] T019 [P] Atualizar documentação de contrato e roteiro de validação em `specs/008-memoria-semantica-chat/quickstart.md`
- [X] T020 Executar testes focados do subsistema de memória e chat via `npm test -- src/memory/memory-store.test.ts src/http/server.test.ts` e registrar resultados
- [X] T021 Executar validação estrita de tipos com `npm run typecheck` e suíte completa de testes com `npm test` garantindo conformidade com a Constituição

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Sem dependências - pode iniciar imediatamente
- **Phase 2 (Foundational)**: Depende da Phase 1 (Setup) - BLOQUEIA todas as user stories
- **Phase 3 (US1 - Relembrar fatos)**: Depende da Phase 2 (Foundational) - constitui o MVP
- **Phase 4 (US2 - Deduplicação)**: Depende da Phase 2 (Foundational); estende `remember` no store
- **Phase 5 (US3 - Esquecimento)**: Depende da Phase 2 (Foundational); estende `forget` no store
- **Phase 6 (Polish)**: Depende da conclusão de todas as user stories planejadas

### User Story Dependencies

- **User Story 1 (P1)**: Inicia imediatamente após a fase Foundational. Não depende de US2 nem US3.
- **User Story 2 (P2)**: Inicia após a fase Foundational. Complementa o ciclo de armazenamento do `remember`, mantendo isolamento por `userId`.
- **User Story 3 (P3)**: Inicia após a fase Foundational. Opera sobre `memories` via `forget`, independente de US1 e US2.

### Within Each User Story

- Testes devem ser escritos e validados antes da implementação
- Modelos e operações de persistência antes de integração com endpoints HTTP
- Validação independente de cada história antes de avançar para a próxima prioridade

---

## Parallel Opportunities

- **Setup**: T002 pode rodar em paralelo com T001
- **Foundational**: T004 e T005 podem rodar em paralelo após T003
- **User Story 1**: T007 e T008 podem rodar em paralelo antes de T009/T010/T011
- **User Story 2**: T012 e T013 podem rodar em paralelo antes de T014/T015
- **User Story 3**: T016 e T017 podem rodar em paralelo antes de T018
- **Polish**: T019 pode rodar em paralelo com a preparação de execução de testes

---

## Parallel Example: User Story 1

```bash
# Executar testes unitários e de integração em paralelo (se ambiente suportar):
npm test -- src/memory/memory-store.test.ts
npm test -- src/http/server.test.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Concluir Phase 1: Setup
2. Concluir Phase 2: Foundational (requisito bloqueante)
3. Concluir Phase 3: User Story 1
4. **Validar MVP**: Executar testes de `recall` e injeção contextual de memória no `POST /chat`

### Incremental Delivery

1. Setup + Foundational -> Estrutura base de dados e tensores pronta
2. User Story 1 -> Recuperação de contexto e injeção no prompt (MVP entregue)
3. User Story 2 -> Deduplicação semântica automática no armazenamento
4. User Story 3 -> Controle e limpeza de dados via esquecimento
5. Polish -> Documentação e validação de qualidade dos gates da Constituição

### Parallel Team Strategy

- **Dev 1**: Responsável pelo motor de embeddings e persistência (`src/memory/`)
- **Dev 2**: Responsável pela integração HTTP e composição de prompt (`src/http/server.ts`)
- Sincronização nos checkpoints de cada User Story

