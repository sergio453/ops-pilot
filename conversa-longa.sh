#!/usr/bin/env bash
# conversa-longa.sh — Simula uma conversa multi-turno e imprime promptTokens por turno.
# Uso: PORT=3000 ./conversa-longa.sh
set -euo pipefail

PORT="${PORT:-3000}"
BASE_URL="http://localhost:${PORT}/chat"

# Gera UUID compatível com bash puro ou com uuidgen
if command -v uuidgen &>/dev/null; then
  CONV_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
else
  CONV_ID=$(cat /proc/sys/kernel/random/uuid 2>/dev/null || date +%s%N | sha256sum | head -c 36)
fi

MESSAGES=(
  "Olá, sou o operador do cluster de produção."
  "Qual é o status dos alertas críticos?"
  "Quais runbooks você recomenda para esse cenário?"
  "Obrigado. Pode resumir as ações prioritárias?"
)

echo "=== Iniciando Conversa Longa (ID: ${CONV_ID}) ==="
echo "Servidor: ${BASE_URL}"
echo ""

for i in "${!MESSAGES[@]}"; do
  TURNO=$((i + 1))
  MSG="${MESSAGES[$i]}"
  echo "[Turno ${TURNO}] Mensagem: \"${MSG}\""

  RESP=$(curl -sf -X POST "${BASE_URL}" \
    -H "Content-Type: application/json" \
    -d "{\"message\": $(printf '%s' "${MSG}" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))'), \"conversationId\": \"${CONV_ID}\"}" \
    || { echo "  ERRO: servidor indisponível em ${BASE_URL}"; exit 1; })

  # Extrai promptTokens do JSON de resposta
  PT=$(printf '%s' "${RESP}" | python3 -c "
import json, sys
data = json.load(sys.stdin)
metrics = data.get('metrics', {})
print(metrics.get('promptTokens', 0))
" 2>/dev/null || echo "N/A")

  CB_TOTAL=$(printf '%s' "${RESP}" | python3 -c "
import json, sys
data = json.load(sys.stdin)
cb = data.get('metrics', {}).get('contextBreakdown', {})
print(cb.get('totalEstimated', 'N/A'))
" 2>/dev/null || echo "N/A")

  echo "  promptTokens (real LLM) : ${PT}"
  echo "  contextBreakdown.total  : ${CB_TOTAL} (estimado)"
  echo ""
done

echo "=== Conversa concluída ==="

