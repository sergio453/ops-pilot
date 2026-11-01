# Feature Specification: Persistência real de operações

**Feature Branch**: `004-sqlite-ops-store`

**Created**: 2026-10-14

**Status**: Draft

**Input**: User description: "Persistência real de operações com store persistente, seed idempotente, novas consultas de incidente e runbook, mantendo cenários reprodutíveis para teste e benchmark."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Operar plantão com estado persistente (Priority: P1)

Como plantonista, quero consultar alertas, abrir incidentes e resolver incidentes com estado
persistido entre execuções para que o histórico operacional não seja perdido ao reiniciar o sistema.

**Why this priority**: Esta é a capacidade central para incidentes reais; sem persistência não há
rastreabilidade confiável de operação.

**Independent Test**: Pode ser testada de forma independente executando um ciclo completo de
abrir/listar/resolver incidente e validando que os dados permanecem consistentes no armazenamento.

**Acceptance Scenarios**:

1. **Given** um ambiente inicializado com dados operacionais padrão, **When** o usuário abre um
   incidente para um serviço válido, **Then** o incidente é criado com status aberto e passa a
   aparecer nas consultas de incidentes abertos.
2. **Given** um incidente aberto existente, **When** o usuário resolve esse incidente, **Then** o
   status muda para resolvido e o registro passa a aparecer nas consultas de incidentes resolvidos.

---

### User Story 2 - Consultar informações operacionais segmentadas (Priority: P2)

Como plantonista, quero filtrar incidentes por status e consultar runbook por serviço para acelerar
diagnóstico e execução do procedimento correto durante um incidente.

**Why this priority**: A consulta segmentada reduz tempo de triagem e aumenta precisão de resposta.

**Independent Test**: Pode ser testada sem outras histórias criando cenários com incidentes abertos
e resolvidos e validando filtros, além de consulta de runbook por serviço.

**Acceptance Scenarios**:

1. **Given** incidentes com estados diferentes, **When** o usuário lista incidentes por filtro
   (abertos, resolvidos ou todos), **Then** apenas os registros correspondentes ao filtro retornam.
2. **Given** um serviço com runbook cadastrado, **When** o usuário consulta o runbook desse
   serviço, **Then** o conteúdo operacional correto é retornado.

---

### User Story 3 - Garantir cenário reprodutível para qualidade (Priority: P3)

Como engenheiro de qualidade, quero inicializar o armazenamento em modo efêmero e com seed
idempotente para executar testes e benchmark de forma determinística.

**Why this priority**: Reprodutibilidade reduz falsos positivos em testes e torna comparações de
benchmark confiáveis.

**Independent Test**: Pode ser testada repetindo a inicialização com seed no modo efêmero e
confirmando cardinalidades e conteúdo esperados sem duplicação.

**Acceptance Scenarios**:

1. **Given** um armazenamento efêmero inicializado, **When** o seed padrão é executado múltiplas
   vezes, **Then** a base permanece com o mesmo conjunto esperado de registros sem duplicações.
2. **Given** ambiente de benchmark configurado para cenário reprodutível, **When** o benchmark é
   executado, **Then** os cenários usam dados previsíveis e comparáveis entre execuções.

---

### Edge Cases

- O que acontece quando é solicitado runbook de um serviço inexistente?
- Como o sistema responde quando um serviço existe, mas não possui runbook cadastrado?
- O que acontece ao resolver um incidente já resolvido?
- Como o sistema trata tentativa de inserir valores inválidos em campos de domínio fechado
  (ex.: status, severidade, criticidade de serviço)?
- Como o sistema se comporta quando o caminho de armazenamento não existe no disco?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST persistir dados operacionais de serviços, alertas, incidentes e
  runbooks em armazenamento local durável.
- **FR-002**: O sistema MUST permitir configuração explícita do caminho de armazenamento por
  variável de ambiente e usar caminho padrão de projeto quando não informado.
- **FR-003**: O sistema MUST suportar inicialização em modo efêmero para testes e benchmark sem
  dependência de arquivos persistentes.
- **FR-004**: O sistema MUST inicializar seu esquema de dados de forma idempotente, sem falhar em
  reexecuções.
- **FR-005**: O sistema MUST aplicar seed idempotente do cenário Mercadinho com 5 serviços,
  6 alertas (3 firing e 3 resolved) e runbooks para checkout, payments e auth.
- **FR-006**: O sistema MUST registrar incidentes com identificador sequencial, status e marcação
  de resolução opcional (ausente enquanto aberto e preenchida ao resolver).
- **FR-007**: O sistema MUST permitir listar incidentes com filtro por status aberto, resolvido ou
  todos, com padrão em aberto.
- **FR-008**: O sistema MUST expor consulta de runbook por serviço e retornar erro de domínio
  explícito quando o serviço não existir.
- **FR-009**: O sistema MUST retornar erro de domínio explícito quando o serviço existir, mas não
  houver runbook cadastrado.
- **FR-010**: O sistema MUST impor validação de domínio para campos fechados (tier, severity,
  status), rejeitando valores fora dos conjuntos permitidos.
- **FR-011**: O sistema MUST manter comportamento funcional das tools já existentes de listagem de
  alertas, abertura e resolução de incidentes após a migração de persistência.
- **FR-012**: O sistema MUST manter cenários reprodutíveis com store em memória para testes e
  benchmark, mesmo com persistência real habilitada na composição principal.

### Key Entities *(include if feature involves data)*

- **Service**: Serviço monitorado com identificador único, nome e nível de criticidade operacional.
- **Alert**: Sinal operacional associado a um serviço, com título, severidade e estado (firing ou
  resolved).
- **Incident**: Registro formal de resposta a problema operacional, com título, serviço, severidade,
  status e timestamp de resolução opcional.
- **Runbook**: Procedimento operacional associado a um serviço para diagnóstico e mitigação.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das execuções do fluxo abrir/listar/resolver incidente mantêm consistência de
  estado entre operações na mesma base.
- **SC-002**: Seed padrão mantém cardinalidade estável (5 serviços, 6 alertas e 3 runbooks) em
  reexecuções sem aumentar contagem de registros.
- **SC-003**: 100% dos filtros de listagem de incidentes (aberto, resolvido, todos) retornam apenas
  o subconjunto esperado nos cenários de teste definidos.
- **SC-004**: 100% das consultas de runbook retornam resultado correto para serviços suportados e
  erro de domínio explícito para serviços sem runbook ou inexistentes.
- **SC-005**: Suite de testes e validação de tipos permanecem verdes após a migração.

## Assumptions

- O escopo desta feature cobre persistência operacional local para ambiente de desenvolvimento e
  execução do projeto, sem incluir replicação distribuída.
- O conjunto de domínios fechados para tier, severity e status é suficiente para os cenários atuais
  de operação.
- O seed Mercadinho é a referência oficial para cenários de demonstração, teste e benchmark.
- Fluxos de autorização e autenticação não fazem parte desta mudança e permanecem inalterados.
