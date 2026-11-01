# Quickstart: Persistência real de operações

## Prerequisites

- Node.js 22 LTS
- Dependências instaladas com `npm install`
- Repositório na branch da feature `004-sqlite-ops-store`

## 1) Validar gates obrigatórios de qualidade

```bash
npm run typecheck
npm test
```

**Expected outcome**:

- Validação de tipos sem erros
- Suíte de testes verde

## 2) Validar seed operacional padrão

```bash
npm run dev -- seed-story
```

**Expected outcome**:

- Cenário de seed reporta 5 serviços, 6 alertas e 0 incidentes no estado inicial.

## 3) Validar cenários determinísticos de benchmark

```bash
npm run bench -- --scenario c1,c2,c3
```

**Expected outcome**:

- Todas as execuções terminam sem falhas de parsing/execução
- Cenários usam dataset previsível e retornam resultados comparáveis entre execuções

## 4) Validar comportamento de listagem e ciclo de incidente

Executar a suíte de testes focada em tools e store:

```bash
npm test -- src/agents/tools.test.ts
```

**Expected outcome**:

- Cobertura do fluxo abrir/listar/resolver incidente
- Cobertura de filtros de incidentes e alertas
- Cobertura de consulta de runbook por serviço
- Cobertura de erros de domínio para serviço/runbook/incidente inexistentes

## 5) Validar contratos e modelo de dados

- Revisar contrato funcional em [contracts/ops-tools.md](./contracts/ops-tools.md)
- Revisar modelo de entidades e transições em [data-model.md](./data-model.md)

**Expected outcome**:

- Entradas, saídas e erros esperados das tools estão alinhados com requisitos funcionais
- Regras de estado e validação de domínio estão consistentes

## Latest Validation Result

- Date: 2026-10-14
- Commands:
  - `npm run typecheck`
  - `npm test`
- Result:
  - Typecheck: PASS
  - Tests: PASS (26 passed, 0 failed)
