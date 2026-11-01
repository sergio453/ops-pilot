# Implementation Plan: Status de provedores externos

**Branch**: `005-check-provider-status` | **Date**: 2026-10-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-check-provider-status/spec.md`

## Summary

Adicionar uma nova tool de diagnóstico para consultar status operacional público de provedores
externos (GitHub e Cloudflare), com retorno compacto em uma linha, timeout por tentativa e política
de uma única nova tentativa para falhas transitórias. O plano preserva o padrão atual de validação
com `zod`, não propaga exceções para fora da tool e inclui testes determinísticos com fetch injetável
para cobrir sucesso, timeout e resposta inválida sem uso de rede real.

## Technical Context

**Language/Version**: TypeScript ESM (`strict: true`) em Node.js 22 LTS

**Primary Dependencies**: `zod`, `@langchain/core` (tooling do agente), runtime padrão de `fetch`
do Node, stack atual de agent orchestration

**Storage**: N/A (consulta externa sem persistência de estado)

**Testing**: `node --test` via `tsx` (`npm test`) + `npm run typecheck`

**Target Platform**: Runtime Node.js local/dev para uso no agente de plantão

**Project Type**: Aplicação backend/agent com tools operacionais

**Performance Goals**: Cada tentativa concluída em até 5 segundos, mantendo resposta operacional
rápida para triagem

**Constraints**:
- timeout rígido por tentativa
- no máximo 2 tentativas totais (1 inicial + 1 retry)
- retorno de sucesso sempre compacto em uma linha
- erro final sempre legível e retornado como resultado da tool
- sem exceção vazando para fora da tool
- testes sem acesso à internet usando fetch injetável

**Scale/Scope**: Uma nova tool em `src/agents/tools.ts`, com suporte a 2 provedores e 3 cenários
de teste críticos

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Type-safe architecture and boundary validation**: PASS  
  Entrada (`provider`) e resposta externa serão validadas explicitamente com `zod`.
- **MVC and separation of responsibilities**: PASS  
  Tool encapsula integração externa; regra de retry/timeout não invade outras camadas.
- **Pure logic and explicit error handling**: PASS  
  Política de decisão (URLs, retry, formatação) pode ser extraída em funções puras e erros são
  tratados explicitamente em retorno observável.
- **Test-first quality gates**: PASS  
  Escopo inclui testes automatizados para sucesso, timeout e payload inválido, mantendo gates verdes.
- **Secure and operationally safe development**: PASS  
  Consulta usa endpoint público sem segredo; falhas retornam mensagem operacional clara sem vazar
  dados sensíveis.

**Post-Design Re-check**: PASS. Artefatos de design mantêm os mesmos gates sem exceções.

## Project Structure

### Documentation (this feature)

```text
specs/005-check-provider-status/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── provider-status-tool.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── agents/
│   ├── tools.ts
│   ├── tools.test.ts
│   └── errors.ts
├── arena.ts
├── bench.ts
└── index.ts
```

**Structure Decision**: Projeto único Node/TypeScript. A feature fica concentrada em
`src/agents/tools.ts` (nova tool + schema + lógica resiliente) e `src/agents/tools.test.ts`
(testes determinísticos com fake fetch), sem mudanças estruturais em persistência.

## Complexity Tracking

Nenhuma violação de constituição identificada; tabela de exceções não se aplica.
