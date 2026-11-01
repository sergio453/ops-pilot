# Data Model: Persistência real de operações

## Entities

### Service

- **Fields**: `id`, `name`, `tier`
- **Purpose**: Representa um serviço monitorado pelo plantão.
- **Validation rules**:
  - `id` obrigatório e único
  - `name` obrigatório
  - `tier` obrigatório e restrito a domínio fechado

### Alert

- **Fields**: `id`, `service`, `title`, `severity`, `status`
- **Purpose**: Representa evento monitorado associado a um serviço.
- **Relationships**:
  - pertence a um `Service`
- **Validation rules**:
  - `id` obrigatório e único
  - `service` deve referenciar serviço existente
  - `severity` obrigatório e restrito a domínio fechado
  - `status` obrigatório e restrito a domínio fechado (`firing` ou `resolved`)

### Incident

- **Fields**: `id`, `title`, `service`, `severity`, `status`, `resolved_at`
- **Purpose**: Representa item formal de resposta operacional.
- **Relationships**:
  - pertence a um `Service`
- **Validation rules**:
  - `id` obrigatório e único com sequência previsível
  - `title` obrigatório
  - `service` deve referenciar serviço existente
  - `severity` obrigatório e restrito a domínio fechado
  - `status` obrigatório e restrito a domínio fechado (`open` ou `resolved`)
  - `resolved_at` é nulo enquanto `status=open` e preenchido quando `status=resolved`

### Runbook

- **Fields**: `service`, `content`
- **Purpose**: Procedimento operacional para diagnóstico/mitigação por serviço.
- **Relationships**:
  - relação um-para-um com `Service`
- **Validation rules**:
  - `service` obrigatório e único por runbook
  - `content` obrigatório e não vazio

## Derived Views / Query Shapes

### AlertList

- **Input**: filtro de status (`firing`, `resolved`, `all`)
- **Output**: coleção de `Alert` compatível com filtro

### IncidentList

- **Input**: filtro de status (`open`, `resolved`, `all`), padrão `open`
- **Output**: coleção de `Incident` compatível com filtro

### RunbookLookup

- **Input**: identificador de serviço
- **Output**: `Runbook` do serviço
- **Errors**:
  - serviço inexistente
  - serviço existente sem runbook

## State Transitions

### Incident lifecycle

- `open -> resolved` quando a resolução é executada com sucesso
- `resolved -> resolved` em nova tentativa de resolução (idempotência de estado)

### Error transitions

- `open-incident-request -> failed` para serviço inexistente
- `resolve-incident-request -> failed` para incidente inexistente
- `runbook-lookup-request -> failed` para serviço inexistente ou sem runbook
- `write-request -> failed` para violação de domínio fechado

## Seed Baseline

- Serviços: 5 registros
- Alertas: 6 registros (3 `firing`, 3 `resolved`)
- Runbooks: 3 registros (`checkout`, `payments`, `auth`)
- Incidentes: coleção inicial vazia
