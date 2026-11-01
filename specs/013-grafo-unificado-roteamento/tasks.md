# Tasks: Grafo Unificado de Produção com Roteamento Dinâmico e Trace Granular

**Input**: Design documents from `/specs/013-grafo-unificado-roteamento/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/production-graph-contract.md](./contracts/production-graph-contract.md)

**Tests**: Testes automatizados unitários e de integração são obrigatórios conforme Princípio IV da Constituição e cenários de aceitação de [spec.md](./spec.md).

**Organization**: Tasks agrupadas por user story para permitir implementação e validação independentes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependência direta)
- **[Story]**: User story alvo (`[US1]`, `[US2]`, `[US3]`, `[US4]`)
- Todos os itens incluem caminho exato de arquivo

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Preparar tipos e interfaces de dados para observabilidade estendida e identificadores de nós.

- [ ] T001 [P] Atualizar `src/agents/types.ts` adicionando o literal `"route"` à união `TraceEventType` e o atributo obrigatório `node: string` na interface `TraceEvent`
- [ ] T002 [P] Atualizar os formatadores de trace em `src/agents/trace.ts` para suportar a exibição de eventos do tipo `[ROUTE]` e a indicação do nó emissor (`node`) nos cabeçalhos de trace formatados

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Definir modelos, schemas Zod e infraestrutura de grafo que bloqueiam as histórias de usuário.

**⚠️ CRITICAL**: Nenhuma user story deve avançar sem os esquemas de roteamento e o contrato de estado do grafo definidos.

- [ ] T003 Definir os esquemas Zod e tipos do grafo em `src/agents/production-graph.ts`: tupla `ROUTE_NAMES = ["react", "plan-and-execute", "reflection"] as const`, tipo `RouteName`, schema `routerOutputSchema` e a interface `ProductionGraphState`
- [ ] T004 [P] Implementar funções utilitárias de normalização e enriquecimento de trace em `src/agents/production-graph.ts` para garantir que qualquer evento gerado receba o atributo `node` correto
- [ ] T005 [P] Ajustar declarações de tipos LangGraph em `src/types/langgraph.d.ts` caso necessário para suportar nós tipados e canais de agregação do `StateGraph` de produção

**Checkpoint**: Fundação pronta — tipos, contratos de estado e esquemas de validação disponíveis para os nós do grafo.

---

## Phase 3: User Story 1 - Execução do Grafo Unificado de Produção (Priority: P1) 🎯 MVP

**Goal**: Orquestrar o atendimento do OpsPilot de ponta a ponta via `StateGraph` contendo os nós `contexto`, `roteador`, as estratégias (`react`, `plan-and-execute`, `reflection`) e o nó final de `resposta`.

**Independent Test**: Executar o grafo compilado com dependências mockadas e verificar se a requisição transita sequencialmente por `contexto` -> `roteador` -> nó da estratégia -> `resposta`, retornando resposta e métricas válidas.

### Tests for User Story 1

- [ ] T006 [P] [US1] Criar testes unitários em `src/agents/production-graph.test.ts` cobrindo a execução end-to-end do grafo compilado com mocks, validando a passagem de estado entre os nós `contexto`, `roteador`, estratégias e `resposta`

### Implementation for User Story 1

- [ ] T007 [US1] Implementar o nó `contexto` em `src/agents/production-graph.ts` integrando com `buildContext`, recuperando histórico de conversas, memórias semânticas e resumo da sessão
- [ ] T008 [US1] Implementar os nós executores das três estratégias (`reactNode`, `planAndExecuteNode`, `reflectionNode`) em `src/agents/production-graph.ts`, acionando as respectivas instâncias e garantindo a devolução de deltas de estado e métricas
- [ ] T009 [US1] Implementar o nó de consolidação `resposta` em `src/agents/production-graph.ts`, formatando a resposta final, agregando métricas e verificando a integridade da lista de trace
- [ ] T010 [US1] Construir a topologia completa e compilar o `StateGraph` em `src/agents/production-graph.ts` conectando `START` -> `contexto` -> `roteador` -> conditional edges (para `react`, `plan-and-execute` e `reflection`) -> `resposta` -> `END`

**Checkpoint**: User Story 1 (MVP) completa e testável de forma isolada através do grafo compilado.

---

## Phase 4: User Story 2 - Roteamento Inteligente com Saída Estruturada e Tabela Decisória (Priority: P2)

**Goal**: O nó `roteador` avalia a mensagem com base na tabela descritiva contida no prompt e gera uma decisão estruturada `{ route, reason }`.

**Independent Test**: Submeter mensagens representativas de consulta direta, investigação multi-passo e incidentes críticos ao nó `roteador` e validar se a classificação e a justificativa obedecem à tabela de critérios.

### Tests for User Story 2

- [ ] T011 [P] [US2] Adicionar testes unitários em `src/agents/production-graph.test.ts` para o nó `roteador`, validando a classificação via saída estruturada e a atuação de fallback defensivo para `react` em caso de falha do modelo

### Implementation for User Story 2

- [ ] T012 [US2] Estruturar o prompt do sistema do roteador com a tabela de decisão definindo os cenários operacionais para `react`, `plan-and-execute` e `reflection` em `src/agents/production-graph.ts`
- [ ] T013 [US2] Implementar a lógica de inferência do nó `roteador` usando `createStructuredModel(routerOutputSchema)` e tratamento defensivo com fallback em `src/agents/production-graph.ts`

**Checkpoint**: User Stories 1 e 2 funcionais — roteamento dinâmico automático opera com saída estruturada.

---

## Phase 5: User Story 3 - Observabilidade Total com Evento `route` e Atribuição de `node` em Todo o Trace (Priority: P3)

**Goal**: Garantir que o nó roteador emita um evento de trace dedicado (`type: "route"`) e que 100% dos eventos na cadeia final contenham o atributo `node` preenchido.

**Independent Test**: Inspecionar os eventos retornados em múltiplos fluxos de teste e validar se o evento `route` foi emitido com `node: "roteador"` e se todos os demais eventos carregam o identificador do nó correto.

### Tests for User Story 3

- [ ] T014 [P] [US3] Adicionar testes em `src/agents/production-graph.test.ts` e `src/agents/trace.test.ts` assegurando que 100% dos eventos no trace possuem `node` preenchido e que eventos do tipo `route` são devidamente validados e formatados

### Implementation for User Story 3

- [ ] T015 [US3] Emitir o evento de trace `type: "route"` com `node: "roteador"` contendo a rota selecionada e a justificativa correspondente no nó `roteador` em `src/agents/production-graph.ts`
- [ ] T016 [US3] Implementar o enriquecimento automático no nó `resposta` e nos nós de estratégia em `src/agents/production-graph.ts` para normalizar eventos emitidos internamente com o identificador de seus respectivos nós

**Checkpoint**: User Stories 1, 2 e 3 integradas — observabilidade e auditoria granular ativas em todos os eventos.

---

## Phase 6: User Story 4 - Flexibilidade no `/chat` com `strategy` Opcional e Registro de Override (Priority: P4)

**Goal**: Endpoint `POST /chat` aceita `strategy` como opcional. Se ausente, delega ao roteador; se fornecido, aplica override imediato sem acionar classificador e registra a sobreposição no trace.

**Independent Test**: Executar requisições no endpoint `POST /chat` com e sem `strategy`, validando código 200, resposta correta e presença do trace de override quando aplicável.

### Tests for User Story 4

- [ ] T017 [P] [US4] Adicionar testes de integração em `src/http/server.test.ts` validando requisições `POST /chat` sem `strategy` (roteamento dinâmico) e com `strategy` (override explícito documentado no trace)

### Implementation for User Story 4

- [ ] T018 [US4] Atualizar o esquema de validação `requestSchema` em `src/http/server.ts` tornando o campo `strategy` opcional com tipo `z.enum(["react", "plan-and-execute", "reflection"]).optional()`
- [ ] T019 [US4] Implementar a verificação de override no nó `roteador` em `src/agents/production-graph.ts`, ignorando o classificador LLM, definindo a rota forçada e emitindo evento `route` com mensagem de override explícito
- [ ] T020 [US4] Integrar a execução do grafo unificado `productionGraph` no endpoint `POST /chat` em `src/http/server.ts`, substituindo a instanciação estática de estratégia

**Checkpoint**: Todas as 4 user stories integradas de ponta a ponta na API HTTP.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Testes de regressão, conformidade estrita de tipagem e validação prática.

- [ ] T021 [P] Executar testes de regressão dos módulos existentes (`src/arena.test.ts`, `src/agents/reflection.test.ts`, `src/context/builder.test.ts`) para garantir retrocompatibilidade com a base de código
- [ ] T022 [P] Executar checagem estrita de tipos com `npm run typecheck` e corrigir eventuais inconsistências em assinaturas de nós e estados
- [ ] T023 Validar os cenários práticos descritos em `quickstart.md` e executar a suíte completa de testes via `npm test`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependências — pode iniciar imediatamente.
- **Foundational (Phase 2)**: Depende da Fase 1 — BLOQUEIA todas as histórias de usuário.
- **User Story 1 (Phase 3)**: Depende da Fase 2 — Entrega o MVP do grafo unificado.
- **User Story 2 (Phase 4)**: Depende da Fase 3 — Adiciona a tabela e saída estruturada no nó roteador.
- **User Story 3 (Phase 5)**: Depende da Fase 3 e 4 — Assegura auditoria total com evento `route` e campo `node`.
- **User Story 4 (Phase 6)**: Depende das Fases 3, 4 e 5 — Expõe o grafo no `/chat` com suporte a override.
- **Polish (Phase 7)**: Depende da conclusão de todas as histórias.

### User Story Dependencies

- **US1 (P1)**: Autônoma após Foundational (estrutura base do grafo e nós).
- **US2 (P2)**: Refina o nó roteador criado na US1.
- **US3 (P3)**: Adiciona garantias de rastreabilidade transversal sobre os nós da US1 e US2.
- **US4 (P4)**: Integra o grafo concluído da US1/US2/US3 à camada HTTP.

### Parallel Opportunities

- `T001` e `T002` (Fase 1) podem ser executadas em paralelo.
- `T004` e `T005` (Fase 2) podem ser executadas em paralelo após `T003`.
- Testes `T006`, `T011`, `T014`, `T017` podem ser desenvolvidos em paralelo aos seus respectivos componentes.
- `T021` e `T022` (Fase 7) rodam em paralelo.

---

## Parallel Example: User Story 1

```bash
# Testes e nós iniciais de estratégia podem ser criados em paralelo:
Task: "T006 [P] [US1] Criar testes unitários em src/agents/production-graph.test.ts"
Task: "T007 [US1] Implementar o nó contexto em src/agents/production-graph.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Concluir Fase 1 (Setup de tipos de trace)
2. Concluir Fase 2 (Foundational: contratos de estado e esquemas)
3. Concluir Fase 3 (User Story 1: nós e grafo compilado)
4. **VALIDAR**: Executar `src/agents/production-graph.test.ts` para comprovar transição de nós e execução de estratégias no MVP.

### Incremental Delivery

1. Setup + Foundational -> Estrutura base pronta.
2. US1 -> Grafo unificado funcional (MVP).
3. US2 -> Roteador inteligente com tabela de decisão estruturada.
4. US3 -> Observabilidade com `route` e campo `node` em todo o trace.
5. US4 -> Exposição no `/chat` com override opcional.
6. Polish -> Checagem de tipos estrita e suíte `npm test` 100% verde.

