#!/bin/sh
set -e

REPO="kilospark/webact"
BINARY="webact-mcp"
INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"

# Detect OS and architecture
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Darwin) PLATFORM="darwin" ;;
  Linux)  PLATFORM="linux" ;;
  *)      echo "Unsupported OS: $OS"; exit 1 ;;
esac

case "$ARCH" in
  arm64|aarch64) ARCH_NAME="arm64" ;;
  x86_64|amd64)  ARCH_NAME="x64" ;;
  *)              echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

ASSET="${BINARY}-${PLATFORM}-${ARCH_NAME}"

# Get latest release tag if not specified
if [ -z "$VERSION" ]; then
  VERSION="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name"' | cut -d'"' -f4)"
fi

if [ -z "$VERSION" ]; then
  echo "Failed to determine latest version"
  exit 1
fi

URL="https://github.com/${REPO}/releases/download/${VERSION}/${ASSET}.tar.gz"

echo "Installing ${BINARY} ${VERSION} (${PLATFORM}/${ARCH_NAME})..."

TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

curl -fsSL "$URL" | tar xz -C "$TMPDIR"

if [ -w "$INSTALL_DIR" ]; then
  mv "$TMPDIR/${ASSET}" "${INSTALL_DIR}/${BINARY}"
else
  sudo mv "$TMPDIR/${ASSET}" "${INSTALL_DIR}/${BINARY}"
fi

chmod +x "${INSTALL_DIR}/${BINARY}"

echo "Installed ${BINARY} to ${INSTALL_DIR}/${BINARY}"

# --- Configure MCP clients ---

BINARY_PATH="${INSTALL_DIR}/${BINARY}"
CONFIGURED=""

# Add webact to an MCP config file
# Usage: add_mcp_config <config_file> <client_name>
add_mcp_config() {
  config_file="$1"
  client_name="$2"

  if [ ! -f "$config_file" ]; then
    return
  fi

  # Check if webact is already configured
  if grep -q '"webact"' "$config_file" 2>/dev/null; then
    echo "  $client_name: already configured"
    CONFIGURED="${CONFIGURED}${client_name}, "
    return
  fi

  # Read existing content
  content="$(cat "$config_file")"

  # Escape path for sed (handle / and &)
  escaped_path="$(echo "$BINARY_PATH" | sed 's/[\/&]/\\&/g')"

  # Check if mcpServers key exists
  if echo "$content" | grep -q '"mcpServers"'; then
    # Add webact entry to existing mcpServers object
    updated="$(echo "$content" | sed 's/"mcpServers"[[:space:]]*:[[:space:]]*{/"mcpServers": { "webact": { "command": "'"$escaped_path"'" },/')"
  else
    # Add mcpServers key to the top-level object
    updated="$(echo "$content" | sed 's/^{/{ "mcpServers": { "webact": { "command": "'"$escaped_path"'" } },/')"
  fi

  echo "$updated" > "$config_file"
  echo "  $client_name: configured"
  CONFIGURED="${CONFIGURED}${client_name}, "
}

echo ""
echo "Configuring MCP clients..."

# Claude Code (uses CLI, not a config file)
if command -v claude >/dev/null 2>&1; then
  if claude mcp get webact >/dev/null 2>&1; then
    echo "  Claude Code: already configured"
    CONFIGURED="${CONFIGURED}Claude Code, "
  else
    claude mcp add webact "$BINARY_PATH" 2>/dev/null && {
      echo "  Claude Code: configured"
      CONFIGURED="${CONFIGURED}Claude Code, "
    } || echo "  Claude Code: failed to configure (try: claude mcp add webact $BINARY_PATH)"
  fi
fi

# Cline (VSCode extension - check both Code and Cursor hosts)
if [ "$PLATFORM" = "darwin" ]; then
  add_mcp_config "$HOME/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json" "Cline (VSCode)"
  add_mcp_config "$HOME/Library/Application Support/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json" "Cline (Cursor)"
elif [ "$PLATFORM" = "linux" ]; then
  XDG_CONFIG="${XDG_CONFIG_HOME:-$HOME/.config}"
  add_mcp_config "$XDG_CONFIG/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json" "Cline (VSCode)"
  add_mcp_config "$XDG_CONFIG/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json" "Cline (Cursor)"
fi

# macOS config paths
if [ "$PLATFORM" = "darwin" ]; then
  APP_SUPPORT="$HOME/Library/Application Support"

  add_mcp_config "$APP_SUPPORT/Claude/claude_desktop_config.json" "Claude Desktop"
  add_mcp_config "$APP_SUPPORT/ChatGPT/mcp.json" "ChatGPT Desktop"

  # Cursor
  add_mcp_config "$HOME/.cursor/mcp.json" "Cursor"

  # Windsurf
  add_mcp_config "$HOME/.codeium/windsurf/mcp_config.json" "Windsurf"
fi

# Linux config paths
if [ "$PLATFORM" = "linux" ]; then
  XDG_CONFIG="${XDG_CONFIG_HOME:-$HOME/.config}"

  add_mcp_config "$XDG_CONFIG/Claude/claude_desktop_config.json" "Claude Desktop"
  add_mcp_config "$XDG_CONFIG/chatgpt/mcp.json" "ChatGPT Desktop"

  # Cursor
  add_mcp_config "$HOME/.cursor/mcp.json" "Cursor"

  # Windsurf
  add_mcp_config "$HOME/.codeium/windsurf/mcp_config.json" "Windsurf"
fi

# Cross-platform
add_mcp_config "$HOME/.config/codex/mcp.json" "Codex"

if [ -z "$CONFIGURED" ]; then
  echo "  No MCP clients detected. Add manually to your client config:"
  echo ""
  echo '  { "mcpServers": { "webact": { "command": "'"$BINARY_PATH"'" } } }'
else
  echo ""
  echo "Done! Restart your MCP client to start using webact."
fi
