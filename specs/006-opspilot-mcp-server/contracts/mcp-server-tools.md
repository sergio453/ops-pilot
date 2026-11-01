# Contract: OpsPilot MCP server tools

## Scope

Contrato funcional do servidor MCP `opspilot`, cobrindo descoberta e invocação das tools
`list_alerts`, `open_incident` e `resolve_incident`.

## Server identity

- **Server name**: `opspilot`
- **Transport**: stdio
- **Startup command**: `npm run mcp`
- **IO rule**:
  - stdout reservado ao protocolo MCP
  - diagnóstico e troubleshooting em stderr

## Tool catalog contract

Em descoberta de tools, o servidor deve anunciar exatamente:

1. `list_alerts`
2. `open_incident`
3. `resolve_incident`

## Tool: `list_alerts`

- **Input**
  - `status`: filtro opcional (`firing | resolved | all`, conforme contrato vigente)
- **Output**
  - objeto serializado contendo `alerts` com a coleção resultante
- **Behavior**
  - reutiliza validação e regras de listagem já existentes
  - aceita coleção vazia como resposta válida

## Tool: `open_incident`

- **Input**
  - `title`: string não vazia
  - `service`: string não vazia de serviço conhecido
  - `severity`: severidade operacional suportada
- **Output**
  - objeto serializado contendo `incident` recém-criado
- **Behavior**
  - reutiliza validação e regra de criação existentes
  - persiste no mesmo store operacional usado pelos demais canais

## Tool: `resolve_incident`

- **Input**
  - `id`: identificador não vazio de incidente
- **Output**
  - objeto serializado contendo `incident` após resolução
- **Behavior**
  - reutiliza validação e regra de resolução existentes
  - retorna erro explícito quando incidente não existe

## Error semantics

- Entradas inválidas: erro explícito de validação para o cliente MCP.
- Falhas de domínio (serviço/incidente inexistente): erro explícito sem mascaramento silencioso.
- Falhas de persistência: erro explícito para diagnóstico operacional.
- Erro de ferramenta no payload MCP: `isError: true` com mensagem textual no formato
  `<tool> falhou: <motivo>`.

## Test contract

- Deve existir teste automatizado para o servidor MCP validando o catálogo de tools anunciado.
- O teste deve falhar se:
  - qualquer tool esperada estiver ausente;
  - tools extras forem anunciadas no escopo inicial da feature;
  - houver quebra no fluxo de descoberta.
