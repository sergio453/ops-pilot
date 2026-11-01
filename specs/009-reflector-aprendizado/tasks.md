# Tasks: Reflector de Aprendizado e Esquecimento de Preferências

**Input**: Design documents from `/specs/009-reflector-aprendizado/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/learning-reflector-contract.md](./contracts/learning-reflector-contract.md)

**Tests**: Testes automatizados são obrigatórios conforme Princípio IV da Constituição e cenários de aceitação de [spec.md](./spec.md).

**Organization**: Tasks agrupadas por user story para permitir implementação e validação independentes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependência direta)
- **[Story]**: User story alvo (`[US1]`, `[US2]`, `[US3]`)
- Todos os itens incluem caminho exato de arquivo

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Preparar esquemas de validação Zod e interfaces de tipagem para reflexão estruturada e esquecimento de preferências.

- [ ] T001 [P] Definir `learningSchema` Zod e interfaces `LearningResult`, `LearningReflector` em `src/memory/learning-reflector.ts`
- [ ] T002 [P] Definir tipos e assinaturas para a tool `forget_preference` em `src/agents/tools.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implementar a lógica central de reflexão com `withStructuredOutput` e suporte a fakes que desbloqueia todas as user stories.

**⚠️ CRITICAL**: Nenhuma user story deve iniciar antes da conclusão desta fase.

- [ ] T003 Implementar `FakeLearningReflector` determinístico em `src/memory/learning-reflector.ts` para testes rápidos sem chamada externa de LLM
- [ ] T004 Implementar `LlmLearningReflector` em `src/memory/learning-reflector.ts` utilizando `model.withStructuredOutput(learningSchema)` e o prompt `REFLECTOR_SYSTEM_PROMPT`
- [ ] T005 Implementar método orquestrador `reflectAndRemember(userId, userMessage)` em `src/memory/learning-reflector.ts` com tratamento defensivo e chamada assíncrona a `memoryStore.remember`

**Checkpoint**: Fundação pronta - componentes de reflexão e schemas prontos para testes e integração.

---

## Phase 3: User Story 1 & 2 - Destilação assíncrona e filtragem de pedidos pontuais/segredos (Priority: P1 & P2) 🎯 MVP

**Goal**: Garantir que preferências duráveis sejam extraídas e enviadas para `memoryStore.remember`, enquanto comandos transitórios, saudações e segredos sejam descartados com `hasLearning: false`.

**Independent Test**: Invocar o reflector com mensagens simuladas:
- Preferência ("meu namespace é prod"): `hasLearning: true`, grava memória.
- Pedido pontual ("reinicie o pod auth"): `hasLearning: false`, não grava memória.
- Segredo/token ("minha senha é 1234"): `hasLearning: false`, não grava memória.

### Tests for User Story 1 & 2

- [ ] T006 [P] [US1] Criar testes unitários em `src/memory/learning-reflector.test.ts` validando a destilação de preferências duráveis e descarte de pedidos transitórios usando `FakeLearningReflector`
- [ ] T007 [P] [US2] Adicionar testes unitários em `src/memory/learning-reflector.test.ts` cobrindo o descarte estrito de segredos e credenciais, e tratamento defensivo caso o store lance exceções

### Implementation for User Story 1 & 2

- [ ] T008 [US1] Atualizar o handler de `POST /chat` em `src/http/server.ts` para disparar `learningReflector.reflectAndRemember(body.userId, body.message)` em background (assíncrono e não-bloqueante), após enviar o response HTTP
- [ ] T009 [US1] Remover a gravação cega direta `await memoryStore.remember(body.userId, body.message)` de `src/http/server.ts`, delegando exclusivamente para o reflector
- [ ] T010 [US1] Atualizar `ServerOptions` em `src/http/server.ts` para aceitar `createLearningReflector` opcional com fallback seguro

**Checkpoint**: User Stories 1 e 2 completas e testáveis de forma isolada no servidor HTTP.

---

## Phase 4: User Story 3 - Esquecimento direcionado via tool `forget_preference` (Priority: P3)

**Goal**: Disponibilizar a ferramenta `forget_preference` nas ferramentas do agente, permitindo a exclusão de memórias sob demanda com validação estrita de isolamento de usuário.

**Independent Test**: Invocar a ferramenta `forget_preference` com ID válido do usuário (sucesso) e com ID de outro usuário ou inválido (rejeição segura sem exclusão).

### Tests for User Story 3

- [ ] T011 [P] [US3] Adicionar testes unitários em `src/agents/tools.test.ts` para a ferramenta `forget_preference`, validando exclusão bem-sucedida e bloqueio contra usuários não autorizados
- [ ] T012 [P] [US3] Adicionar teste de integração garantindo que o agente tem acesso à tool `forget_preference` e pode executá-la durante o raciocínio

### Implementation for User Story 3

- [ ] T013 [US3] Implementar a função `createForgetPreferenceTool(memoryStore: MemoryStore, currentUserId?: string)` em `src/agents/tools.ts`
- [ ] T014 [US3] Incluir a tool `forget_preference` na lista de ferramentas retornada por `createAgentTools` em `src/agents/tools.ts`

**Checkpoint**: User Story 3 completa e ferramentas prontas.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Verificação final de regressões, testes integrados de ponta a ponta e checagem estrita de tipos.

- [ ] T015 [P] Atualizar `specs/009-reflector-aprendizado/quickstart.md` com exemplos e resultados de execução reais
- [ ] T016 Adicionar testes de integração no servidor HTTP em `src/http/server.test.ts` cobrindo o fluxo assíncrono de aprendizado em background sem latência na resposta
- [ ] T017 Executar suíte de testes focada: `npx tsx --test src/memory/learning-reflector.test.ts src/agents/tools.test.ts src/http/server.test.ts`
- [ ] T018 Executar checagem estrita de tipos com `npm run typecheck` e suíte completa com `npm test` garantindo conformidade com a Constituição
