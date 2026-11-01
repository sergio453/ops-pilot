# Feature Specification: Grafo Unificado de Produção com Roteamento Dinâmico e Trace Granular

**Feature Branch**: `013-grafo-unificado-roteamento`

**Created**: 2026-10-30

**Status**: Draft

**Input**: User description: "Grafo unificado:
- production-graph.ts: nós contexto, roteador, as 3 estratégias como nós e resposta.
- Roteador: withStructuredOutput (route, reason); tabela no prompt, envio "route" e campo nodeem todo evento de trace.
- /chat: strategy opcional (se vier, é override no trace)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Execução do Grafo Unificado de Produção (Priority: P1) 🎯 MVP

Como operador do OpsPilot, quero enviar uma mensagem e ter o processamento orquestrado por um grafo unificado de ponta a ponta (nó de preparação de contexto, nó de roteamento inteligente, nó de execução da estratégia selecionada e nó de consolidação de resposta), para que o fluxo de atendimento seja modular, resiliente e transparente.

**Why this priority**: É o núcleo da arquitetura do sistema operacional do OpsPilot, unificando os componentes isolados em um pipeline orquestrado e determinístico.

**Independent Test**: Executar o grafo unificado fornecendo um prompt de usuário e validar a passagem pelos nós de contexto, roteador, a estratégia selecionada e o nó final de resposta com resposta e métricas válidas.

**Acceptance Scenarios**:

1. **Given** uma mensagem do usuário sem estratégia definida, **When** o grafo unificado é executado, **Then** o nó de contexto prepara os dados, o roteador determina o caminho adequado, a estratégia correspondente é executada e o nó de resposta consolida a resposta final.
2. **Given** uma execução em qualquer das 3 estratégias suportadas (`react`, `plan-and-execute`, `reflection`), **When** o nó correspondente conclui, **Then** a saída intermediária é repassada com sucesso ao nó de resposta sem perda de estado ou de métricas.

---

### User Story 2 - Roteamento Inteligente com Saída Estruturada e Tabela Decisória (Priority: P2)

Como operador, quero que o roteador utilize critérios objetivos de decisão (apresentados em formato de tabela no prompt do classificador) e retorne uma decisão estruturada (`route` e `reason`), para que a escolha entre raciocínio direto (ReAct), multi-passo estruturado (Plan-and-Execute) ou reflexivo com autocrítica (Reflection) seja consistente e justificada.

**Why this priority**: Evita chamadas caras ou excessivas quando tarefas simples são solicitadas e assegura deliberação profunda apenas onde há complexidade ou risco operacional.

**Independent Test**: Submeter mensagens de diferentes graus de complexidade (ex.: consulta simples de alerta vs. plano de remediação multi-passo vs. ação crítica de mitigação) e inspecionar a decisão estruturada retornada pelo nó roteador.

**Acceptance Scenarios**:

1. **Given** uma requisição de consulta pontual de status ou alerta único, **When** avaliada pelo roteador com a tabela de decisão, **Then** a rota selecionada é `react` acompanhada pela justificativa (`reason`).
2. **Given** uma tarefa de diagnóstico ou mitigação com múltiplas etapas interdependentes, **When** avaliada pelo roteador, **Then** a rota selecionada é `plan-and-execute` com a devida justificativa.
3. **Given** um cenário crítico de alta incerteza ou impacto severo que exija validação contra diretrizes de segurança, **When** avaliada pelo roteador, **Then** a rota selecionada é `reflection` com a respectiva justificativa.

---

### User Story 3 - Observabilidade Total com Evento `route` e Atribuição de `node` em Todo o Trace (Priority: P3)

Como engenheiro de confiabilidade e auditor de operações, quero que cada evento do trace registre explicitamente o nó do grafo em que ocorreu (`node`), além de receber um evento explícito do tipo `route`, para que eu possa auditar exatamente qual componente tomou cada decisão e passo de raciocínio.

**Why this priority**: Essencial para depuração, auditoria e conformidade em operações de infraestrutura, garantindo visibilidade clara da cadeia de raciocínio e transição entre nós.

**Independent Test**: Inspecionar os eventos de trace gerados ao final de uma requisição e conferir que 100% dos eventos contêm o identificador do nó emissor e que existe um evento específico documentando a decisão do roteador.

**Acceptance Scenarios**:

1. **Given** qualquer evento registrado no trace (pensamento, ação, observação, plano, crítica ou resposta), **When** o trace é inspecionado, **Then** a propriedade `node` está preenchida com o nome exato do nó gerador (ex.: `"contexto"`, `"roteador"`, `"react"`, `"plan-and-execute"`, `"reflection"`, `"resposta"`).
2. **Given** a execução do nó roteador, **When** a rota for definida, **Then** um evento específico indicando a rota escolhida e a justificativa é anexado ao trace.

---

### User Story 4 - Flexibilidade no `/chat` com `strategy` Opcional e Registro de Override (Priority: P4)

Como desenvolvedor ou operador usando o endpoint HTTP `POST /chat`, quero poder omitir o parâmetro `strategy` para deixar o sistema decidir autonomamente, ou informar uma estratégia explícita que sobreponha a decisão do roteador, com essa sobreposição devidamente sinalizada no trace.

**Why this priority**: Permite que clientes de produção deleguem o roteamento dinâmico sem abrir mão da capacidade de forçar estratégias específicas em testes, benchmarks e cenários controlados.

**Independent Test**: Executar requisições no endpoint `/chat` com e sem o parâmetro `strategy` e verificar se a ausência aciona o roteamento automático e se a presença força a estratégia indicada registrando o override no trace.

**Acceptance Scenarios**:

1. **Given** uma requisição `POST /chat` sem o campo `strategy`, **When** processada pela API, **Then** a requisição é aceita com sucesso (código 200) e o grafo seleciona a rota via nó roteador.
2. **Given** uma requisição `POST /chat` com `strategy: "plan-and-execute"`, **When** processada, **Then** a estratégia requisitada é executada compulsoriamente e o trace reflete que a decisão decorreu de um override explícito.
3. **Given** uma requisição `POST /chat` com uma estratégia inválida, **When** enviada, **Then** o sistema rejeita com erro de validação claro antes da invocação do grafo.

---

## Edge Cases

- **Falha ou recusa na saída estruturada do roteador**: Se a chamada estruturada do roteador falhar ou retornar uma rota inválida, o nó deve adotar um fallback seguro (padrão `react`) registrando a anomalia no trace sem interromper a resposta ao usuário.
- **Mensagem ambígua ou vazia no contexto**: Quando o contexto não contiver complexidade suficiente para justificar planejamento elaborado, o roteador deve preferir a estratégia de menor latência e custo (`react`).
- **Override com estratégia desconhecida**: Se o payload de `/chat` contiver um valor de estratégia desconhecido no override, o schema deve rejeitar na borda HTTP com erro 422/400 informando os valores válidos.
- **Exceção durante a execução de uma estratégia**: Se um dos nós de estratégia disparar erro interno, o nó de resposta ou o tratador de erro deve capturar o erro preservando os eventos de trace até aquele instante para fins de diagnóstico.
- **Eventos de trace pré-existentes ou aninhados**: Ferramentas e sub-etapas internas de uma estratégia que emitem eventos legados sem o campo `node` devem ter o atributo normalizado automaticamente para o nome do nó ativo da estratégia.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE definir o grafo de produção unificado em `production-graph.ts` contendo os nós: `contexto`, `roteador`, as três estratégias (`react`, `plan-and-execute`, `reflection`) e o nó de `resposta`.
- **FR-002**: O nó `contexto` DEVE orquestrar a recuperação e montagem do contexto orçado (histórico, memórias semânticas e diretrizes de sistema) antes da etapa de roteamento.
- **FR-003**: O nó `roteador` DEVE avaliar a mensagem e o contexto por meio de saída estruturada tipada (`withStructuredOutput`) retornando obrigatoriamente a rota (`route`) e a justificativa (`reason`).
- **FR-004**: As opções válidas de rota no roteador DEVEM ser estritamente restritas a: `"react"`, `"plan-and-execute"` e `"reflection"`.
- **FR-005**: O prompt do nó `roteador` DEVE conter explicitamente uma tabela descritiva de critérios determinando quando selecionar cada estratégia com base em complexidade, criticidade e necessidade de decomposição/revisão.
- **FR-006**: O sistema DEVE registrar no trace um evento do tipo `route` descrevendo a decisão de roteamento tomada e o motivo detalhado.
- **FR-007**: Todo evento de trace (`TraceEvent`) DEVE conter o campo `node`, identificando com precisão o nó do grafo responsável pela geração daquele evento.
- **FR-008**: O nó de `resposta` DEVE consolidar a recomendação final, as métricas agregadas (chamadas LLM, latência, tokens de contexto) e a trilha completa de eventos de trace originada dos nós antecedentes.
- **FR-009**: O endpoint `POST /chat` DEVE aceitar o campo `strategy` como opcional.
- **FR-010**: Quando o campo `strategy` for omitido na chamada HTTP, o sistema DEVE acionar o nó `roteador` para seleção autônoma da rota.
- **FR-011**: Quando o campo `strategy` for explicitamente informado na chamada HTTP, o sistema DEVE aplicar a estratégia fornecida como override, registrando no trace que a rota foi definida por override manual.
- **FR-012**: Todas as entradas e saídas de dados no grafo e na camada HTTP DEVEM ser estritamente validadas via esquemas `zod`.

### Key Entities

- **UnifiedGraphState**: Estado compartilhado do grafo, contendo mensagem do usuário, identificadores de conversa e usuário, contexto montado, histórico, rota selecionada, justificativa de roteamento, flag indicativa de override, eventos de trace acumulados, métricas agregadas e resposta final.
- **RouterOutput**: Estrutura de dados validada contendo a estratégia de destino (`route`: `"react" | "plan-and-execute" | "reflection"`) e a justificativa textual (`reason`).
- **EnrichedTraceEvent**: Extensão do evento de trace que garante a presença obrigatória do atributo `node` associado a cada etapa registrada, além do suporte ao tipo de evento de roteamento (`route`).
- **RoutingCriterion**: Registro da tabela de diretrizes de roteamento incorporada nas instruções do roteador, mapeando categorias de tarefas para as estratégias recomendadas.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em 100% das execuções do grafo unificado sem override, o nó roteador produz uma decisão válida com justificativa acompanhada do evento de trace correspondente.
- **SC-002**: 100% dos eventos registrados na cadeia de trace retornada ao cliente contêm a identificação correta do nó gerador no campo `node`.
- **SC-003**: Requisições com override explícito de estratégia são direcionadas à estratégia especificada em 100% dos casos de teste, registrando a marcação de override no trace.
- **SC-004**: Clientes HTTP conseguem obter respostas válidas no endpoint `/chat` sem necessidade de enviar o atributo `strategy` no corpo da requisição.
- **SC-005**: A transição e execução do fluxo unificado através de múltiplos nós não adiciona mais do que 15% de sobrecarga de latência em relação à execução isolada da estratégia correspondente.

## Assumptions

- O modelo configurado suporta saídas estruturadas com esquemas definidos via `withStructuredOutput`.
- As três estratégias existentes (`react`, `plan-and-execute`, `reflection`) podem ser instanciadas e integradas diretamente como nós ou passos subordinados do grafo sem quebrar compatibilidade com a arena ou testes legados.
- Caso ocorra timeout geral na requisição HTTP, o mecanismo de cancelamento e código 504 pré-existente no servidor continuará operando normalmente.
- O mapeamento de contexto e poda com orçamentos de tokens implementado na feature anterior (`buildContext`) é integralmente reutilizado no nó `contexto`.

