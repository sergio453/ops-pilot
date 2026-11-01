# Feature Specification: Servidor MCP OpsPilot

**Feature Branch**: `006-opspilot-mcp-server`

**Created**: 2026-10-17

**Status**: Draft

**Input**: User description: "MCP server do OpsPilot: src/mcp/server.tc com @modelcontextprotocol/sdk, transport stdio, expondo list_alerts, open_incident e resolve_incident - reutilizando o mesmo OpsStore e os mesmos schemas zod das tools existentes (uma única fonte de verdade). Nome do server: opspilot. Script npm: mcp = "tx src/mcp/server.ts" (se precisar de env, alterar o script e carregar elas antes). REGRA CRÍTICA: nenhum console.log no server - no stdio o stdouté o canal do protocolo; diagnóstico vai para o stderr. Test: sobre o server e valida o list de tools"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Integrar cliente MCP às operações de plantão (Priority: P1)

Como integrador de ferramentas, quero conectar um cliente MCP ao OpsPilot para listar alertas e
abrir ou resolver incidentes sem depender do canal HTTP.

**Why this priority**: Sem essa integração, o cliente MCP não consegue executar os fluxos mais
importantes de triagem e gestão operacional.

**Independent Test**: Pode ser testada conectando um cliente MCP, listando as ferramentas
disponíveis e executando cada uma com dados válidos.

**Acceptance Scenarios**:

1. **Given** um cliente MCP conectado ao servidor, **When** ele solicita a lista de ferramentas,
   **Then** recebe exatamente `list_alerts`, `open_incident` e `resolve_incident`.
2. **Given** um cliente MCP conectado ao servidor, **When** ele chama cada uma das três ferramentas
   com dados válidos, **Then** obtém resposta de sucesso legível para cada operação.

---

### User Story 2 - Manter consistência de validação e dados (Priority: P2)

Como mantenedor do produto, quero que as ferramentas do servidor MCP apliquem os mesmos contratos
de validação e manipulem o mesmo armazenamento já usado pelas ferramentas existentes.

**Why this priority**: Isso garante uma única fonte de verdade, reduz discrepâncias entre canais e
evita regras duplicadas.

**Independent Test**: Pode ser testada validando que entradas inválidas são rejeitadas com os mesmos
critérios existentes e que alterações de incidente aparecem no mesmo histórico operacional.

**Acceptance Scenarios**:

1. **Given** uma entrada inválida para abertura ou resolução de incidente, **When** a chamada é
   feita pelo MCP, **Then** a rejeição segue os mesmos critérios de validação já adotados.
2. **Given** uma chamada válida de abertura ou resolução de incidente pelo MCP, **When** o estado é
   consultado em seguida, **Then** o resultado reflete a mesma base operacional utilizada pelos
   demais fluxos.

---

### User Story 3 - Preservar integridade do canal stdio (Priority: P3)

Como operador de integração, quero que o servidor preserve o stdout exclusivamente para o protocolo
MCP para evitar quebra de comunicação com o cliente.

**Why this priority**: Qualquer saída indevida em stdout pode invalidar o protocolo e derrubar a
integração, mesmo quando a lógica funcional está correta.

**Independent Test**: Pode ser testada exercitando inicialização e chamadas e verificando ausência
de logs de diagnóstico em stdout.

**Acceptance Scenarios**:

1. **Given** o servidor MCP em execução, **When** ele processa chamadas de ferramenta, **Then** o
   stdout permanece reservado apenas ao tráfego de protocolo.
2. **Given** um evento de diagnóstico operacional, **When** o servidor registra a informação,
   **Then** a mensagem é emitida em stderr.

---

### Edge Cases

- O que acontece quando o cliente tenta chamar uma ferramenta fora do catálogo suportado?
- Como o servidor responde quando dados obrigatórios de incidente estão ausentes?
- Como o servidor responde quando um incidente alvo de resolução não existe?
- Como o servidor responde quando há falha de persistência durante abertura ou resolução?
- Como o servidor responde quando não há alertas ativos para retornar?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST disponibilizar um servidor MCP com nome `opspilot`.
- **FR-002**: O servidor MCP MUST anunciar exatamente três ferramentas:
  `list_alerts`, `open_incident` e `resolve_incident`.
- **FR-003**: O servidor MCP MUST permitir que clientes descubram o catálogo de ferramentas no fluxo
  padrão de descoberta MCP.
- **FR-004**: A ferramenta `list_alerts` MUST retornar os alertas operacionais disponíveis no
  momento da consulta.
- **FR-005**: A ferramenta `open_incident` MUST permitir registrar incidente quando os dados de
  entrada forem válidos.
- **FR-006**: A ferramenta `resolve_incident` MUST permitir resolver incidente existente quando os
  dados de entrada forem válidos.
- **FR-007**: As ferramentas MCP MUST reutilizar os mesmos contratos de validação de entrada e saída
  já adotados pelas ferramentas existentes.
- **FR-008**: As ferramentas MCP MUST reutilizar a mesma fonte de armazenamento operacional já usada
  pelas ferramentas existentes.
- **FR-009**: O sistema MUST disponibilizar um script dedicado para iniciar o servidor MCP.
- **FR-010**: O servidor MUST manter stdout exclusivo para mensagens de protocolo MCP.
- **FR-011**: O servidor MUST direcionar mensagens de diagnóstico apenas para stderr.
- **FR-012**: O sistema MUST possuir teste automatizado que valide o catálogo de ferramentas
  anunciado pelo servidor.

### Key Entities *(include if feature involves data)*

- **MCP Tool Catalog**: Catálogo de ferramentas anunciadas pelo servidor para descoberta do cliente.
- **Alert List Response**: Conjunto de alertas retornado para apoiar triagem operacional.
- **Incident Command Input**: Dados fornecidos para abertura e resolução de incidentes via MCP.
- **Incident Command Result**: Resultado legível de sucesso ou falha das operações de incidente.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em 100% das descobertas de ferramentas, o cliente recebe exatamente
  `list_alerts`, `open_incident` e `resolve_incident`.
- **SC-002**: Em 100% das chamadas válidas das três ferramentas, o cliente recebe resposta legível
  de sucesso no mesmo fluxo MCP.
- **SC-003**: Em 100% das chamadas inválidas, o cliente recebe erro de validação explícito e
  consistente com as regras já existentes.
- **SC-004**: Nos testes automatizados da feature, 0 ocorrências de mensagens de diagnóstico são
  observadas em stdout durante inicialização e execução das chamadas.

## Assumptions

- O escopo inicial do servidor MCP cobre somente as três ferramentas explicitamente solicitadas.
- O comportamento de domínio de alertas e incidentes já está definido e será reaproveitado sem
  alteração de regra de negócio nesta etapa.
- O cliente consumidor segue o fluxo padrão MCP de descoberta e invocação de ferramentas.
- A configuração de ambiente necessária para acesso ao armazenamento já está disponível no fluxo
  normal de execução do projeto.
