# Research: Reflector de Aprendizado e Esquecimento de Preferências

**Feature**: `009-reflector-aprendizado`  
**Date**: 2026-10-30  

## Contexto e Desafio

No OpsPilot, o agente atualmente apenas armazena a mensagem bruta do usuário na memória semântica se `userId` for passado, o que causa poluição grave: comandos pontuais como *"reinicie o pod auth"* ou mensagens com senhas/tokens poderiam ser gravados como fatos.

A meta desta feature é:
1. **Reflector de aprendizado assíncrono**: Após cada resposta do `/chat`, um mecanismo baseado em `withStructuredOutput` lê a última mensagem do usuário e destila **fatos duráveis** (`{ hasLearning: boolean, fact?: string }`).
2. **Filtragem estrita**:
   - **NUNCA pedido pontual** (ex.: "liste os pods", "abra um incidente", "bom dia").
   - **NUNCA segredo** (senhas, API keys, tokens de autenticação).
   - Somente preferências de longo prazo e fatos duráveis (ex.: "minha região primária é us-east-1", "prefiro alertas formatados em Markdown").
3. **Persistência desacoplada**: Quando `hasLearning: true`, grava no `SqliteMemoryStore.remember(userId, fact)` de forma **assíncrona e não-bloqueante**, sem atrasar o retorno da requisição HTTP ao usuário.
4. **Tool `forget_preference`**: Ferramenta LangChain registrada nas ferramentas do agente que permite ao assistente esquecer preferências específicas sob comando do usuário, validando isolamento por `userId`.

---

## 1. Schema Estruturado do Reflector

Utilizando o método nativo de extração estruturada do LangChain (`withStructuredOutput` com Zod):

```typescript
import { z } from "zod";

export const learningSchema = z.object({
  hasLearning: z.boolean().describe(
    "True se e somente se a mensagem do usuário contiver uma preferência durável, convenção de trabalho ou fato de longo prazo sobre o ambiente ou usuário. False para pedidos pontuais, ordens transitórias, perguntas ou se contiver segredos/senhas."
  ),
  fact: z.string().optional().describe(
    "O fato durável destilado em formato declarativo conciso. OBRIGATÓRIO quando hasLearning é true. NUNCA inclua comandos pontuais, cumprimentos ou segredos."
  ),
});

export type LearningResult = z.infer<typeof learningSchema>;
```

---

## 2. Prompt do Reflector

```typescript
export const REFLECTOR_SYSTEM_PROMPT = `Você é um curador de memória de longo prazo para um assistente de operações de infraestrutura.
Sua missão é analisar a mensagem mais recente do usuário e determinar se há algum aprendizado durável a ser retido.

REGRAS ESTRITAS:
1. FATOS DURÁVEIS (hasLearning: true):
   - Preferências explícitas do operador (ex: "prefiro logs em formato JSON", "meu cluster padrão é production").
   - Fatos arquiteturais persistentes declarados pelo usuário (ex: "nosso cluster roda em us-east-1").
   - Convenções estáveis e duradouras de trabalho.
2. PEDIDOS PONTUAIS (hasLearning: false):
   - Comandos transitórios (ex: "reinicie o pod", "consulte o alerta X", "verifique a latência").
   - Perguntas efêmeras e saudações ("qual é o status?", "bom dia").
3. SEGREDOS E DADOS SENSÍVEIS (hasLearning: false):
   - Senhas, tokens, chaves de API, credenciais ou certificados. Se houver qualquer dado sensível, recuse imediatamente a memorização marcando hasLearning: false.
4. Se a mensagem mesclar um pedido pontual com um fato durável (ex: "reinicie o pod e lembre-se que sempre uso o cluster staging"), extraia APENAS o fato durável ("O usuário sempre utiliza o cluster staging") e ignore o comando imediato.`;
```

---

## 3. Disparo Assíncrono Não-Bloqueante

No handler do `POST /chat` em `src/http/server.ts`:

```typescript
// Envia resposta HTTP imediatamente após o término do agente
res.status(200).json({ ...result, ... });

// Dispara a reflexão em background sem bloquear o response
if (body.userId) {
  learningReflector.reflectAndRemember(body.userId, body.message).catch((err) => {
    console.error("Falha assíncrona no reflector de aprendizado:", err);
  });
}
```

---

## 4. Ferramenta `forget_preference`

Adicionada em `src/agents/tools.ts`:

```typescript
export function createForgetPreferenceTool(memoryStore: MemoryStore, currentUserId?: string) {
  return tool(
    async ({ memoryId, userId }) => {
      const targetUserId = userId || currentUserId;
      if (!targetUserId) {
        return "Erro: userId não fornecido para remoção da preferência.";
      }
      const success = await memoryStore.forget(targetUserId, memoryId);
      if (success) {
        return `Preferência ${memoryId} esquecida com sucesso.`;
      }
      return `Não foi possível esquecer a preferência ${memoryId}: registro não encontrado ou não pertence ao usuário.`;
    },
    {
      name: "forget_preference",
      description: "Remove permanentemente uma preferência ou fato durável da memória do usuário a partir do identificador da memória.",
      schema: z.object({
        memoryId: z.string().describe("ID da memória a ser removida"),
        userId: z.string().optional().describe("ID do usuário dono da preferência"),
      }),
    }
  );
}
```
