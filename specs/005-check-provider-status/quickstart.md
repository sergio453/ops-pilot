# Quickstart: Status de provedores externos

## Prerequisites

- Node.js 22 LTS
- Dependências instaladas com `npm install`
- Repositório na branch da feature `005-check-provider-status`

## 1) Validar gates obrigatórios de qualidade

```bash
npm run typecheck
npm test
```

**Expected outcome**:

- Typecheck sem erros
- Suíte de testes verde

## 2) Validar contrato da nova tool

Revisar o contrato funcional em
[contracts/provider-status-tool.md](./contracts/provider-status-tool.md).

**Expected outcome**:

- Entrada suporta `provider` opcional e valores suportados
- Saída define formato compacto em sucesso e falha final legível
- Política de timeout/retry está explícita

## 3) Validar modelo de dados lógico da feature

Revisar entidades e transições em [data-model.md](./data-model.md).

**Expected outcome**:

- Entidades cobrem entrada, resposta validada, resumo de sucesso e erro final
- Transições refletem tentativa inicial, retry único e encerramento da consulta

## 4) Executar cenários de teste da tool sem rede

Executar a suíte focada em tools:

```bash
npm test -- src/agents/tools.test.ts
```

**Expected outcome**:

- Cenário de sucesso da consulta com payload válido passa
- Cenário de timeout retorna mensagem legível e passa
- Cenário de payload inválido retorna mensagem legível e passa
- Nenhum cenário depende de chamada real à internet

## 5) Conferir que a feature não regrediu o conjunto atual de tools

Rodar a suíte completa:

```bash
npm test
```

**Expected outcome**:

- Tools existentes continuam com os mesmos nomes e contratos
- Nova tool entra no conjunto sem quebrar os fluxos atuais

## Latest Validation Result

- Date: 2026-10-16
- Commands:
  - `npm run typecheck`
  - `npm test`
- Result:
  - Typecheck: PASS
  - Tests: PASS (31 passed, 0 failed)
