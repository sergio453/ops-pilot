# Implementation Plan: Servidor MCP OpsPilot

**Branch**: `006-opspilot-mcp-server` | **Date**: 2026-10-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-opspilot-mcp-server/spec.md`

## Summary

Adicionar um servidor MCP chamado `opspilot` com transporte stdio e catálogo inicial de três
ferramentas (`list_alerts`, `open_incident`, `resolve_incident`), reaproveitando a mesma store
operacional e os mesmos schemas de validação já usados no agente. O plano inclui script de execução
dedicado e teste automatizado cobrindo a descoberta/listagem de tools, preservando stdout exclusivo
do protocolo e diagnóstico em stderr.

## Technical Context

**Language/Version**: TypeScript ESM (`strict: true`) em Node.js 22 LTS

**Primary Dependencies**: `@modelcontextprotocol/sdk`, `zod`, camada atual de tools do agente e
store operacional existente

**Storage**: SQLite via `SqliteOpsStore` com `OPSPILOT_DB` (mesma fonte operacional atual)

**Testing**: `node --test` via `tsx` (`npm test`) + `npm run typecheck`

**Target Platform**: Processo Node.js local/servidor executado por stdio para clientes MCP

**Project Type**: Backend agent/service com interface MCP adicional

**Performance Goals**: Descoberta de tools e chamadas básicas respondendo de forma interativa para
fluxo de triagem operacional

**Constraints**:
- stdout reservado ao tráfego MCP (sem `console.log` no servidor)
- mensagens de diagnóstico somente em stderr
- mesma fonte de verdade para validação e regras de domínio
- escopo inicial limitado a 3 tools MCP
- script npm dedicado para subir o servidor MCP

**Scale/Scope**: Um novo módulo `src/mcp/server.ts`, ajuste de script em `package.json` e testes
focados na listagem de tools do servidor

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Type-safe architecture and boundary validation**: PASS  
  O servidor MCP reutilizará os schemas zod existentes das tools, sem duplicação de contratos.
- **MVC and separation of responsibilities**: PASS  
  O servidor atua como borda de protocolo; regras de domínio e persistência seguem em store/tools.
- **Pure logic and explicit error handling**: PASS  
  Tratamento de erros será explícito na borda MCP, sem fallback silencioso e sem efeitos colaterais
  fora do fluxo esperado.
- **Test-first quality gates**: PASS  
  Há requisito de teste para validação do catálogo de tools, com manutenção de `npm test` e
  `npm run typecheck` verdes.
- **Secure and operationally safe development**: PASS  
  Não introduz leitura direta de `.env` no fluxo, e o canal stdio é preservado corretamente.

**Post-Design Re-check**: PASS. Artefatos de design mantêm os mesmos gates sem necessidade de
exceções.

## Project Structure

### Documentation (this feature)

```text
specs/006-opspilot-mcp-server/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── mcp-server-tools.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── agents/
│   ├── tools.ts
│   └── tools.test.ts
├── store/
│   └── sqlite-ops-store.ts
├── mcp/
│   ├── server.ts
│   └── server.test.ts
└── index.ts

package.json
```

**Structure Decision**: Projeto único Node/TypeScript. A feature introduz uma nova borda de
integração em `src/mcp/` e reaproveita regras e validações já existentes em `src/agents/tools.ts`,
mantendo persistência central em `src/store/sqlite-ops-store.ts`.

## Complexity Tracking

Nenhuma violação de constituição identificada; tabela de exceções não se aplica.
