#!/usr/bin/env bash
set -euo pipefail

echo "=== Post-create setup ==="

# Ensure uv is in PATH
export PATH="$HOME/.local/bin:$PATH"

# Install project dependencies if package.json exists
if [ -f "package.json" ]; then
    echo "Installing pnpm dependencies..."
    pnpm install
fi

# Install lefthook git hooks if lefthook.yml exists
if [ -f "lefthook.yml" ]; then
    echo "Installing lefthook git hooks..."
    lefthook install
fi

# Setup Docker config for testcontainers (if docker-in-docker is enabled)
if command -v docker &> /dev/null; then
    echo "Setting up Docker config..."
    mkdir -p ~/.docker
    echo '{"auths": {}, "credsStore": ""}' > ~/.docker/config.json
fi

# Install Playwright browsers for e2e tests
if [ -f "package.json" ]; then
    echo "Installing Playwright browsers..."
    pnpm exec playwright install chromium --with-deps
fi

# Install managed MCP configuration for Claude Code
if [ -f "scripts/setup-mcp-tools.sh" ]; then
    echo "Installing MCP configuration for Claude Code..."
    ./scripts/setup-mcp-tools.sh
fi

# Update Claude Code to latest version
if command -v claude &> /dev/null; then
    echo "Updating Claude Code..."
    claude update 2>/dev/null || echo "Claude Code update skipped (may already be latest)"
fi

# Verify installations
echo ""
echo "Installed tools:"
echo "   - Claude Code: $(claude --version 2>/dev/null || echo 'installed')"
echo "   - Node.js: $(node --version)"
echo "   - pnpm: $(pnpm --version)"
echo "   - Python: $(python3 --version)"
echo "   - uv: $(uv --version)"
echo "   - GitHub CLI: $(gh --version | head -1)"
echo "   - ripgrep: $(rg --version | head -1)"
echo "   - gitleaks: $(gitleaks version)"
echo "   - hadolint: $(hadolint --version)"
echo "   - lefthook: $(lefthook --version)"
echo ""
echo "=== Post-create setup complete ==="
echo "Run 'claude' to start coding with AI."
