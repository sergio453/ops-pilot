# Quickstart: Sumarização de Histórico Conversacional (Pruning)

**Feature**: `011-sumarizacao-historico-pruning`  
**Date**: 2026-10-30  

Este guia demonstra como testar e verificar a funcionalidade de sumarização de histórico em lote.

---

## 1. Executando os Testes Automatizados com Fake Summarizer

A suíte de testes unitários e de integração utiliza o `FakeConversationSummarizer`, garantindo testes ultrarrápidos e determinísticos sem chamadas à rede:

```bash
# Rodar testes do store de conversa (incluindo tabela conversation_summaries):
npx tsx --test src/store/sqlite-conversation-store.test.ts

# Rodar testes do serviço de sumarização:
npx tsx --test src/conversation/summarizer.test.ts

# Rodar testes do servidor HTTP (validando injeção de resumo no prompt e evento 'summarize'):
npx tsx --test src/http/server.test.ts
```

---

## 2. Testando o Comportamento em Diálogo Longo

Ao enviar mensagens sequenciais para uma mesma conversa:
- **Mensagens 1 a 15**: O endpoint `/chat` retorna normalmente com o histórico das últimas mensagens, sem emitir o evento `"summarize"`.
- **Mensagem 16**: Exatamente 8 mensagens saíram da janela recente de 8. O evento `"summarize"` é emitido, as 8 mensagens são compactadas em `conversation_summaries`.
- **Mensagem 17**: A requisição recebe a resposta com o prompt contendo a linha `SUMMARY: <resumo mesclado>`.

