# Tasks: Status de provedores externos

**Input**: Design documents from `/specs/005-check-provider-status/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/provider-status-tool.md, quickstart.md

**Tests**: Incluídos porque a spec exige explicitamente testes para sucesso, timeout e resposta inválida sem rede.

**Organization**: Tasks agrupadas por user story para permitir implementação e validação independentes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependência direta)
- **[Story]**: User story alvo (`[US1]`, `[US2]`, `[US3]`)
- Cada tarefa inclui caminho exato de arquivo

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Preparar estrutura mínima para adicionar a nova tool sem regressão.

- [X] T001 Revisar contratos e cenários da feature em specs/005-check-provider-status/spec.md, specs/005-check-provider-status/contracts/provider-status-tool.md e specs/005-check-provider-status/quickstart.md
- [X] T002 [P] Adicionar seção da nova tool `check_provider_status` em specs/005-check-provider-status/contracts/provider-status-tool.md caso haja divergência entre contrato e implementação planejada
- [X] T003 [P] Preparar espaço de testes da nova tool em src/agents/tools.test.ts sem alterar testes existentes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Criar base compartilhada de schemas, mapeamento e helpers que bloqueia todas as histórias.

**⚠️ CRITICAL**: Nenhuma user story começa antes desta fase.

- [X] T004 Definir enum de provider e schema de input em src/agents/tools.ts citando regras de data-model.md: "`provider` opcional", "quando presente, deve estar no conjunto suportado", "quando ausente, aplica valor padrão do domínio"
- [X] T005 [P] Definir schema de payload externo em src/agents/tools.ts citando regras de data-model.md: "`status` obrigatório", "`status.indicator` obrigatório e textual", "`status.description` obrigatório e textual"
- [X] T006 [P] Implementar mapeamento de endpoint por provider em src/agents/tools.ts usando `github -> https://www.githubstatus.com/api/v2/status.json` e `cloudflare -> https://www.cloudflarestatus.com/api/v2/status.json`
- [X] T007 Implementar helper injetável de fetch com timeout por tentativa em src/agents/tools.ts para suportar testes sem rede real
- [X] T008 Criar função de formatação de saída compacta e mensagem de erro legível em src/agents/tools.ts citando regras de data-model.md: "`formattedLine` deve conter uma única linha legível" e "`reason` obrigatório e legível para operador"

**Checkpoint**: Base pronta para implementar histórias de usuário.

---

## Phase 3: User Story 1 - Confirmar se a falha é externa (Priority: P1) 🎯 MVP

**Goal**: Disponibilizar consulta de status por provider com default e resposta de sucesso compacta para triagem.

**Independent Test**: Consultar com provider omitido e explícito, validando retorno de uma linha com indicador + descrição para cada provedor suportado.

### Tests for User Story 1

- [X] T009 [P] [US1] Adicionar teste de default provider (`github`) da tool `check_provider_status` em src/agents/tools.test.ts com fake fetch
- [X] T010 [P] [US1] Adicionar teste de seleção explícita de provider (`cloudflare`) em src/agents/tools.test.ts com fake fetch
- [X] T011 [US1] Adicionar teste de parse de payload válido (`status.indicator` + `status.description`) em src/agents/tools.test.ts

### Implementation for User Story 1

- [X] T012 [US1] Implementar tool `check_provider_status` com `provider` enum (`github | cloudflare`) e default `github` em src/agents/tools.ts
- [X] T013 [US1] Implementar retorno de sucesso em linha única com indicador + descrição em src/agents/tools.ts sem retornar JSON bruto
- [X] T014 [US1] Registrar nova tool na lista retornada por createAgentTools em src/agents/tools.ts preservando ferramentas existentes

**Checkpoint**: US1 funcional e validável isoladamente.

---

## Phase 4: User Story 2 - Manter diagnóstico útil em instabilidade transitória (Priority: P2)

**Goal**: Aplicar timeout e retry único para falhas transitórias, retornando erro legível na falha final.

**Independent Test**: Simular falha transitória na primeira tentativa com sucesso na segunda e simular falha final com mensagem legível.

### Tests for User Story 2

- [X] T015 [P] [US2] Adicionar teste de timeout com `AbortSignal.timeout(5000)` e falha final legível em src/agents/tools.test.ts
- [X] T016 [P] [US2] Adicionar teste de retry único para falha de rede seguido de sucesso em src/agents/tools.test.ts
- [X] T017 [P] [US2] Adicionar teste de retry único para erro 5xx seguido de sucesso em src/agents/tools.test.ts
- [X] T018 [US2] Adicionar teste garantindo no máximo duas tentativas totais (1 inicial + 1 retry) em src/agents/tools.test.ts

### Implementation for User Story 2

- [X] T019 [US2] Implementar classificação de falha transitória (rede e 5xx) para retry único em src/agents/tools.ts
- [X] T020 [US2] Implementar política de tentativa: `requested -> attempt_1 -> attempt_2` apenas quando elegível, conforme data-model.md, em src/agents/tools.ts
- [X] T021 [US2] Implementar retorno de erro final legível sem throw externo para timeout, rede e 5xx em src/agents/tools.ts

**Checkpoint**: US2 funcional e validável isoladamente.

---

## Phase 5: User Story 3 - Preservar contexto da conversa durante o plantão (Priority: P3)

**Goal**: Garantir saída compacta em sucesso e falha, e tratamento de resposta inválida sem exceção propagada.

**Independent Test**: Simular payload inválido e confirmar linha única de erro legível; validar que sucesso permanece em linha única compacta.

### Tests for User Story 3

- [X] T022 [P] [US3] Adicionar teste de payload inválido retornando erro legível sem lançar exceção em src/agents/tools.test.ts
- [X] T023 [P] [US3] Adicionar teste de formato compacto de sucesso em linha única sem quebras de linha em src/agents/tools.test.ts
- [X] T024 [US3] Adicionar teste para garantir que a tool nunca propaga exceção para fora do limite da tool em src/agents/tools.test.ts

### Implementation for User Story 3

- [X] T025 [US3] Implementar validação zod da resposta externa e fallback para erro legível em src/agents/tools.ts
- [X] T026 [US3] Ajustar descrição da tool para orientar uso em triagem "é nosso ou do provedor?" em src/agents/tools.ts
- [X] T027 [US3] Garantir que saída de sucesso e erro permaneça compacta em uma única linha em src/agents/tools.ts

**Checkpoint**: US3 funcional e validável isoladamente.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Fechamento da feature com validação final e consistência documental.

- [X] T028 [P] Atualizar documentação de contrato final em specs/005-check-provider-status/contracts/provider-status-tool.md conforme implementação concluída
- [X] T029 [P] Atualizar guia de validação em specs/005-check-provider-status/quickstart.md com comandos e expectativas finais da tool
- [X] T030 Executar validação completa `npm run typecheck` e `npm test` e registrar resultado em specs/005-check-provider-status/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: sem dependências
- **Phase 2 (Foundational)**: depende da Phase 1 e bloqueia todas as user stories
- **Phases 3-5 (User Stories)**: dependem da conclusão da Phase 2
- **Phase 6 (Polish)**: depende da conclusão das histórias desejadas

### User Story Dependencies

- **US1 (P1)**: inicia após Phase 2; define MVP com consulta funcional básica
- **US2 (P2)**: inicia após Phase 2; pode usar base de US1, mas mantém teste independente
- **US3 (P3)**: inicia após Phase 2; completa robustez de compactação e payload inválido

### Within Each User Story

- Testes primeiro (devem falhar antes da implementação)
- Schema/validação antes de formatação de saída
- Lógica principal antes de integração no `createAgentTools`
- Story validada de forma independente antes da próxima prioridade

### Parallel Opportunities

- Tasks marcadas com **[P]** em Setup e Foundational
- Testes [P] dentro da mesma user story
- Após Phase 2, US1/US2/US3 podem iniciar em paralelo por pessoas diferentes

---

## Parallel Example: User Story 1

```bash
Task: "Adicionar teste de default provider (`github`) da tool `check_provider_status` em src/agents/tools.test.ts com fake fetch"
Task: "Adicionar teste de seleção explícita de provider (`cloudflare`) em src/agents/tools.test.ts com fake fetch"
```

## Parallel Example: User Story 2

```bash
Task: "Adicionar teste de timeout com `AbortSignal.timeout(5000)` e falha final legível em src/agents/tools.test.ts"
Task: "Adicionar teste de retry único para erro 5xx seguido de sucesso em src/agents/tools.test.ts"
```

## Parallel Example: User Story 3

```bash
Task: "Adicionar teste de payload inválido retornando erro legível sem lançar exceção em src/agents/tools.test.ts"
Task: "Adicionar teste de formato compacto de sucesso em linha única sem quebras de linha em src/agents/tools.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1 (Setup)
2. Completar Phase 2 (Foundational)
3. Completar Phase 3 (US1)
4. Validar US1 isoladamente com os testes da história
5. Demonstrar valor operacional de triagem

### Incremental Delivery

1. Entregar MVP (US1)
2. Adicionar resiliência operacional (US2)
3. Consolidar compactação e robustez de erro (US3)
4. Fechar com Phase 6 (Polish) e validação completa
