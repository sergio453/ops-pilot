# Tasks: Servidor MCP OpsPilot

**Input**: Design documents from `/specs/006-opspilot-mcp-server/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/mcp-server-tools.md, quickstart.md

**Tests**: Incluídos porque a spec exige explicitamente teste automatizado para validar o catálogo de tools do servidor MCP.

**Organization**: Tasks agrupadas por user story para permitir implementação e validação independentes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependência direta)
- **[Story]**: User story alvo (`[US1]`, `[US2]`, `[US3]`)
- Cada tarefa inclui caminho exato de arquivo

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Preparar dependências e estrutura base para o servidor MCP.

- [X] T001 Adicionar dependência `@modelcontextprotocol/sdk` em package.json
- [X] T002 [P] Adicionar script `mcp` em package.json apontando para src/mcp/server.ts
- [X] T003 [P] Criar diretório base src/mcp/ com arquivo inicial src/mcp/server.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implementar blocos compartilhados que todas as histórias dependem.

**⚠️ CRITICAL**: Nenhuma user story começa antes desta fase.

- [X] T004 Implementar função de bootstrap do servidor em src/mcp/server.ts com entidade MCPServerIdentity citando constraints de data-model.md: "`name` deve ser estável e igual a `opspilot`" e "`transport` deve operar em stdio"
- [X] T005 [P] Implementar definição central do catálogo MCP em src/mcp/server.ts citando constraint de data-model.md: "`tools[]` deve conter exatamente as ferramentas em escopo da feature"
- [X] T006 [P] Instanciar store compartilhada via src/store/sqlite-ops-store.ts dentro de src/mcp/server.ts sem criar store paralela
- [X] T007 Implementar adaptador de descoberta e chamada de tool em src/mcp/server.ts reaproveitando handlers de src/agents/tools.ts
- [X] T008 Implementar tratamento de erro explícito na borda MCP em src/mcp/server.ts para validação, domínio e persistência (sem fallback silencioso)

**Checkpoint**: Fundação pronta para implementar histórias por prioridade.

---

## Phase 3: User Story 1 - Integrar cliente MCP às operações de plantão (Priority: P1) 🎯 MVP

**Goal**: Entregar servidor MCP funcional com descoberta e execução das 3 tools no fluxo padrão.

**Independent Test**: Iniciar servidor MCP e validar que descoberta retorna exatamente `list_alerts`, `open_incident` e `resolve_incident`, além de execução bem-sucedida de cada uma com entrada válida.

### Tests for User Story 1

- [X] T009 [P] [US1] Criar teste de descoberta do catálogo MCP em src/mcp/server.test.ts validando exatamente três tools e nenhuma extra
- [X] T010 [P] [US1] Criar teste de chamada `list_alerts` com payload válido em src/mcp/server.test.ts
- [X] T011 [P] [US1] Criar teste de chamada `open_incident` com payload válido em src/mcp/server.test.ts
- [X] T012 [P] [US1] Criar teste de chamada `resolve_incident` com payload válido em src/mcp/server.test.ts

### Implementation for User Story 1

- [X] T013 [US1] Expor ferramenta `list_alerts` no catálogo MCP em src/mcp/server.ts usando output serializado retornado por src/agents/tools.ts
- [X] T014 [US1] Expor ferramenta `open_incident` no catálogo MCP em src/mcp/server.ts com input de src/agents/tools.ts
- [X] T015 [US1] Expor ferramenta `resolve_incident` no catálogo MCP em src/mcp/server.ts com input de src/agents/tools.ts
- [X] T016 [US1] Implementar inicialização e lifecycle do servidor MCP em src/mcp/server.ts para transporte stdio no comando npm `mcp`

**Checkpoint**: US1 funcional e validável isoladamente (MVP).

---

## Phase 4: User Story 2 - Manter consistência de validação e dados (Priority: P2)

**Goal**: Garantir uma única fonte de verdade para validação e persistência nas operações MCP.

**Independent Test**: Chamar tools com entradas inválidas e válidas via MCP, validando mesma rejeição/aceitação dos contratos atuais e persistência refletida na mesma store operacional.

### Tests for User Story 2

- [X] T017 [P] [US2] Adicionar teste de validação de `open_incident` com campos inválidos em src/mcp/server.test.ts citando constraints de data-model.md: "Campos obrigatórios não podem ser vazios" e "`severity` limitada aos níveis operacionais permitidos"
- [X] T018 [P] [US2] Adicionar teste de validação de `resolve_incident` em src/mcp/server.test.ts citando constraint de data-model.md: "`id` deve identificar incidente existente para resolução"
- [X] T019 [P] [US2] Adicionar teste de filtro de `list_alerts` em src/mcp/server.test.ts citando constraints de data-model.md: "Quando presente, `status` deve pertencer ao conjunto suportado" e "Quando ausente, aplica comportamento padrão já definido pelo domínio"
- [X] T020 [US2] Adicionar teste de persistência compartilhada em src/mcp/server.test.ts comprovando efeito de `open_incident` e `resolve_incident` na mesma fonte operacional

### Implementation for User Story 2

- [X] T021 [US2] Reutilizar schemas e validações existentes de src/agents/tools.ts no binding MCP em src/mcp/server.ts sem duplicar schema local
- [X] T022 [US2] Garantir resultados de operações no MCP em src/mcp/server.ts citando constraints de data-model.md: "Em sucesso, `incident` obrigatório com estado persistido" e "Em falha, erro explícito para cliente MCP"
- [X] T023 [US2] Garantir resposta de listagem em src/mcp/server.ts citando constraints de data-model.md: "Resposta sempre serializável no formato esperado pelo protocolo" e "Coleção pode ser vazia sem caracterizar erro"

**Checkpoint**: US2 funcional e validável isoladamente.

---

## Phase 5: User Story 3 - Preservar integridade do canal stdio (Priority: P3)

**Goal**: Garantir disciplina de IO: protocolo em stdout e diagnóstico em stderr.

**Independent Test**: Exercitar inicialização e chamadas do servidor e confirmar ausência de logs de diagnóstico em stdout, com diagnósticos direcionados a stderr.

### Tests for User Story 3

- [X] T024 [P] [US3] Adicionar teste em src/mcp/server.test.ts que falha se houver uso de `console.log` no servidor MCP
- [X] T025 [P] [US3] Adicionar teste de disciplina de IO em src/mcp/server.test.ts citando transições de data-model.md: "`server_started -> protocol_messages_on_stdout_only`" e "`diagnostic_event -> stderr_only`"

### Implementation for User Story 3

- [X] T026 [US3] Remover/evitar qualquer emissão de diagnóstico em stdout em src/mcp/server.ts e direcionar mensagens operacionais para stderr
- [X] T027 [US3] Atualizar fluxo de erro no src/mcp/server.ts para logging de diagnóstico em stderr sem quebrar respostas MCP

**Checkpoint**: US3 funcional e validável isoladamente.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Fechar documentação e validação final de ponta a ponta.

- [X] T028 [P] Atualizar contrato final em specs/006-opspilot-mcp-server/contracts/mcp-server-tools.md para refletir implementação concluída
- [X] T029 [P] Atualizar guia de execução/validação em specs/006-opspilot-mcp-server/quickstart.md com comandos finais e resultados esperados
- [X] T030 Executar validação completa `npm run typecheck` e `npm test`, registrando resultado em specs/006-opspilot-mcp-server/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: sem dependências
- **Phase 2 (Foundational)**: depende da Phase 1 e bloqueia as user stories
- **Phases 3-5 (User Stories)**: dependem da conclusão da Phase 2
- **Phase 6 (Polish)**: depende da conclusão das histórias desejadas

### User Story Dependencies

- **US1 (P1)**: inicia após Phase 2; define o MVP funcional
- **US2 (P2)**: inicia após Phase 2; garante consistência de contratos e store
- **US3 (P3)**: inicia após Phase 2; garante robustez do canal stdio

### Within Each User Story

- Testes primeiro (devem falhar antes da implementação)
- Definição/validação de contrato antes de ajustes de integração
- Implementação principal antes de validação final da história

### Parallel Opportunities

- Fase 1: T002 e T003 em paralelo
- Fase 2: T005 e T006 em paralelo
- US1: T009-T012 em paralelo
- US2: T017-T019 em paralelo
- US3: T024 e T025 em paralelo
- Fase 6: T028 e T029 em paralelo

---

## Parallel Example: User Story 1

```bash
# Rodar testes de descoberta/chamada em paralelo:
Task: "T009 [US1] teste de descoberta em src/mcp/server.test.ts"
Task: "T010 [US1] teste list_alerts em src/mcp/server.test.ts"
Task: "T011 [US1] teste open_incident em src/mcp/server.test.ts"
Task: "T012 [US1] teste resolve_incident em src/mcp/server.test.ts"
```

---

## Parallel Example: User Story 2

```bash
# Rodar validações de input/contrato em paralelo:
Task: "T017 [US2] validação open_incident em src/mcp/server.test.ts"
Task: "T018 [US2] validação resolve_incident em src/mcp/server.test.ts"
Task: "T019 [US2] validação list_alerts em src/mcp/server.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Concluir Phase 1 (Setup)
2. Concluir Phase 2 (Foundational)
3. Concluir Phase 3 (US1)
4. Validar US1 independentemente via testes de descoberta/chamada do servidor MCP

### Incremental Delivery

1. Entregar MVP (US1)
2. Adicionar US2 com foco em consistência de validação/store
3. Adicionar US3 com foco em disciplina de IO stdio
4. Finalizar com Phase 6 (polish + validação completa)

### Parallel Team Strategy

1. Time conclui Setup + Foundational em conjunto
2. Após foundation:
   - Dev A: US1
   - Dev B: US2
   - Dev C: US3
3. Consolidar resultados e executar validação final

---

## Notes

- [P] identifica tarefas sem dependência direta de tarefas incompletas.
- Labels `[US1]`, `[US2]`, `[US3]` garantem rastreabilidade por história.
- Cada história tem critério de teste independente.
- Ordem sugerida preserva MVP rápido com baixo risco de regressão.
