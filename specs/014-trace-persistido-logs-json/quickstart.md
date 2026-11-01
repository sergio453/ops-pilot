# Quickstart: Trace Persistido + Logs JSON

Guia de validação ponta a ponta da feature `014-trace-persistido-logs-json`.

## Validação automatizada sem provedor

```bash
node --import tsx --test src/http/request-trace.test.ts src/http/server.test.ts src/store/sqlite-request-trace-store.test.ts src/obs/logger.test.ts src/obs/request-trace-service.test.ts src/agents/trace.test.ts src/agents/streaming.test.ts
npm test
npm run typecheck
```

Os testes HTTP usam estratégias falsas e SQLite em memória ou arquivo temporário; o teste de reinício encerra o servidor e o store, reabre o mesmo banco e compara o GET histórico com a resposta anterior. Os testes de store também fecham e reabrem o banco para verificar durabilidade, métricas e payloads. Não há chamadas a modelos externos nem download de embeddings nestes testes novos.

Cobertura de aceitação: correlação em sucesso/400/422/500/504 e JSON malformado, IDs concorrentes distintos, leitura enquanto `running`, eventos parciais após erro/timeout, callbacks tardios ignorados, falha de persistência explícita, allowlist de log, ordem por sequência com timestamps empatados, 404 e ID inválido. Testes de estratégias verificam publicação incremental e equivalência com o trace final, incluindo reflexão sem duplicação.

## Configuração para smoke test manual com provedor

O servidor real exige `OPENROUTER_API_KEY` e `OPENROUTER_MODEL` exportados no ambiente para executar a estratégia. Alternativamente, o comando existente `npm run dev:http:env` delega o carregamento do arquivo de ambiente ao Node. Não imprimir credenciais em logs.

Para validar persistência entre reinícios, usar um arquivo, não `:memory:`. Em PowerShell:

```powershell
$env:OPSPILOT_DB = './data/trace-validation.db'
npm run dev:http
```

Em outro terminal:

```powershell
$chat = Invoke-WebRequest -Uri 'http://localhost:3000/chat' -Method Post -ContentType 'application/json' -Body '{"message":"status dos alertas","strategy":"react"}'
$body = $chat.Content | ConvertFrom-Json
$body.requestId -eq $chat.Headers['X-Request_Id'][0]
$requestId = $body.requestId
Invoke-RestMethod -Uri "http://localhost:3000/requests/$requestId"
```

Encerrar e iniciar novamente o servidor com o mesmo `OPSPILOT_DB`, mantendo `$requestId` no segundo terminal. Repetir o GET: métricas, payloads e ordenação devem permanecer iguais. O uso de `:memory:` limita a persistência à instância do store.

## Prerequisites

- Node.js 22+
- Dependências instaladas (`npm install`)
- Ambiente com banco SQLite configurável via `OPSPILOT_DB` (recomendado `:memory:` para testes locais automatizados)

## 1) Subir servidor HTTP

```bash
npm run dev:http
```

Servidor esperado em `http://localhost:3000` (ou porta configurada por `PORT`).

## 2) Executar chamada `/chat` e validar `requestId`

```bash
curl -i -X POST http://localhost:3000/chat \
  -H "content-type: application/json" \
  -d '{"message":"status dos alertas","strategy":"react"}'
```

**Validar:**

- Cabeçalho `X-Request_Id` presente.
- Campo `requestId` presente no body.
- Valor do header igual ao valor no body.

## 3) Validar persistência de request + trace

1. Capture o `requestId` retornado no passo anterior.
2. Chame:

```bash
curl -s http://localhost:3000/requests/<REQUEST_ID>
```

**Validar:**

- Objeto `request` retornado com métricas.
- Lista `trace` retornada.
- Ordem de `trace` estável por `eventIndex` crescente.

## 4) Validar not-found

```bash
curl -i http://localhost:3000/requests/request-id-inexistente
```

**Validar:**

- Status `404`.
- Resposta explícita de não encontrado sem dados parciais de trace.

## 5) Validar logging estruturado (JSONL)

Durante chamadas de `/chat`, inspecione saída de log da aplicação.

**Validar:**

- Uma linha JSON por evento.
- Apenas metadados permitidos (sem payload sensível completo).
- Campos canônicos mínimos: `requestId`, `eventIndex`, `eventType`, `node`, `timestamp`.
- Há também uma linha operacional `eventType: done`, `node: resposta`, com `status`, `route` e `tokens` conhecidos. Filtrar `eventType != done` ao comparar a quantidade de linhas de trace com `traceCount`; `done` não é outro evento persistido. Nem requisição bruta, conteúdo nem payload aparecem no log.

## 6) Rodar suíte de verificação

```bash
npm test
npm run typecheck
```

**Validar:**

- Testes cobrindo: `requestId` em body/header, persistência `requests`/`trace_events`, ordenação de trace e `404` em `GET /requests/:id`.
- Tipagem sem erros.

## Referências

- Contratos: [contracts/request-trace-contract.md](./contracts/request-trace-contract.md)
- Modelo de dados: [data-model.md](./data-model.md)
- Especificação: [spec.md](./spec.md)

## Evidências e limites de validação

- Baseline antes da implementação: `npm test` com 73/73 testes aprovados; `npm run typecheck` aprovado.
- Os novos testes foram executados inicialmente sem os módulos de observabilidade e falharam por módulo ausente; após implementação, a rodada focada de HTTP/store/logger/serviço/trace passou 25/25 e a rodada de streaming das estratégias passou 3/3.
- Validação final em 2026-11-01: `npm test` passou 90/90 testes. Após acrescentar a regressão de reinício completo e ajustar a correlação nas variantes de caminho aceitas pelo Express, a rodada final de `src/http/request-trace.test.ts` e `src/agents/streaming.test.ts` passou 10/10 (incluindo o novo teste de reinício), e `npm run typecheck` passou. O teste de reinício isolado também passou 1/1. Há 91 testes no conjunto final; a suíte integral executada continha 90 e a inclusão posterior foi validada pela rodada focada, sem repetir toda a suíte.
- O teste de durabilidade inclui a verificação de lookup < 500 ms após reabrir banco temporário com um evento; esse cenário passou. Isso não demonstra desempenho em carga de produção.
- Smoke test manual com provedor e amostragem de produção não foram executados nesta sessão. Os cenários locais usam estratégias determinísticas.
- Para SC-002, coletar uma amostra de respostas reais de sucesso (IDs e quantidade de eventos esperada), consultar cada ID após conclusão/reinício e calcular a fração com registro, métricas e trace íntegro. A meta é >= 99%; registrar tamanho da amostra, intervalo e falhas observadas. Não interpretar sucesso em testes locais como medição de produção.
