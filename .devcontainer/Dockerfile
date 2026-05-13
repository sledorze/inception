FROM mcr.microsoft.com/devcontainers/typescript-node:1-22-bookworm

ENV USER=node

# Set shell to bash with pipefail for safer RUN commands
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# ============================================
# CORE TOOLS
# ============================================
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    wget=1.* \
    net-tools=2.* \
    git=1:2.* \
    python3-pip=23.* \
    unzip=6.* \
    ca-certificates=* \
    gnupg=2.* \
    ripgrep=13.* \
    tmux=3.* && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# ============================================
# PNPM - Fast, disk-efficient package manager
# ============================================
RUN corepack enable && corepack prepare pnpm@latest --activate

# ============================================
# GITHUB CLI
# ============================================
RUN mkdir -p /etc/apt/keyrings && \
    wget --progress=dot:giga -O /etc/apt/keyrings/githubcli-archive-keyring.gpg https://cli.github.com/packages/githubcli-archive-keyring.gpg && \
    chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" > /etc/apt/sources.list.d/github-cli.list && \
    apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends gh=2.* && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# ============================================
# ZSH + PLUGINS
# ============================================
RUN sh -c "$(wget --progress=dot:giga -O- https://github.com/deluan/zsh-in-docker/releases/download/v1.2.1/zsh-in-docker.sh)" -- \
    -t agnoster \
    -p git \
    -p ssh-agent \
    -p npm \
    -p docker \
    -p node \
    -p https://github.com/zsh-users/zsh-autosuggestions \
    -p https://github.com/zsh-users/zsh-completions \
    -p https://github.com/zsh-users/zsh-syntax-highlighting

# ============================================
# SECURITY - GitLeaks (detect secrets)
# ============================================
ENV GITLEAKS_VERSION="8.24.3"
RUN wget --progress=dot:giga "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz" \
    && tar -xzf "gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz" \
    && chmod +x gitleaks \
    && mv gitleaks /usr/local/bin/ \
    && rm "gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz"

# ============================================
# DOCKER - Hadolint (Dockerfile linter)
# ============================================
ENV HADOLINT_VERSION="2.12.0"
RUN ARCH=$(uname -m) && \
    if [ "$ARCH" = "aarch64" ]; then HADOLINT_ARCH="arm64"; else HADOLINT_ARCH="x86_64"; fi && \
    wget --progress=dot:giga "https://github.com/hadolint/hadolint/releases/download/v${HADOLINT_VERSION}/hadolint-Linux-${HADOLINT_ARCH}" \
    && chmod +x "hadolint-Linux-${HADOLINT_ARCH}" \
    && mv "hadolint-Linux-${HADOLINT_ARCH}" /usr/local/bin/hadolint

# ============================================
# PYTHON - uv (fast package manager for MCP tools)
# ============================================
RUN mkdir -p /home/node/.local/bin && \
    chown -R node:node /home/node/.local && \
    wget --progress=dot:giga -O- https://astral.sh/uv/install.sh | env HOME=/home/node sh && \
    chown -R node:node /home/node/.local && \
    echo "export PATH=\"/home/node/.local/bin:\$PATH\"" >> /home/node/.bashrc && \
    echo "export PATH=\"/home/node/.local/bin:\$PATH\"" >> /home/node/.zshrc

# ============================================
# MCP TOOLS - Code intelligence for Claude Code
# ============================================
# serena: Semantic code analysis (symbol navigation, refactoring)
# xray: Codebase exploration and visualization
# Installing at build time eliminates startup latency
# hadolint ignore=DL3059
RUN su - node -c "export PATH=\"/home/node/.local/bin:\$PATH\" && \
    uv tool install git+https://github.com/oraios/serena && \
    uv tool install git+https://github.com/srijanshukla18/xray"

# ============================================
# CLAUDE CODE CLI
# ============================================
# Native installation supports auto-updates
# hadolint ignore=DL3059
RUN su - node -c "curl -fsSL https://claude.ai/install.sh | bash"

# ============================================
# GIT HOOKS - Lefthook
# ============================================
RUN npm install -g lefthook

# ============================================
# OPTIONAL: Uncomment sections below as needed
# ============================================

# --- DuckDB (SQL analytics) ---
# ENV DUCKDB_VERSION="1.4.1"
# RUN ARCH=$(uname -m) && \
#     if [ "$ARCH" = "aarch64" ]; then DUCKDB_ARCH="arm64"; else DUCKDB_ARCH="amd64"; fi && \
#     wget --progress=dot:giga "https://github.com/duckdb/duckdb/releases/download/v${DUCKDB_VERSION}/duckdb_cli-linux-${DUCKDB_ARCH}.zip" \
#     && unzip "duckdb_cli-linux-${DUCKDB_ARCH}.zip" \
#     && chmod +x duckdb \
#     && mv duckdb /usr/local/bin/ \
#     && rm "duckdb_cli-linux-${DUCKDB_ARCH}.zip"

# --- Desktop GUI (for E2E testing with visible browser) ---
# Requires desktop-lite feature in devcontainer.json
# RUN apt-get update && \
#     DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
#     xfwm4 xfce4-session xfce4-settings tigervnc-standalone-server \
#     dbus-x11 autocutsel x11vnc && \
#     apt-get clean && rm -rf /var/lib/apt/lists/*
