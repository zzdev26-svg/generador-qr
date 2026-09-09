#!/usr/bin/env bash
# Diagnóstico para conectar-hostinger-mcp (macOS / Linux)
# Salida pensada para que la lea Claude, no el usuario final.

echo "== Sistema =="
uname -a

echo ""
echo "== Node.js =="
if command -v node >/dev/null 2>&1; then
  NODE_VERSION=$(node -v)
  echo "node: $NODE_VERSION"
  MAJOR=$(echo "$NODE_VERSION" | sed 's/^v//' | cut -d. -f1)
  if [ "$MAJOR" -ge 24 ]; then
    echo "node_ok: true"
  else
    echo "node_ok: false (se necesita v24 o superior)"
  fi
else
  echo "node: NOT_FOUND"
  echo "node_ok: false"
fi

echo ""
echo "== npm =="
if command -v npm >/dev/null 2>&1; then
  echo "npm: $(npm -v)"
else
  echo "npm: NOT_FOUND"
fi

echo ""
echo "== nvm =="
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  echo "nvm: instalado"
else
  echo "nvm: NOT_FOUND"
fi

echo ""
echo "== Claude Code CLI =="
if command -v claude >/dev/null 2>&1; then
  echo "claude: $(claude --version 2>/dev/null || echo 'presente, version no disponible')"
else
  echo "claude: NOT_FOUND"
fi

echo ""
echo "== hostinger-api-mcp =="
if command -v hostinger-api-mcp >/dev/null 2>&1; then
  echo "hostinger-api-mcp: instalado globalmente"
else
  echo "hostinger-api-mcp: NOT_FOUND"
fi

echo ""
echo "== Conectores de Hostinger ya registrados en Claude Code =="
if command -v claude >/dev/null 2>&1; then
  claude mcp list 2>/dev/null | grep -i hostinger || echo "(ninguno registrado todavía)"
fi
