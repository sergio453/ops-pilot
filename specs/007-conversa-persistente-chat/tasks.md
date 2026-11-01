# Tasks: Conversa persistente no chat

**Input**: Design documents from `/specs/007-conversa-persistente-chat/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/chat-conversation-contract.md](./contracts/chat-conversation-contract.md)

**Tests**: Testes são obrigatórios nesta feature (requisito explícito na spec e no contrato).

**Organization**: Tasks agrupadas por user story para permitir implementação e validação independentes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependência direta)
- **[Story]**: User story alvo (`[US1]`, `[US2]`, `[US3]`)
- Todos os itens incluem caminho exato de arquivo

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Preparar estrutura mínima de artefatos e alinhamento de tipos para a feature.

- [X] T001 Atualizar referência de feature ativa em `.specify/feature.json` para `specs/007-conversa-persistente-chat`
- [X] T002 [P] Revisar e alinhar contrato de resposta em `src/agents/types.ts` para incluir `metrics.historyMessages` opcional

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infraestrutura base de persistência e composição que bloqueia todas as user stories.

**⚠️ CRITICAL**: Nenhuma user story deve iniciar antes desta fase.

- [X] T003 Criar store de conversa SQLite em `src/store/sqlite-conversation-store.ts` com entidades `Conversation (id, created_at)` e `ConversationMessage (id, conversation_id, role, content, created_at)`
- [X] T004 Implementar constraints de domínio em `src/store/sqlite-conversation-store.ts`: `conversation_id` referencial, `role` restrito a `user|assistant`, `content` não vazio, `created_at` obrigatório
- [X] T005 [P] Implementar operações `create`, `append`, `lastMessages` em `src/store/sqlite-conversation-store.ts`, incluindo normalização de `conversationId` não vazio
- [X] T006 [P] Implementar composição de histórico cronológico (limite 12) em `src/http/server.ts` com formato textual `USER:`/`ASSISTANT:`

**Checkpoint**: Fundamentos prontos para implementar user stories de forma independente.

---

## Phase 3: User Story 1 - Continuar uma conversa existente (Priority: P1) 🎯 MVP

**Goal**: Reutilizar `conversationId` existente para manter contexto de conversa entre chamadas.

**Independent Test**: Enviar duas chamadas com mesmo `conversationId` e validar que a segunda usa histórico anterior no prompt.

### Tests for User Story 1

- [X] T007 [P] [US1] Adicionar teste de continuidade conversacional em `src/http/server.test.ts` validando composição cronológica no prompt
- [X] T008 [P] [US1] Adicionar teste em `src/http/server.test.ts` garantindo persistência apenas de mensagem do usuário e resposta final do assistente

### Implementation for User Story 1

- [X] T009 [US1] Integrar `ConversationStore` no fluxo de `POST /chat` em `src/http/server.ts` para carregar as últimas 12 mensagens da conversa corrente
- [X] T010 [US1] Persistir mensagens do ciclo bem-sucedido em `src/http/server.ts` (`user` antes de `assistant`) sem alterar contratos de erro existentes

**Checkpoint**: US1 funcional e validável isoladamente.

---

## Phase 4: User Story 2 - Iniciar conversa sem identificador prévio (Priority: P2)

**Goal**: Criar conversa automaticamente quando `conversationId` não vier ou não existir.

**Independent Test**: Enviar requisição sem `conversationId` e outra com `conversationId` inexistente, validando criação e retorno do ID.

### Tests for User Story 2

- [X] T011 [P] [US2] Adicionar teste em `src/http/server.test.ts` para geração automática de `conversationId` quando o campo estiver ausente
- [X] T012 [P] [US2] Adicionar teste em `src/http/server.test.ts` para criação com `conversationId` informado inexistente (sem 404/422)

### Implementation for User Story 2

- [X] T013 [US2] Atualizar schema de request em `src/http/server.ts` para aceitar `conversationId` opcional não vazio
- [X] T014 [US2] Implementar resolução/criação de conversa em `src/http/server.ts` (gerar ID quando ausente e criar conversa quando ID não existir)
- [X] T015 [US2] Incluir `conversationId` em respostas `200` em `src/http/server.ts`

**Checkpoint**: US2 funcional e validável isoladamente.

---

## Phase 5: User Story 3 - Observar uso de histórico na resposta (Priority: P3)

**Goal**: Expor observabilidade de contexto com `metrics.historyMessages`.

**Independent Test**: Validar `historyMessages=0` na primeira mensagem e valor > 0 quando já existir histórico.

### Tests for User Story 3

- [X] T016 [P] [US3] Adicionar teste em `src/http/server.test.ts` validando `metrics.historyMessages = 0` para conversa sem histórico
- [X] T017 [P] [US3] Adicionar teste em `src/http/server.test.ts` validando contagem correta de `metrics.historyMessages` para conversa com histórico

### Implementation for User Story 3

- [X] T018 [US3] Atualizar serialização da resposta em `src/http/server.ts` para incluir `metrics.historyMessages` com base na quantidade efetivamente usada
- [X] T019 [US3] Garantir limite de 12 mensagens para cálculo de histórico em `src/store/sqlite-conversation-store.ts` e uso em `src/http/server.ts`

**Checkpoint**: US3 funcional e validável isoladamente.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Fechamento da feature com validação completa e documentação final.

- [X] T020 [P] Atualizar documentação funcional em `specs/003-chat-endpoint/spec.md` para refletir `conversationId` e `historyMessages`
- [X] T021 Executar testes focados `npm test -- src/http/server.test.ts src/store/sqlite-conversation-store.test.ts` e registrar evidência no `specs/007-conversa-persistente-chat/quickstart.md`
- [X] T022 Executar validação final de tipos com `npm run typecheck`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: sem dependências
- **Phase 2 (Foundational)**: depende da Phase 1 e bloqueia user stories
- **Phase 3 (US1)**: depende da Phase 2
- **Phase 4 (US2)**: depende da Phase 2 (pode ocorrer em paralelo com US1, mas prioridade menor)
- **Phase 5 (US3)**: depende da Phase 2 e da instrumentação de resposta da US1/US2
- **Phase 6 (Polish)**: depende das user stories selecionadas concluídas

### User Story Dependencies

- **US1 (P1)**: inicia após Foundational; sem dependência funcional de outras stories
- **US2 (P2)**: inicia após Foundational; integra no mesmo endpoint, mas é testável isoladamente
- **US3 (P3)**: inicia após Foundational; depende da resposta já conter estrutura de métricas

### Within Each User Story

- Testes devem falhar antes da implementação correspondente
- Ajustes de schema/contrato antes de persistência e retorno
- Persistência e composição antes da validação final de integração

---

## Parallel Opportunities

- **Setup**: T002 paralelo a T001
- **Foundational**: T005 e T006 paralelos após T003/T004
- **US1**: T007 e T008 em paralelo
- **US2**: T011 e T012 em paralelo
- **US3**: T016 e T017 em paralelo
- **Polish**: T020 pode rodar em paralelo com T021, antes de T022

---

## Parallel Example: User Story 2

```bash
Task: "T011 [US2] Adicionar teste em src/http/server.test.ts para geração automática de conversationId"
Task: "T012 [US2] Adicionar teste em src/http/server.test.ts para criação com conversationId inexistente"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1
2. Completar Phase 2 (bloqueante)
3. Completar Phase 3 (US1)
4. Validar US1 isoladamente com testes focados

### Incremental Delivery

1. Entregar MVP com US1
2. Adicionar US2 para fluxo de criação automática de conversa
3. Adicionar US3 para observabilidade via `historyMessages`
4. Executar Polish com documentação e validação final
