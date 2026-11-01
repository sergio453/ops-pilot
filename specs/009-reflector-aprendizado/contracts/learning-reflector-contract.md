# Contracts: Reflector de Aprendizado e Esquecimento de Preferências

**Feature**: `009-reflector-aprendizado`  
**Date**: 2026-10-30  

## 1. Contrato da Interface `LearningReflector`

```typescript
export interface LearningResult {
  hasLearning: boolean;
  fact?: string;
}

export interface LearningReflector {
  reflect(userMessage: string): Promise<LearningResult>;
  reflectAndRemember(userId: string, userMessage: string): Promise<void>;
}
```

- `reflect(userMessage)`:
  - Invoca `withStructuredOutput(learningSchema)`.
  - Retorna `{ hasLearning: false }` para comandos transitórios, saudações ou senhas/segredos.
  - Retorna `{ hasLearning: true, fact: "..." }` para preferências e fatos estáveis.
- `reflectAndRemember(userId, userMessage)`:
  - Executa `reflect(userMessage)`.
  - Se `hasLearning` for verdadeiro e `fact` estiver preenchido, chama `memoryStore.remember(userId, fact)`.
  - Captura qualquer falha silenciosamente com log defensivo.

---

## 2. Contrato da Tool LangChain `forget_preference`

- **Nome**: `forget_preference`
- **Schema Zod**:
  ```typescript
  z.object({
    memoryId: z.string().describe("ID da memória ou preferência a ser removida"),
    userId: z.string().optional().describe("ID do usuário dono da preferência"),
  })
  ```
- **Retorno**: Confirmação textual de remoção ou mensagem de erro explicativa caso não pertença ao usuário.
