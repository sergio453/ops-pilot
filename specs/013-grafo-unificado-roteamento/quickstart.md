# Quickstart: Validação do Grafo Unificado de Produção

**Feature**: `013-grafo-unificado-roteamento`  
**Date**: 2026-10-30

Este guia descreve os passos práticos para validar ponta a ponta o grafo unificado, o roteador dinâmico, o enriquecimento de trace com `node` e os overrides via `/chat`.

---

## Pré-requisitos

1. Dependências do projeto instaladas (`npm install`).
2. Configuração de ambiente OpenRouter para testes com LLM real (`.env` ou variáveis de ambiente), ou uso de mocks/fakes nos testes unitários e de integração.

---

## Cenário 1: Execução com Roteamento Dinâmico (Sem Strategy)

Objetivo: Demonstrar que o servidor aceita chamadas sem `strategy`, aciona o roteador com saída estruturada e inclui o evento `route` com `node: "roteador"`.

### Comando de Teste HTTP
```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Quais alertas firing temos no momento?",
    "conversationId": "test-dynamic-routing"
  }'
```

### Validações Esperadas
1. Status HTTP `200 OK`.
2. O array `trace` contém um primeiro evento com:
   - `type: "route"`
   - `node: "roteador"`
   - `content` mencionando a rota escolhida (ex.: `route=react`) e a justificativa baseada na tabela de decisão.
3. Todos os demais eventos de trace possuem a propriedade `node` preenchida (ex.: `"react"`, `"resposta"`).

---

## Cenário 2: Execução com Override Explícito de Estratégia

Objetivo: Demonstrar que passar `strategy` no corpo força a rota correspondente e registra a marcação de override no trace sem invocar o classificador.

### Comando de Teste HTTP
```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Quais alertas firing temos no momento?",
    "strategy": "plan-and-execute",
    "conversationId": "test-override-routing"
  }'
```

### Validações Esperadas
1. Status HTTP `200 OK`.
2. O trace registra o evento `route` indicando que houve override:
   - `type: "route"`
   - `node: "roteador"`
   - `content` contendo `route=plan-and-execute` e menção a override explícito.
3. Os eventos de planejamento e passos subsequentes contêm `node: "plan-and-execute"`.

---

## Cenário 3: Validação Automatizada de Testes e Tipos

Execute as verificações do ciclo de desenvolvimento para garantir conformidade contínua:

```bash
# Executa a suíte de testes unitários e de integração
npm test

# Executa checagem de tipos TypeScript estrita
npm run typecheck
```

Critério de aprovação: Suíte de testes 100% verde e zero erros de tipagem.

