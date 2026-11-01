# Data Model: Servidor MCP OpsPilot

## Entities

### MCPServerIdentity

- **Fields**: `name`, `transport`, `tools[]`
- **Purpose**: Define identidade pública do servidor para descoberta por clientes MCP.
- **Validation rules**:
  - `name` deve ser estável e igual a `opspilot`
  - `transport` deve operar em stdio
  - `tools[]` deve conter exatamente as ferramentas em escopo da feature

### MCPToolDescriptor

- **Fields**: `name`, `description`, `inputSchema`
- **Purpose**: Representar metadados de ferramentas anunciadas no catálogo MCP.
- **Validation rules**:
  - `name` único por catálogo
  - `inputSchema` alinhado ao contrato de validação existente
  - `description` orientada a uso operacional

### IncidentCommandInput

- **Fields**:
  - `open_incident`: `title`, `service`, `severity`
  - `resolve_incident`: `id`
- **Purpose**: Representar payload de entrada para operações de incidente.
- **Validation rules**:
  - Campos obrigatórios não podem ser vazios
  - `severity` limitada aos níveis operacionais permitidos
  - `id` deve identificar incidente existente para resolução

### AlertListRequest

- **Fields**: `status` (opcional)
- **Purpose**: Representar filtro de listagem de alertas.
- **Validation rules**:
  - Quando presente, `status` deve pertencer ao conjunto suportado
  - Quando ausente, aplica comportamento padrão já definido pelo domínio

### IncidentOperationResult

- **Fields**: `incident` (objeto operacional), `error` (quando aplicável)
- **Purpose**: Representar resultado legível de abertura/resolução de incidentes.
- **Validation rules**:
  - Em sucesso, `incident` obrigatório com estado persistido
  - Em falha, erro explícito para cliente MCP

### AlertListResult

- **Fields**: `alerts[]`
- **Purpose**: Representar retorno de listagem de alertas no canal MCP.
- **Validation rules**:
  - Resposta sempre serializável no formato esperado pelo protocolo
  - Coleção pode ser vazia sem caracterizar erro

## Derived Views / Query Shapes

### MCPToolsListOutput

- **Input**: solicitação de descoberta de tools MCP
- **Output**: catálogo com exatamente `list_alerts`, `open_incident`, `resolve_incident`

### MCPToolCallOutput

- **Input**: nome da tool + payload validado
- **Output**:
  - `list_alerts`: coleção de alertas
  - `open_incident`: incidente criado
  - `resolve_incident`: incidente resolvido/confirmado

## State Transitions

### open_incident

- `received -> validated -> persisted_open -> returned`
- `received -> validation_failed -> returned_error`
- `received -> validated -> persistence_failed -> returned_error`

### resolve_incident

- `received -> validated -> incident_found -> persisted_resolved -> returned`
- `received -> validated -> incident_not_found -> returned_error`
- `received -> validation_failed -> returned_error`

### list_alerts

- `received -> validated -> queried -> returned`
- `received -> validation_failed -> returned_error`

### Server IO discipline

- `server_started -> protocol_messages_on_stdout_only`
- `diagnostic_event -> stderr_only`
