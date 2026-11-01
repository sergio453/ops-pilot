# Requirements Checklist: Sumarização de Histórico (Pruning)

**Feature**: `011-sumarizacao-historico-pruning`  
**Date**: 2026-10-30  
**Status**: Approved

## Requirements Quality Checklist

- [x] **Completeness**: Todos os requisitos do usuário foram mapeados em User Stories e Functional Requirements.
- [x] **Clarity**: As regras de disparo (lote de 8 mensagens que saíram da janela de 8 recentes, nunca por request) estão descritas sem ambiguidades.
- [x] **Consistency**: A nova tabela `conversation_summaries` complementa `conversations` e `messages` já existentes no SQLite.
- [x] **Testability**: O requisito explicita teste fake, permitindo verificação determinística e sem dependência de LLM externa.
- [x] **Scope**: Focado na poda e fusão de resumo em 150 tokens, preservando decisões, fatos e pendências.
- [x] **Architecture Alignment**: Respeita o Princípio IV (testes obrigatórios) e Princípio I da Constituição do projeto.

