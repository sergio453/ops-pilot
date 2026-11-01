# Quickstart: Reflector de Aprendizado e Esquecimento de Preferências

**Feature**: `009-reflector-aprendizado`  
**Date**: 2026-10-30  

Este guia demonstra como validar a destilação de preferências duráveis e o esquecimento de memórias.

---

## 1. Testes Automatizados com Fake Reflector & Fake MemoryStore

```bash
# Rodar testes do módulo de reflexão:
npx tsx --test src/memory/learning-reflector.test.ts

# Rodar testes da tool forget_preference:
npx tsx --test src/agents/tools.test.ts

# Rodar testes integrados do servidor HTTP:
npx tsx --test src/http/server.test.ts
```

---

## 2. Cenários de Uso

### Declaração de Preferência Durável
1. Usuário envia: `"Meu namespace preferido para deploys é payments-prod"`
2. Servidor responde imediatamente ao chat.
3. Em background, o reflector avalia `hasLearning: true` e grava a preferência em `memories`.
4. Em turnos futuros, a memória é recuperada no recall semântico.

### Descarte de Pedido Pontual
1. Usuário envia: `"Reinicie o container do nginx agora"`
2. O reflector avalia `hasLearning: false` e não grava nada.

### Esquecimento de Preferência
1. Usuário solicita: `"Esqueça a preferência de namespace"`
2. O agente chama a tool `forget_preference(memoryId)` e remove o registro.
