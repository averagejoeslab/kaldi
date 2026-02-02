#!/usr/bin/env bash

# ☕ Kaldi Installer
# Your loyal coding companion
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/averagejoeslab/kaldi/main/install.sh | bash
#
# Or with options:
#   curl -fsSL https://raw.githubusercontent.com/averagejoeslab/kaldi/main/install.sh | bash -s -- --dir ~/.local/share/kaldi

set -e

# Colors
BROWN='\033[0;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
DIM='\033[2m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Defaults
INSTALL_DIR="${HOME}/.kaldi"
BIN_DIR="${HOME}/.local/bin"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --dir)
      INSTALL_DIR="$2"
      shift 2
      ;;
    --bin)
      BIN_DIR="$2"
      shift 2
      ;;
    --help)
      echo "Kaldi Installer"
      echo ""
      echo "Usage: curl -fsSL https://raw.githubusercontent.com/averagejoeslab/kaldi/main/install.sh | bash"
      echo ""
      echo "Options:"
      echo "  --dir DIR   Installation directory (default: ~/.kaldi)"
      echo "  --bin DIR   Binary directory (default: ~/.local/bin)"
      echo "  --help      Show this help"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

banner() {
  echo -e "${BROWN}"
  echo '  ╔═══════════════════════════════════════╗'
  echo '  ║                                       ║'
  echo '  ║   ☕  KALDI INSTALLER  ☕              ║'
  echo '  ║   Your loyal coding companion         ║'
  echo '  ║                                       ║'
  echo '  ╚═══════════════════════════════════════╝'
  echo -e "${NC}"
}

info() {
  echo -e "${DIM}$1${NC}"
}

success() {
  echo -e "${GREEN}✓${NC} $1"
}

error() {
  echo -e "${RED}✗${NC} $1"
}

warn() {
  echo -e "${BROWN}⚠${NC} $1"
}

# Check for required commands
check_requirements() {
  info "Checking requirements..."

  # Check Node.js
  if ! command -v node &> /dev/null; then
    error "Node.js is required but not installed."
    echo ""
    echo "Install Node.js 20+ from:"
    echo "  https://nodejs.org/"
    echo "  or: brew install node"
    echo "  or: nvm install 20"
    exit 1
  fi

  NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$NODE_VERSION" -lt 20 ]; then
    warn "Node.js version $(node -v) detected. Version 20+ recommended."
  else
    success "Node.js $(node -v)"
  fi

  # Check npm
  if ! command -v npm &> /dev/null; then
    error "npm is required but not installed."
    exit 1
  fi
  success "npm $(npm -v)"

  # Check git
  if ! command -v git &> /dev/null; then
    error "git is required but not installed."
    exit 1
  fi
  success "git available"
}

# Install Kaldi
install_kaldi() {
  info "Installing Kaldi to ${INSTALL_DIR}..."

  # Create install directory
  mkdir -p "$INSTALL_DIR"
  mkdir -p "$BIN_DIR"

  # Clone or update repository
  if [ -d "$INSTALL_DIR/.git" ]; then
    info "Updating existing installation..."
    cd "$INSTALL_DIR"
    git pull origin main
  else
    info "Cloning repository..."
    rm -rf "$INSTALL_DIR"
    git clone --depth 1 https://github.com/averagejoeslab/kaldi.git "$INSTALL_DIR"
    cd "$INSTALL_DIR"
  fi

  success "Repository cloned"

  # Install dependencies
  info "Installing dependencies..."
  npm install --silent
  success "Dependencies installed"

  # Build
  info "Building Kaldi..."
  npm run build --silent
  success "Build complete"

  # Create launcher script
  info "Creating launcher..."
  chmod +x "$INSTALL_DIR/dist/main.js"
  cat > "$BIN_DIR/kaldi" << EOF
#!/usr/bin/env bash
exec "$INSTALL_DIR/dist/main.js" "\$@"
EOF
  chmod +x "$BIN_DIR/kaldi"
  success "Launcher created at $BIN_DIR/kaldi"
}

# Setup PATH if needed
setup_path() {
  if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
    warn "$BIN_DIR is not in your PATH"
    echo ""
    echo "Add this to your shell profile (~/.bashrc, ~/.zshrc, etc.):"
    echo ""
    echo -e "  ${BOLD}export PATH=\"\$HOME/.local/bin:\$PATH\"${NC}"
    echo ""
    echo "Then restart your shell or run:"
    echo ""
    echo -e "  ${BOLD}source ~/.bashrc${NC}  # or ~/.zshrc"
    echo ""
  fi
}

# Print next steps
print_next_steps() {
  echo ""
  echo -e "${GREEN}${BOLD}☕ Kaldi installed successfully!${NC}"
  echo ""
  echo "Next steps:"
  echo ""
  echo -e "  ${BOLD}1.${NC} Configure your LLM provider:"
  echo ""
  echo -e "     ${DIM}# Using Anthropic (recommended)${NC}"
  echo -e "     kaldi beans -p anthropic -k your-api-key"
  echo ""
  echo -e "     ${DIM}# Or set environment variable${NC}"
  echo -e "     export ANTHROPIC_API_KEY=your-api-key"
  echo ""
  echo -e "  ${BOLD}2.${NC} Start Kaldi:"
  echo ""
  echo -e "     kaldi"
  echo ""
  echo -e "  ${BOLD}3.${NC} Get help:"
  echo ""
  echo -e "     kaldi --help"
  echo -e "     kaldi doctor"
  echo ""
  echo -e "${DIM}Docs: https://github.com/averagejoeslab/kaldi${NC}"
  echo ""
}

# Main
main() {
  banner
  check_requirements
  echo ""
  install_kaldi
  echo ""
  setup_path
  print_next_steps
}

main
