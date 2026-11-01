# Research: Grafo Unificado de Produção com Roteamento Dinâmico

**Feature**: `013-grafo-unificado-roteamento`  
**Date**: 2026-10-30

## Context & Objectives

A arquitetura do OpsPilot possui três estratégias de raciocínio consolidadas:
1. `react`: Raciocínio direto baseado em observações e ferramentas em tempo real.
2. `plan-and-execute`: Decomposição estruturada em plano sequencial, execução e replanejamento.
3. `reflection`: Camada reflexiva (`withReflection`) que adiciona um crítico com autoavaliação e reiterações orientadas a feedback.

Atualmente, o endpoint `/chat` recebia `strategy` obrigatória (com default `react`) e acionava uma estratégia isolada fora de uma máquina de estados formal. Esta feature introduz `production-graph.ts`, um grafo unificado StateGraph do LangGraph que orquestra o ciclo completo de atendimento: `contexto` -> `roteador` -> [estratégia] -> `resposta`, garantindo rastreabilidade com atribuição do nó (`node`) a cada evento de trace e suporte a override opcional via `/chat`.

---

## Key Technical Decisions

### Decision 1: Orquestração do Grafo com LangGraph `StateGraph`
- **Decisão**: Utilizar `StateGraph` do `@langchain/langgraph` com anotações de estado (`Annotation.Root`) para definir a topologia determinística de nós e arestas condicionais.
- **Topologia**:
  - `START` -> `contexto` -> `roteador`
  - `roteador` -> aresta condicional avaliando `state.route`:
    - `"react"` -> nó `react`
    - `"plan-and-execute"` -> nó `plan-and-execute`
    - `"reflection"` -> nó `reflection`
  - Cada nó de estratégia -> `resposta` -> `END`.
- **Alternativas consideradas**:
  - *Função orquestradora imperativa (switch/case)*: Rejeitada porque perde a capacidade nativa de visualização de grafo, checkpoints de estado e padrão arquitetural do projeto baseado em LangGraph.
  - *Subgrafos aninhados dinâmicos*: Desnecessário para este estágio, pois as estratégias existentes já encapsulam suas iterações internas e podem ser executadas como nós de primeira classe.

### Decision 2: Estrutura do Roteador (`withStructuredOutput` e Tabela no Prompt)
- **Decisão**: Implementar a decisão de rota através de modelo com saída estruturada (`createStructuredModel(routerOutputSchema)` ou `model.withStructuredOutput(routerOutputSchema)`), guiado por uma tabela de critérios operacionais no prompt do sistema.
- **Esquema Zod do Roteador**:
  ```typescript
  export const routerOutputSchema = z.object({
    route: z.enum(["react", "plan-and-execute", "reflection"]),
    reason: z.string().min(1),
  });
  ```
- **Tabela no Prompt**:
  Apresenta três classes claras de incidentes/pedidos:
  1. Tarefas diretas/consultas pontuais (status, alertas firing, métricas) -> `react`.
  2. Tarefas multi-passo ou investigações encadeadas (diagnósticos correlacionados, mitigação em etapas) -> `plan-and-execute`.
  3. Ações críticas de alto risco ou alta incerteza (execução de runbooks críticos, alteração destrutiva) -> `reflection`.
- **Fallback**: Se a classificação estruturada falhar ou o modelo retornar formato inesperado, o roteador aplica fallback seguro para `react` e registra a anomalia no trace.

### Decision 3: Evento `route` e Atribuição do Campo `node` em Todo o Trace
- **Decisão**:
  - Expandir `TraceEventType` para incluir `"route"`.
  - Adicionar o atributo `node: string` em `TraceEvent`.
  - Assegurar que cada nó do grafo atribua seu respectivo nome (`"contexto"`, `"roteador"`, `"react"`, `"plan-and-execute"`, `"reflection"`, `"resposta"`) a todos os eventos gerados.
  - Eventos produzidos pelas estratégias subordinadas têm o campo `node` preenchido/enriquecido com o nome do nó ativo da estratégia.

### Decision 4: Tratamento de `strategy` Opcional e Override no Endpoint `/chat`
- **Decisão**:
  - No `requestSchema` do `/chat`, `strategy` passa a ser opcional (`z.string().trim().min(1).optional()`).
  - Se `strategy` estiver ausente: o grafo executa o nó `roteador` chamando a LLM estruturada com a tabela de decisão.
  - Se `strategy` estiver presente: o nó `roteador` identifica a intenção explícita de override, ignora a chamada LLM de classificação, fixa `route = strategy`, grava evento `"route"` com a justificativa de override (`"strategy override: [nome] (solicitado explicitamente)"`) e transiciona imediatamente para o nó correspondente.

---

## Best Practices & Safety

1. **Pureza e Isolamento dos Nós**: Cada nó recebe o estado consolidado e retorna apenas as alterações parciais (delta de estado), facilitando testes unitários isolados para cada nó.
2. **Compatibilidade com Camadas Anteriores**: A refatoração preserva as assinaturas existentes de `ReactReasoningStrategy`, `PlanAndExecuteReasoningStrategy` e `withReflection`, permitindo reuso direto e retrocompatibilidade com a arena e benchmarks.
3. **Validação Estrita de Limites**: O schema HTTP valida previamente valores permitidos de override, retornando 400/422 antes de iniciar a execução do grafo caso um nome de estratégia inválido seja enviado.

