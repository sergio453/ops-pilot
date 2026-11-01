# Tasks: Medição e instrumentação de tokens do contexto

**Input**: Design documents from `/specs/010-medicao-tokens-contexto/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/context-tokens-contract.md](./contracts/context-tokens-contract.md)

**Tests**: Testes automatizados são obrigatórios conforme Princípio IV da Constituição e cenários de aceitação de [spec.md](./spec.md).

**Organization**: Tasks agrupadas por user story para permitir implementação e validação independentes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependência direta)
- **[Story]**: User story alvo (`[US1]`, `[US2]`, `[US3]`)
- Todos os itens incluem caminho exato de arquivo

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Preparar estrutura de diretórios, interfaces de tipos e dependências compartilhadas para a instrumentação de tokens.

- [X] T001 Criar diretório `src/context/` e validar exportações no projeto
- [X] T002 [P] Definir tipos e interfaces `ContextBreakdown`, `ContextBreakdownInput` e `TokenUsageMetadata` em `src/context/tokens.ts` e estender `ReasoningMetrics` em `src/agents/types.ts` com `promptTokens?: number` e `contextBreakdown?: ContextBreakdown`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Funções puras de cálculo e decomposição de tokens que bloqueiam as user stories.

**⚠️ CRITICAL**: Nenhuma user story deve iniciar antes da conclusão desta fase.

- [X] T003 Implementar a função pura `estimateTokens(text: string): number` em `src/context/tokens.ts` calculando `Math.ceil(text.length / 4)` para strings não vazias e `0` para strings vazias
- [X] T004 [P] Implementar a função pura `calculateContextBreakdown(input: ContextBreakdownInput): ContextBreakdown` em `src/context/tokens.ts` calculando estimativas individuais para `memories`, `history`, `userMessage` e consolidando `totalEstimated`

**Checkpoint**: Fundação pronta - implementação de user stories pode iniciar de forma independente.

---

## Phase 3: User Story 1 - Medição e estimativa de tokens no contexto (Priority: P1) 🎯 MVP

**Goal**: Implementar medição heurística de tokens e extração do uso real de tokens reportado pelo LangChain.

**Independent Test**: Invocar `estimateTokens` com strings de teste conhecidas e validar `Math.ceil(chars / 4)`; invocar `extractPromptTokens` com mensagens simuladas do LangChain contendo `usage_metadata` e verificar a extração exata de `input_tokens`.

### Tests for User Story 1

- [X] T005 [P] [US1] Adicionar testes unitários em `src/context/tokens.test.ts` para `estimateTokens` cobrindo strings vazias, textos curtos, textos médios e arredondamentos para cima
- [X] T006 [P] [US1] Adicionar testes unitários em `src/context/tokens.test.ts` para `extractPromptTokens` cobrindo extração de `usage_metadata.input_tokens` e fallback para `estimateTokens(fallbackText)` quando metadados estiverem ausentes

### Implementation for User Story 1

- [X] T007 [US1] Implementar a função `extractPromptTokens(messages: unknown[], fallbackText?: string): number` em `src/context/tokens.ts` inspecionando mensagens `AIMessage` por `usage_metadata.input_tokens` com fallback para `estimateTokens(fallbackText)`
- [X] T008 [US1] Atualizar `ReactReasoningStrategy` em `src/agents/react.ts` para invocar `extractPromptTokens` sobre `result.messages` e incluir `promptTokens` no objeto `metrics` retornado

**Checkpoint**: User Story 1 (MVP) completa e testável de forma independente.

---

## Phase 4: User Story 2 - Métricas de contexto e breakdown por fontes no `/chat` (Priority: P2)

**Goal**: Expor `promptTokens` e `contextBreakdown` nas métricas retornadas pelo endpoint `POST /chat`.

**Independent Test**: Enviar requisições para `POST /chat` com e sem histórico/memórias, validando presença de `metrics.promptTokens` (inteiro $\ge 0$) e `metrics.contextBreakdown` contendo `memories`, `history`, `userMessage` e `totalEstimated`.

### Tests for User Story 2

- [X] T009 [P] [US2] Adicionar testes de integração em `src/http/server.test.ts` validando presença e estrutura de `metrics.promptTokens` e `metrics.contextBreakdown` na resposta HTTP 200 de `POST /chat`
- [X] T010 [P] [US2] Adicionar testes em `src/http/server.test.ts` validando que requisições contendo histórico e memórias populam corretamente as parcelas em `metrics.contextBreakdown`

### Implementation for User Story 2

- [X] T011 [US2] Integrar `calculateContextBreakdown` no fluxo de `POST /chat` em `src/http/server.ts`, decompondo memórias recuperadas, mensagens do histórico conversacional e mensagem atual do usuário
- [X] T012 [US2] Atualizar a serialização de resposta em `src/http/server.ts` para incluir `promptTokens` (real da estratégia ou fallback estimado) e `contextBreakdown` dentro de `metrics`, preservando `llCalls`, `latencyMs`, `historyMessages` e `memoryHits`

**Checkpoint**: User Story 2 completa e testável de forma independente junto à US1.

---

## Phase 5: User Story 3 - Rastreamento de tokens em conversa longa via script (Priority: P3)

**Goal**: Disponibilizar o script executável `conversa-longa.sh` que realiza múltiplos turnos sequenciais no `/chat` e imprime os `promptTokens` a cada turno.

**Independent Test**: Executar `./conversa-longa.sh` contra o servidor HTTP ativo e validar a exibição no terminal dos turnos e seus respectivos `promptTokens` em progressão crescente.

### Tests for User Story 3

- [X] T013 [P] [US3] Criar script executável `conversa-longa.sh` na raiz do projeto configurando chamadas HTTP sequenciais com `curl` para `POST /chat` mantendo o mesmo `conversationId` entre os turnos
- [X] T014 [US3] Implementar extração e formatação de saída no script `conversa-longa.sh` imprimindo `PromptTokens` e `ContextBreakdown` por turno, com tratamento defensivo e mensagem clara caso o servidor esteja indisponível

**Checkpoint**: Todas as user stories (US1, US2, US3) completas e funcionalmente integradas.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validação final de conformidade, integridade de tipos e cobertura total de testes.

- [X] T015 [P] Atualizar roteiro e evidências em `specs/010-medicao-tokens-contexto/quickstart.md`
- [X] T016 Executar suíte de testes focada `npm test -- src/context/tokens.test.ts src/http/server.test.ts`
- [X] T017 Executar verificação estrita de tipos com `npm run typecheck` e suíte completa com `npm test` garantindo conformidade com a Constituição
