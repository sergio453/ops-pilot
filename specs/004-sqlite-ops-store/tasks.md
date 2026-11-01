# Tasks: Persistência real de operações

**Input**: Design documents from `/specs/004-sqlite-ops-store/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ops-tools.md, quickstart.md

**Tests**: Incluídos porque a spec exige validação objetiva de comportamento e manutenção de suite verde.

**Organization**: Tasks agrupadas por user story para permitir implementação e validação independentes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependência direta)
- **[Story]**: User story alvo (`[US1]`, `[US2]`, `[US3]`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Ajustes iniciais de configuração e estrutura para persistência local.

- [X] T001 Atualizar baseline de persistência e convenções em .specify/memory/constitution.md
- [X] T002 Adicionar persistência local ao ignore em .gitignore (incluir `data/`)
- [X] T003 [P] Definir diretório de store em src/store/ e confirmar convenção de importação em src/store/sqlite-ops-store.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infraestrutura e contratos base que bloqueiam todas as histórias.

**⚠️ CRITICAL**: Nenhuma user story começa antes desta fase.

- [X] T004 Criar interface de store operacional e tipos compartilhados em src/agents/tools.ts
- [X] T005 [P] Criar erros de domínio explícitos para serviço, incidente e runbook em src/agents/errors.ts
- [X] T006 Implementar SqliteOpsStore com DDL idempotente para `services`, `alerts`, `incidents`, `runbooks` em src/store/sqlite-ops-store.ts
- [X] T007 Implementar constraints de domínio em src/store/sqlite-ops-store.ts citando regras: Service `id obrigatório e único`, `name obrigatório`, `tier obrigatório e restrito a domínio fechado`; Alert `id obrigatório e único`, `service deve referenciar serviço existente`, `severity obrigatório e restrito a domínio fechado`, `status obrigatório e restrito a domínio fechado (firing ou resolved)`; Incident `id obrigatório e único com sequência previsível`, `title obrigatório`, `service deve referenciar serviço existente`, `severity obrigatório e restrito a domínio fechado`, `status obrigatório e restrito a domínio fechado (open ou resolved)`, `resolved_at é nulo enquanto status=open e preenchido quando status=resolved`; Runbook `service obrigatório e único por runbook`, `content obrigatório e não vazio`
- [X] T008 Implementar seed idempotente Mercadinho (5 serviços, 6 alertas, runbooks checkout/payments/auth) em src/store/sqlite-ops-store.ts e src/agents/story-seed.json
- [X] T009 [P] Garantir queries parametrizadas/prepared statements em todas as operações de src/store/sqlite-ops-store.ts
- [X] T010 Integrar escolha de store na composição principal em src/agents/react.ts, src/agents/plan-and-execute.ts, src/arena.ts e src/index.ts
- [X] T011 [P] Preservar cenários determinísticos em memória para benchmark em src/bench.ts e src/agents/tools.ts

**Checkpoint**: Fundação pronta para implementação das histórias de usuário.

---

## Phase 3: User Story 1 - Operar plantão com estado persistente (Priority: P1) 🎯 MVP

**Goal**: Persistir ciclo operacional de alertas/incidentes com paridade funcional no fluxo principal.

**Independent Test**: Executar ciclo abrir/listar/resolver e comprovar consistência de estado na mesma base.

### Tests for User Story 1

- [X] T012 [P] [US1] Adicionar teste de seed e listagem base em memória e persistência em src/agents/tools.test.ts
- [X] T013 [P] [US1] Adicionar teste do fluxo abrir/listar/resolver incidente com validação de `status` e `resolvedAt` em src/agents/tools.test.ts
- [X] T014 [US1] Adicionar teste de erro de domínio para serviço inexistente ao abrir incidente em src/agents/tools.test.ts

### Implementation for User Story 1

- [X] T015 [US1] Implementar `openIncident` persistente com ID sequencial e `resolvedAt=null` em src/store/sqlite-ops-store.ts
- [X] T016 [US1] Implementar `resolveIncidentById` com transição `open -> resolved` e comportamento idempotente `resolved -> resolved` em src/store/sqlite-ops-store.ts
- [X] T017 [US1] Garantir paridade da tool `list_alerts` e compatibilidade de `open_incident`/`resolve_incident` em src/agents/tools.ts
- [X] T018 [US1] Atualizar seed e saída utilitária para refletir baseline persistente em src/scripts/seed-story.ts

**Checkpoint**: US1 funcional e validável isoladamente.

---

## Phase 4: User Story 2 - Consultar informações operacionais segmentadas (Priority: P2)

**Goal**: Expor consulta de incidentes por status e runbook por serviço com erros explícitos.

**Independent Test**: Criar cenário com incidentes abertos/resolvidos e validar filtros + consulta de runbook.

### Tests for User Story 2

- [X] T019 [P] [US2] Adicionar teste para `list_incidents` com filtros `open|resolved|all` em src/agents/tools.test.ts
- [X] T020 [P] [US2] Adicionar teste para `consultar_runbook` com serviço válido em src/agents/tools.test.ts
- [X] T021 [US2] Adicionar testes de erro de domínio para serviço inexistente e serviço sem runbook em src/agents/tools.test.ts

### Implementation for User Story 2

- [X] T022 [US2] Implementar `listIncidents` no store com filtro padrão `open` em src/store/sqlite-ops-store.ts
- [X] T023 [US2] Implementar `getRunbookByService` no store com falha explícita para recurso ausente em src/store/sqlite-ops-store.ts
- [X] T024 [US2] Adicionar tools `list_incidents` e `consultar_runbook` com enums e `.describe()` em todos os campos em src/agents/tools.ts
- [X] T025 [US2] Revisar descrição de uso da tool `open_incident` e padronizar descrições das tools operacionais em src/agents/tools.ts

**Checkpoint**: US2 funcional e validável isoladamente.

---

## Phase 5: User Story 3 - Garantir cenário reprodutível para qualidade (Priority: P3)

**Goal**: Preservar execução determinística de testes e benchmark com inicialização efêmera.

**Independent Test**: Repetir seed em modo efêmero sem duplicação e executar benchmark com resultados estáveis.

### Tests for User Story 3

- [X] T026 [P] [US3] Adicionar teste de idempotência de seed em `:memory:` em src/agents/tools.test.ts
- [X] T027 [P] [US3] Adicionar teste de constraints (tier/severity/status) rejeitando valores inválidos em src/agents/tools.test.ts
- [X] T028 [US3] Atualizar testes de estratégia para uso determinístico do store em src/agents/tools.test.ts, src/index.test.ts e src/arena.test.ts

### Implementation for User Story 3

- [X] T029 [US3] Garantir seleção explícita de `:memory:` para cenários de teste/bench no store e composição em src/store/sqlite-ops-store.ts e src/bench.ts
- [X] T030 [US3] Ajustar estrutura de dados de cenário para manter reprodutibilidade (services/alerts/runbooks) em src/agents/tools.ts e src/agents/story-seed.json
- [X] T031 [US3] Documentar execução de validação ponta a ponta da feature em specs/004-sqlite-ops-store/quickstart.md

**Checkpoint**: US3 funcional e validável isoladamente.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Fechamento da feature com validação final e consistência de documentação.

- [X] T032 [P] Atualizar contratos funcionais finais em specs/004-sqlite-ops-store/contracts/ops-tools.md
- [X] T033 [P] Atualizar modelo de dados final em specs/004-sqlite-ops-store/data-model.md quando houver ajuste de regra
- [X] T034 Executar validações completas (`npm run typecheck` e `npm test`) e registrar resultado em specs/004-sqlite-ops-store/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: sem dependências
- **Phase 2 (Foundational)**: depende da Phase 1 e bloqueia todas as user stories
- **Phases 3-5 (User Stories)**: dependem da conclusão da Phase 2
- **Phase 6 (Polish)**: depende da conclusão das histórias desejadas

### User Story Dependencies

- **US1 (P1)**: inicia após Phase 2; base do MVP
- **US2 (P2)**: inicia após Phase 2; independe funcionalmente de US1, mas reutiliza contratos comuns
- **US3 (P3)**: inicia após Phase 2; depende de infraestrutura pronta e validações das histórias anteriores para comparação

### Within Each User Story

- Testes da história primeiro, depois implementação
- Ajustes de store antes de ajuste final de tool correspondente
- História concluída somente com critérios independentes validados

---

## Parallel Opportunities

- **Setup**: T003 pode rodar em paralelo com T001/T002
- **Foundational**: T005, T009 e T011 paralelizáveis após T004
- **US1**: T012 e T013 podem rodar em paralelo; implementação T015/T016 pode ocorrer em paralelo parcial
- **US2**: T019 e T020 paralelizáveis; T022 e T023 paralelizáveis
- **US3**: T026 e T027 paralelizáveis; T029 e T030 paralelizáveis
- **Polish**: T032 e T033 paralelizáveis antes de T034

---

## Parallel Example: User Story 2

```bash
Task: "T019 [US2] Teste de filtros list_incidents em src/agents/tools.test.ts"
Task: "T020 [US2] Teste de consultar_runbook válido em src/agents/tools.test.ts"
Task: "T022 [US2] Implementar listIncidents em src/store/sqlite-ops-store.ts"
Task: "T023 [US2] Implementar getRunbookByService em src/store/sqlite-ops-store.ts"
```

---

## Implementation Strategy

### MVP First (US1)

1. Completar Setup + Foundational
2. Entregar US1 com persistência de ciclo operacional (abrir/listar/resolver)
3. Validar qualidade com testes e tipagem

### Incremental Delivery

1. Adicionar US2 (consultas segmentadas e runbook)
2. Adicionar US3 (reprodutibilidade forte em teste/bench)
3. Finalizar com Polish e validações completas

### Execution Approach

- Priorizar mudanças cirúrgicas por fase
- Preservar comportamento já existente nas tools legadas
- Garantir conformidade com constituição e gates de qualidade a cada fase
