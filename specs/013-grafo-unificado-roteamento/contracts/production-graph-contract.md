# Contract: Grafo Unificado de Produção e Endpoint `/chat`

**Feature**: `013-grafo-unificado-roteamento`  
**Date**: 2026-10-30

## 1. HTTP Interface: `POST /chat`

### Request Body (`application/json`)

| Campo | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `message` | `string` | Sim | - | Mensagem de operação/incidente do usuário. |
| `strategy` | `"react" \| "plan-and-execute" \| "reflection"` | Não | `undefined` | Se omitido, o roteador inteligente escolhe a estratégia. Se fornecido, força override. |
| `reflect` | `boolean` | Não | `false` | Se verdadeiro e estratégia não for reflect, ativa camada reflexiva. |
| `maxIterations` | `number` | Não | `6` | Teto de iterações para a estratégia de raciocínio. |
| `conversationId` | `string` | Não | UUID auto-gerado | Identificador único da sessão conversacional. |
| `userId` | `string` | Não | `undefined` | Identificador do usuário para recuperação de memórias semânticas. |

#### Exemplo de Chamada com Roteamento Dinâmico (Sem Strategy)
```json
{
  "message": "Quais serviços estão com alertas firing no momento?",
  "conversationId": "conv-1001",
  "userId": "ops-user-01"
}
```

#### Exemplo de Chamada com Override Explícito
```json
{
  "message": "Analise detalhadamente e execute o plano para o incidente INC-42",
  "strategy": "plan-and-execute",
  "conversationId": "conv-1002"
}
```

---

### Response Body (`application/json` - 200 OK)

```json
{
  "answer": "Identifiquei 2 alertas firing no serviço de pagamentos...",
  "conversationId": "conv-1001",
  "trace": [
    {
      "type": "route",
      "content": "route=react; reason=Consulta direta de status de alertas sem dependências multi-passo complexas",
      "node": "roteador"
    },
    {
      "type": "thought",
      "content": "Vou listar os alertas disparando usando a ferramenta get_alerts.",
      "node": "react"
    },
    {
      "type": "action",
      "content": "get_alerts {\"status\":\"firing\"}",
      "action": {
        "tool": "get_alerts",
        "args": { "status": "firing" }
      },
      "node": "react"
    },
    {
      "type": "observation",
      "content": "[{\"id\":\"alert-1\",\"service\":\"payments\",\"status\":\"firing\"}]",
      "node": "react"
    },
    {
      "type": "answer",
      "content": "Identifiquei 2 alertas firing no serviço de pagamentos...",
      "node": "resposta"
    }
  ],
  "metrics": {
    "llCalls": 2,
    "latencyMs": 1450,
    "historyMessages": 4,
    "memoryHits": 1,
    "contextBreakdown": {
      "memories": 45,
      "history": 120,
      "userMessage": 25,
      "totalEstimated": 190
    }
  }
}
```

---

## 2. Router Prompt & Criteria Table Contract

O prompt do sistema para o nó `roteador` segue rigorosamente o seguinte formato estruturado:

```text
Você é o Roteador de Operações do OpsPilot.
Sua função é analisar a mensagem do operador e o contexto disponível para selecionar a estratégia de raciocínio mais adequada.

Consulte a tabela de decisão abaixo para escolher a rota:

| Rota | Cenário Típico | Critérios de Decisão |
|---|---|---|
| react | Consultas diretas e ações pontuais | Perguntas objetivas, verificação de alertas firing, status de um único serviço ou comandos diretos sem encadeamento. |
| plan-and-execute | Diagnósticos amplos e tarefas multi-passo | Problemas que exigem decomposição em etapas sequenciais, correlação entre múltiplos serviços ou investigação estruturada. |
| reflection | Ações críticas e cenários de alta incerteza | Resoluções de incidentes graves, aplicação de runbooks com potenciais impactos colaterais ou tarefas que exigem validação prévia e autocrítica estrita. |

Retorne obrigatoriamente um objeto estruturado com:
- route: a rota escolhida ("react" | "plan-and-execute" | "reflection")
- reason: a justificativa clara relacionando a solicitação aos critérios da tabela.
```

---

## 3. Override Event Contract

Quando a propriedade `strategy` for fornecida na requisição HTTP ou na chamada direta ao grafo:
- O classificador LLM **não** é invocado.
- Um evento do tipo `route` é emitido com `node: "roteador"`.
- O conteúdo (`content`) do evento deve declarar explicitamente:
  `route=<nome_da_estratégia>; reason=Override explícito solicitado na requisição (ignorado classificador)`
- O estado registra `isOverride: true`.

