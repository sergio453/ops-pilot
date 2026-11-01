# Contract: Ops tools for persisted operations

## Scope

Contratos funcionais das ferramentas de operação usadas pelo agente para consultar alertas,
incidentes e runbooks, além de abrir e resolver incidentes.

## Tool: `list_alerts`

- **Input**
  - `status`: `firing | resolved | all` (opcional, padrão `firing`)
- **Output**
  - `alerts`: coleção de alertas contendo `id`, `service`, `title`, `severity`, `status`
- **Behavior**
  - retorna apenas itens compatíveis com o filtro informado

## Tool: `open_incident`

- **Input**
  - `title`: texto obrigatório
  - `service`: identificador de serviço obrigatório
  - `severity`: `critical | high | medium | low`
- **Output**
  - `incident`: incidente criado contendo `id`, `title`, `service`, `severity`, `status`,
    `resolvedAt`
- **Behavior**
  - cria incidente com `status=open` e `resolvedAt=null`
  - falha com erro de domínio quando o serviço não existir

## Tool: `resolve_incident`

- **Input**
  - `id`: identificador de incidente obrigatório
- **Output**
  - `incident`: incidente atualizado
- **Behavior**
  - muda `status` para `resolved` e preenche timestamp de resolução
  - retorna erro de domínio quando o incidente não existir
  - manter estado resolvido em tentativas repetidas

## Tool: `list_incidents`

- **Input**
  - `status`: `open | resolved | all` (opcional, padrão `open`)
- **Output**
  - `incidents`: coleção de incidentes com `id`, `title`, `service`, `severity`, `status`,
    `resolvedAt`
- **Behavior**
  - retorna apenas itens compatíveis com o filtro informado

## Tool: `consultar_runbook`

- **Input**
  - `service`: identificador de serviço obrigatório
- **Output**
  - `runbook`: conteúdo de runbook do serviço
- **Behavior**
  - retorna erro de domínio quando serviço não existir
  - retorna erro de domínio quando serviço existir sem runbook cadastrado

## Domain constraints

- Campos de domínio fechado devem rejeitar valores fora dos conjuntos permitidos:
  - `tier`: conjunto fechado do domínio de serviço
  - `severity`: `critical | high | medium | low`
  - `status` de alerta: `firing | resolved`
  - `status` de incidente: `open | resolved`

## Baseline dataset contract

- Seed idempotente inicial deve prover:
  - 5 serviços
  - 6 alertas (`3 firing`, `3 resolved`)
  - runbooks para `checkout`, `payments`, `auth`
