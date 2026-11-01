# Implementation Plan: Conversa persistente no chat

**Branch**: `007-conversa-persistente-chat` | **Date**: 2026-10-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-conversa-persistente-chat/spec.md`

## Summary

Introduzir persistência de conversas no endpoint `/chat` para manter contexto entre chamadas,
incluindo `conversationId` opcional na entrada/saída, composição do prompt com até 12 mensagens
anteriores em ordem cronológica e métrica `historyMessages` para observabilidade do contexto
aplicado, mantendo os contratos atuais de erro e validação.

## Technical Context

**Language/Version**: TypeScript ESM (`strict: true`) em Node.js 22 LTS

**Primary Dependencies**: `express`, `zod`, `node:sqlite` (`DatabaseSync`), estratégias existentes
de raciocínio em `src/agents/`

**Storage**: SQLite com `OPSPILOT_DB` (padrão `./data/opspilot.db`) e suporte a `:memory:` para
testes

**Testing**: `node --test` via `tsx` (`npm test`) + `npm run typecheck`

**Target Platform**: Serviço HTTP Node.js local/servidor

**Project Type**: Backend web-service

**Performance Goals**: Requisições de chat com histórico limitado a 12 mensagens para manter latência
operacional previsível

**Constraints**:
- manter compatibilidade dos erros existentes (`400`, `422`, `504`)
- persistir somente mensagem de usuário e resposta final do assistente
- usar histórico apenas da conversa corrente
- preservar comportamento determinístico de testes sem rede

**Scale/Scope**: Alterações concentradas em store de conversa SQLite, endpoint `/chat` e testes
relacionados

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Type-safe architecture and boundary validation**: PASS  
  Entrada HTTP continua validada com `zod`; contratos de conversa definidos explicitamente.
- **MVC and separation of responsibilities**: PASS  
  Persistência isolada em store dedicada; endpoint mantém papel de borda de protocolo.
- **Pure logic and explicit error handling**: PASS  
  Composição de prompt é função determinística; erros seguem respostas explícitas já estabelecidas.
- **Test-first quality gates**: PASS  
  Requisito cobre testes focados com `:memory:` e fake, além de typecheck.
- **Secure and operationally safe development**: PASS  
  Não há leitura direta de `.env`; persistência segue configuração padrão do projeto.

**Post-Design Re-check**: PASS. Os artefatos de pesquisa e design mantêm aderência total à
constituição, sem exceções.

## Project Structure

### Documentation (this feature)

```text
specs/007-conversa-persistente-chat/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── chat-conversation-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── http/
│   ├── server.ts
│   └── server.test.ts
├── store/
│   ├── sqlite-ops-store.ts
│   ├── sqlite-conversation-store.ts
│   └── sqlite-conversation-store.test.ts
└── agents/
    └── types.ts
```

**Structure Decision**: Projeto único Node/TypeScript. A feature adiciona model/store de conversa
em `src/store/` e integra o fluxo no controller HTTP existente em `src/http/server.ts`, com
validação via testes focados em `src/http/server.test.ts` e `src/store/sqlite-conversation-store.test.ts`.

## Complexity Tracking

Nenhuma violação de constituição identificada; tabela de exceções não se aplica.
