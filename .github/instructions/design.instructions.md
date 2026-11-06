---
applyTo: "web/**"
title: "Design Guidelines & UI Standards"
description: "Diretrizes de design para aplicações web: hierarquia, espaçamento, estados, dark mode e acessibilidade."
---

# Diretrizes de Design Web (OpsPilot)

Este documento estabelece os padrões e diretrizes de design de interface para todos os arquivos e componentes dentro de `web/**`. Siga rigorosamente estas especificações para garantir consistência visual, usabilidade e acessibilidade.

---

## 1. Hierarquia Tipográfica e Visual
A hierarquia deve guiar o olhar do usuário naturalmente pelo conteúdo, destacando o que é mais importante.

- **Escala Tipográfica (Modular Scale)**: Utilize tamanhos proporcionais baseados em uma escala consistente (ex: 12px, 14px, 16px, 20px, 24px, 32px, 40px, 48px).
- **Pesos de Fonte**:
  - `font-normal` (400) para textos correntes e descrições.
  - `font-medium` (500) ou `font-semibold` (600) para rótulos, subtítulos e elementos interativos.
  - `font-bold` (700) para títulos de seção e cabeçalhos principais (`h1`, `h2`).
- **Contraste**: Todo texto deve atender aos padrões WCAG AA de contraste em relação ao fundo (mínimo de 4.5:1 para textos normais e 3:1 para textos grandes).

---

## 2. Espaçamento em Escala (Spacing Scale)
Utilize uma escala baseada em múltiplos de 4px ou 8px para manter o ritmo visual e o alinhamento em grid.

- **Tokens de Espaçamento Recomendados**:
  - `0`: 0px
  - `1`: 4px (`0.25rem`)
  - `2`: 8px (`0.5rem`)
  - `3`: 12px (`0.75rem`)
  - `4`: 16px (`1rem`)
  - `6`: 24px (`1.5rem`)
  - `8`: 32px (`2rem`)
  - `12`: 48px (`3rem`)
  - `16`: 64px (`4rem`)
- **Consistência**: Espaçamentos internos de componentes (padding) e separações entre blocos (margin) devem respeitar estritamente esta escala.

---

## 3. Estados Vazios (Empty States) e de Erro (Error States)
Interfaces devem orientar o usuário claramente quando não houver dados ou quando algo der errado.

- **Estados Vazios (Empty States)**:
  - Devem conter um ícone ilustrativo ou visual descritivo.
  - Um título claro explicando a situação (ex: "Nenhum alerta encontrado").
  - Uma breve descrição orientando a próxima ação (ex: "Crie um novo alerta ou ajuste os filtros de busca").
  - Uma chamada para ação (CTA) primária visível (ex: "Criar Alerta").
- **Estados de Erro (Error States)**:
  - Mensagens de erro devem ser diretas, compreensíveis e livres de códigos crípticos de sistema para o usuário final.
  - Incluir ações de recuperação claras (ex: botão "Tentar novamente", "Voltar ao início" ou links de suporte).
  - Destacar visualmente com cores indicativas de erro (ex: tons de vermelho/destrutivo), garantindo contraste adequado.

---

## 4. Suporte a Dark Mode
O suporte a temas claro e escuro é obrigatório para reduzir a fadiga visual e atender às preferências do usuário.

- **Variáveis Semânticas**: Nunca utilize cores hardcoded (ex: `#FFFFFF` direto no fundo). Utilize tokens de design / variáveis CSS (ex: `background-primary`, `text-primary`, `border-color`).
- **Contraste no Dark Mode**: Verifique se o contraste de textos e bordas permanece em conformidade com as diretrizes de acessibilidade em superfícies escuras.
- **Transições**: Ao alternar entre temas, utilize transições suaves (ex: `transition-colors duration-200`) quando aplicável.

---

## 5. Acessibilidade (a11y)
A acessibilidade não é opcional; garante que todos os usuários possam utilizar o sistema.

- **Navegação por Teclado**: Todos os elementos interativos (botões, links, inputs, modais) devem ser acessíveis via tecla `Tab` e possuir indicadores de foco visíveis (`focus-visible:ring-2`).
- **Atributos ARIA**: Utilize papéis (`role`), estados (`aria-expanded`, `aria-selected`) e rótulos (`aria-label`, `aria-describedby`) adequados em componentes customizados.
- **Textos Alternativos**: Imagens informativas devem obrigatoriamente possuir descrições em `alt`. Imagens puramente decorativas devem ter `alt=""`.
- **Hierarquia de Cabeçalhos**: Respeite a ordem lógica de cabeçalhos (`h1` -> `h2` -> `h3`) sem saltar níveis.
