# Tasks: Sumarização de Histórico Conversacional (Pruning)

**Input**: Design documents from `/specs/011-sumarizacao-historico-pruning/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/summarizer-contract.md](./contracts/summarizer-contract.md)

**Tests**: Testes automatizados são obrigatórios conforme Princípio IV da Constituição e cenários de aceitação de [spec.md](./spec.md).

**Organization**: Tasks agrupadas por user story para permitir implementação e validação independentes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependência direta)
- **[Story]**: User story alvo (`[US1]`, `[US2]`, `[US3]`)
- Todos os itens incluem caminho exato de arquivo

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Preparar tipos e interfaces de dados para resumos de conversa e eventos de sumarização.

- [X] T001 [P] Definir interfaces `ConversationSummaryRecord`, `ConversationMessageWithId` e `SummarizeEventPayload` em `src/store/sqlite-conversation-store.ts`
- [X] T002 [P] Definir contratos `SummarizerInput` e `ConversationSummarizer` em `src/conversation/summarizer.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Esquema SQLite para `conversation_summaries` e operações de persistência que bloqueiam todas as histórias.

**⚠️ CRITICAL**: Nenhuma user story deve avançar sem a tabela e métodos do store prontos.

- [X] T003 Criar DDL da tabela `conversation_summaries` com colunas `conversation_id`, `summary`, `last_summarized_message_id`, `created_at` e `updated_at` no construtor de `SqliteConversationStore` em `src/store/sqlite-conversation-store.ts`
- [X] T004 Implementar métodos `getSummary(conversationId)` e `saveSummary(input)` em `SqliteConversationStore` em `src/store/sqlite-conversation-store.ts`
- [X] T005 Implementar método `getUnsummarizedPrunedMessages(conversationId, recentLimit)` em `src/store/sqlite-conversation-store.ts` para identificar mensagens antigas fora da janela recente que ainda não foram sumarizadas
- [X] T006 Ajustar a janela padrão de mensagens recentes para 8 (`maxHistoryMessages = 8`) em `src/store/sqlite-conversation-store.ts`

**Checkpoint**: Fundação pronta - camada de armazenamento e janelamento disponível para os serviços e endpoints.

---

## Phase 3: User Story 1 - Persistência e gerenciamento de resumo de conversa (Priority: P1) 🎯 MVP

**Goal**: Garantir gravação, atualização e recuperação íntegras de resumos associados às conversas no SQLite.

**Independent Test**: Testes unitários no `SqliteConversationStore` validando criação e atualização idempotente do resumo, recuperação para conversas existentes e retorno `null` para conversas novas sem resumo.

### Tests for User Story 1

- [X] T007 [P] [US1] Adicionar testes em `src/store/sqlite-conversation-store.test.ts` cobrindo retorno `null` para conversa sem resumo e persistência/recuperação correta de `ConversationSummaryRecord`
- [X] T008 [P] [US1] Adicionar testes em `src/store/sqlite-conversation-store.test.ts` validando a consulta de mensagens podadas (`getUnsummarizedPrunedMessages`) conforme mensagens são adicionadas além da janela recente de 8

### Implementation for User Story 1

- [X] T009 [US1] Finalizar validações defensivas e tratamento de concorrência/UPSERT no método `saveSummary` em `src/store/sqlite-conversation-store.ts`

**Checkpoint**: User Story 1 completa e testável de forma isolada.

---

## Phase 4: User Story 2 - Gatilho de sumarização em lote e evento "summarize" (Priority: P2)

**Goal**: Implementar o orquestrador `maybeSummarizeConversation` que só dispara a sumarização em múltiplos de 8 mensagens que saíram da janela recente, gerando o resumo consolidado (~150 tokens) e emitindo o evento `"summarize"`.

**Independent Test**: Simular sequências de turnos usando `FakeConversationSummarizer`:
- 1 a 15 mensagens: 0 emissões de `"summarize"`.
- 16ª mensagem: exatamente 1 emissão de `"summarize"` e novo resumo persistido.
- 17 a 23 mensagens: 0 novas emissões.
- 24ª mensagem: 2ª emissão de `"summarize"` mesclando o resumo anterior com o novo lote de 8 mensagens.

### Tests for User Story 2

- [X] T010 [P] [US2] Criar `src/conversation/summarizer.test.ts` testando `FakeConversationSummarizer` e `maybeSummarizeConversation`, validando a regra do lote de 8 e a não execução a cada request
- [X] T011 [P] [US2] Adicionar teste validando que o evento `"summarize"` é emitido no `EventEmitter` com o payload exato contendo `conversationId`, `previousSummary`, `messagesSummarized` e `newSummary`

### Implementation for User Story 2

- [X] T012 [US2] Implementar `FakeConversationSummarizer` determinístico para testes em `src/conversation/summarizer.ts`
- [X] T013 [US2] Implementar `LlmConversationSummarizer` em `src/conversation/summarizer.ts` instruindo a condensação em ~150 tokens com foco estrito em decisões, fatos operacionais e pendências, mesclando com o resumo prévio
- [X] T014 [US2] Implementar a função `maybeSummarizeConversation` em `src/conversation/summarizer.ts` orquestrando: busca de mensagens podadas $\ge 8$, invocação do sumarizador, persistência via `saveSummary` e emissão do evento `"summarize"`

**Checkpoint**: User Story 2 completa e testada independentemente com fake sumarizer.

---

## Phase 5: User Story 3 - Injeção do Resumo no Contexto do Prompt (Priority: P3)

**Goal**: Integrar a sumarização no ciclo de vida de `POST /chat` em `src/http/server.ts`, injetando a linha `SUMMARY: <texto>` no prompt quando existir resumo para a conversa.

**Independent Test**: Executar requisições no servidor HTTP em teste:
- Conversa nova: prompt sem linha `SUMMARY:`.
- Conversa com resumo prévio (após 16 mensagens): prompt contendo `SUMMARY: ...` seguido das memórias e das 8 mensagens recentes.

### Tests for User Story 3

- [X] T015 [P] [US3] Adicionar testes de integração em `src/http/server.test.ts` verificando que a linha `SUMMARY:` aparece no prompt quando o resumo existe no store
- [X] T016 [P] [US3] Adicionar teste de integração em `src/http/server.test.ts` enviando 16 mensagens com `FakeConversationSummarizer` e capturando o evento `"summarize"` disparado pelo servidor

### Implementation for User Story 3

- [X] T017 [US3] Atualizar `ServerOptions` e `createApp` em `src/http/server.ts` para receber opcionalmente `summarizer` e `eventEmitter` (com fallback seguro para padrão)
- [X] T018 [US3] Atualizar `composePrompt` em `src/http/server.ts` para incluir `SUMMARY: ${summary}` no topo do bloco de contexto quando fornecido
- [X] T019 [US3] Integrar a chamada a `maybeSummarizeConversation` após a gravação da mensagem no fluxo do endpoint `POST /chat` em `src/http/server.ts`

**Checkpoint**: Todas as 3 user stories integradas e funcionais.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verificação final de regressões, types e conformidade com a Constituição.

- [X] T020 Atualizar evidências e guia em `specs/011-sumarizacao-historico-pruning/quickstart.md`
- [X] T021 Executar suíte de testes focada: `npx tsx --test src/store/sqlite-conversation-store.test.ts src/conversation/summarizer.test.ts src/http/server.test.ts`
- [X] T022 Executar checagem estrita de tipos com `npm run typecheck` e garantir aprovação de 100% dos testes da suíte completa com `npm test`
