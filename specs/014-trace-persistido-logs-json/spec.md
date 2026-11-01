# Feature Specification: Trace Persistido e Logs JSON

**Feature Branch**: `014-trace-persistido-logs-json`

**Created**: 2026-11-01

**Status**: Draft

**Input**: User description: "Trace persistido + logs JSON: -/chat: requestId no corpo e no header X-Request_Id -SQLite: requests (métricas) e trace_events (node, payloads). -src/obs/logger.ts: 1 linha JSON por evento, só metadados. -GET /requests/:id registro + trace ordenado"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Correlacionar uma execução de chat (Priority: P1)

Como operador, eu consigo identificar de forma única cada execução de `/chat` com um `requestId` retornado no corpo e também em cabeçalho HTTP, para correlacionar logs, métricas e troubleshooting com consistência.

**Why this priority**: Sem correlação de requisição, não há rastreabilidade operacional confiável para investigar falhas e latência.

**Independent Test**: Enviar uma requisição para `/chat` e validar que a resposta inclui um `requestId` idêntico no corpo e no cabeçalho `X-Request_Id`.

**Acceptance Scenarios**:

1. **Given** uma chamada válida para `/chat`, **When** a resposta é concluída, **Then** o `requestId` é retornado no corpo e no cabeçalho `X-Request_Id`.
2. **Given** múltiplas chamadas para `/chat`, **When** cada resposta é recebida, **Then** cada chamada possui `requestId` único e não compartilhado com outras chamadas.

---

### User Story 2 - Persistir rastros e métricas da requisição (Priority: P1)

Como operador, eu consigo consultar posteriormente métricas de uma requisição e seus eventos de trace para auditoria técnica e análise de comportamento.

**Why this priority**: Persistência operacional é essencial para inspeção pós-execução e observabilidade histórica.

**Independent Test**: Executar uma chamada para `/chat` e verificar que existe um registro de requisição com métricas e eventos de trace associados para o mesmo `requestId`.

**Acceptance Scenarios**:

1. **Given** uma execução de `/chat` com eventos internos, **When** a execução termina, **Then** os dados de métricas da requisição são persistidos em `requests`.
2. **Given** uma execução de `/chat` com eventos internos, **When** a execução termina, **Then** os eventos são persistidos em `trace_events` vinculados ao `requestId`.
3. **Given** eventos de trace gerados durante a execução, **When** cada evento é serializado para log, **Then** cada evento gera exatamente uma linha JSON contendo apenas metadados definidos.

---

### User Story 3 - Recuperar histórico completo por requestId (Priority: P2)

Como operador, eu consigo recuperar um registro específico com seus eventos ordenados para reconstruir a linha do tempo da execução.

**Why this priority**: A leitura estruturada por `requestId` reduz tempo de diagnóstico e permite análises reproduzíveis.

**Independent Test**: Chamar `GET /requests/:id` para um `requestId` existente e validar retorno do registro e dos eventos de trace em ordem determinística.

**Acceptance Scenarios**:

1. **Given** um `requestId` existente, **When** `GET /requests/:id` é chamado, **Then** a resposta retorna o registro da requisição e o trace associado.
2. **Given** eventos com ordem temporal definida para um `requestId`, **When** `GET /requests/:id` retorna o trace, **Then** os eventos vêm em ordem estável e previsível.

---

### Edge Cases

- O que acontece quando `GET /requests/:id` recebe um identificador inexistente?
- Como o sistema se comporta quando uma requisição gera registro em `requests`, mas falha antes de concluir todos os `trace_events`?
- Como o sistema evita colisão de `requestId` em cenários de alta concorrência?
- Como o sistema trata payloads de trace ausentes ou vazios mantendo consistência de auditoria?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE gerar um `requestId` único para cada chamada ao endpoint `/chat`.
- **FR-002**: O sistema DEVE retornar o `requestId` no corpo da resposta de `/chat`.
- **FR-003**: O sistema DEVE retornar o mesmo `requestId` no cabeçalho HTTP `X-Request_Id`.
- **FR-004**: O sistema DEVE persistir um registro de requisição em `requests` contendo as métricas necessárias para observabilidade operacional.
- **FR-005**: O sistema DEVE persistir eventos de trace em `trace_events`, vinculando cada evento ao `requestId` correspondente.
- **FR-006**: Cada evento de trace DEVE armazenar o nó de origem (`node`) e os payloads associados.
- **FR-007**: O logger estruturado DEVE emitir exatamente uma linha JSON por evento de trace contendo apenas metadados definidos para observabilidade.
- **FR-008**: O sistema DEVE expor `GET /requests/:id` para retornar o registro da requisição e seu trace associado.
- **FR-009**: `GET /requests/:id` DEVE retornar os eventos de trace em ordem determinística para reconstrução cronológica da execução.
- **FR-010**: Para `requestId` inexistente, `GET /requests/:id` DEVE retornar resposta explícita de não encontrado sem dados parciais.

### Key Entities *(include if feature involves data)*

- **Request Record**: Representa uma execução individual de `/chat`, identificada por `requestId`, com métricas operacionais da execução.
- **Trace Event**: Representa um evento individual da execução, contendo referência ao `requestId`, identificação do `node`, metadados e payloads do evento.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das respostas bem-sucedidas de `/chat` retornam `requestId` no corpo e no cabeçalho `X-Request_Id` com o mesmo valor.
- **SC-002**: Em amostragem de produção, 99% ou mais das requisições com sucesso possuem registro persistido de métricas e trace recuperável por `requestId`.
- **SC-003**: 100% das consultas bem-sucedidas a `GET /requests/:id` para IDs existentes retornam trace com ordenação estável entre chamadas repetidas.
- **SC-004**: Para cada evento de trace gerado, existe exatamente uma linha JSON correspondente de log estruturado de metadados.

## Assumptions

- O endpoint `/chat` já existe e pode ser estendido para incluir metadados de correlação na resposta.
- O ambiente de execução já possui persistência relacional habilitada para armazenar `requests` e `trace_events`.
- O cabeçalho solicitado pelo negócio é `X-Request_Id` e deve ser mantido exatamente nesse formato.
- A ordenação dos eventos em `GET /requests/:id` seguirá um critério único e estável de ordenação definido pela própria persistência.
- Observabilidade desta feature cobre metadados e payloads de trace, sem inclusão de segredos em logs.
