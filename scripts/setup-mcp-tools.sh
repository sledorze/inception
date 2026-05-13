#!/usr/bin/env bash
set -euo pipefail

# Install MCP tools locally for faster Claude Code startup
# Instead of fetching from GitHub on every run, these tools are installed once
# and the binaries are cached in ~/.local/bin

echo "Installing MCP tools for faster Claude Code startup..."

# Check if uv is installed
if ! command -v uv &> /dev/null; then
    echo "Error: 'uv' is not installed. Please install it first:"
    echo "  curl -LsSf https://astral.sh/uv/install.sh | sh"
    exit 1
fi

# Install serena (semantic code analysis)
echo "Installing serena..."
uv tool install git+https://github.com/oraios/serena --force

# Install xray (codebase exploration)
echo "Installing xray..."
uv tool install git+https://github.com/srijanshukla18/xray --force

echo ""
echo "MCP tools installed successfully!"
echo ""
echo "Installed tools:"
uv tool list

echo ""
echo "These tools are now available in your PATH:"
echo "  - serena (semantic code analysis)"
echo "  - xray-mcp (codebase exploration)"

# Install managed MCP config for Claude Code auto-loading
# This allows MCP servers to work without manual approval prompts
echo ""
echo "Installing managed MCP configuration..."

sudo mkdir -p /etc/claude-code

sudo tee /etc/claude-code/managed-mcp.json > /dev/null << 'EOF'
{
  "mcpServers": {
    "serena": {
      "type": "stdio",
      "command": "serena",
      "args": ["start-mcp-server", "--context", "ide-assistant", "--enable-web-dashboard", "False"]
    },
    "xray": {
      "type": "stdio",
      "command": "xray-mcp",
      "args": []
    },
    "ts-refactor": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "mcp-refactor-typescript@latest"]
    }
  }
}
EOF

echo "Managed MCP config installed to /etc/claude-code/managed-mcp.json"
echo "Claude Code will auto-load these servers without approval prompts."
