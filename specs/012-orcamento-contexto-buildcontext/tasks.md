# Tasks: Construção de Contexto com Orçamento por Seção (`buildContext`)

**Input**: Design documents from `/specs/012-orcamento-contexto-buildcontext/`

## Phase 1: Setup & Data Structures
- [X] T001 Criar tipos e interfaces (`ContextSection`, `SectionBudget`, `CutPolicy`, `BuildContext`, `BuildContextBreakdown`, `BuildInput`) em `src/context/builder.ts`

## Phase 2: Foundational & Pure Functions
- [X] T002 Implementar `section(...)` e `fitToBudget(...)` com regras `"never"`, `"oldest-first"` e `"lowest-score-first"` em `src/context/builder.ts`
- [X] T003 Implementar `assemble(...)` e `buildContext(...)` em `src/context/builder.ts`
- [X] T004 Criar testes unitários em `src/context/builder.test.ts` cobrindo todas as políticas de corte e montagem de breakdown

## Phase 3: Integration
- [X] T005 Adicionar método `summaryOf(conversationId)` no `SqliteConversationStore` em `src/store/sqlite-conversation-store.ts`
- [X] T006 Integrar `buildContext` no endpoint `POST /chat` em `src/http/server.ts`
- [X] T007 Atualizar e executar testes de integração em `src/http/server.test.ts`

## Phase 4: Polish & Quality
- [X] T008 Executar `npm run typecheck` e suíte completa de testes
