# Research Notes: Servidor MCP OpsPilot

## Decision 1: Reaproveitar diretamente as tools já existentes como fonte de verdade

- **Decision**: O servidor MCP usará os mesmos handlers já expostos por `createAgentTools`, sem
  reimplementar regras de negócio para `list_alerts`, `open_incident` e `resolve_incident`.
- **Rationale**: Garante consistência de comportamento e validação entre agente e MCP, reduzindo
  risco de divergência funcional.
- **Alternatives considered**:
  - Reimplementar cada operação em módulo específico do servidor MCP.
  - Duplicar schemas de entrada/saída apenas para o protocolo MCP.
  - Criar camada paralela de serviço para MCP sem reutilização das tools.

## Decision 2: Instanciar `SqliteOpsStore` no servidor MCP

- **Decision**: O servidor MCP compartilhará a mesma implementação de store operacional (`OpsStore`)
  já usada pelos fluxos atuais.
- **Rationale**: Mantém uma única fonte de dados para alertas/incidentes e evita inconsistências de
  persistência entre canais.
- **Alternatives considered**:
  - Store em memória dedicada para MCP.
  - Nova implementação de repositório específica para MCP.
  - Persistência em arquivo ad hoc fora do store padrão.

## Decision 3: Transporte stdio com stdout estritamente reservado ao protocolo

- **Decision**: O servidor será inicializado com transporte stdio e não emitirá `console.log`; logs
  de diagnóstico, quando necessários, irão para stderr.
- **Rationale**: Em MCP via stdio, qualquer ruído no stdout quebra framing/protocolo e compromete a
  integração com o cliente.
- **Alternatives considered**:
  - Logar em stdout e filtrar no cliente.
  - Desabilitar completamente qualquer diagnóstico.
  - Trocar para outro transporte para evitar restrição de stdout.

## Decision 4: Contrato de listagem de tools validado por teste dedicado

- **Decision**: Criar teste automatizado focado no servidor MCP para validar o catálogo de tools
  anunciado.
- **Rationale**: A descoberta é pré-condição para qualquer cliente MCP; regressão aqui inviabiliza o
  uso do servidor mesmo com handlers corretos.
- **Alternatives considered**:
  - Validar apenas por teste manual com cliente MCP externo.
  - Cobrir somente execução de handlers sem testar listagem.
  - Confiar implicitamente no SDK sem teste de contrato local.

## Decision 5: Script npm dedicado para execução do servidor MCP

- **Decision**: Adicionar script `mcp` no `package.json` apontando para `tsx src/mcp/server.ts`,
  com variante de carregamento de ambiente apenas se necessário.
- **Rationale**: Padroniza inicialização local do servidor e simplifica integração com clientes MCP
  que esperam comando único de bootstrap.
- **Alternatives considered**:
  - Reusar script `dev`/`dev:env` com parâmetros extras.
  - Iniciar servidor MCP por comando manual fora de scripts npm.
  - Acoplar servidor MCP à inicialização HTTP existente.
