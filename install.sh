#!/bin/bash
# Pi Dictation — One-command installer
# Run: chmod +x install.sh && ./install.sh
set -e

BOLD="\033[1m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
CYAN="\033[36m"
RESET="\033[0m"

DICTATION_DIR="$(cd "$(dirname "$0")" && pwd)"
INSTALL_DIR="$HOME/.pi/agent/extensions/dictation"

echo -e "${BOLD}🎤 Pi Dictation Installer${RESET}\n"

# ── Prerequisites ──────────────────────────────────────────────

echo -e "${CYAN}Checking prerequisites...${RESET}"

# Check macOS
if [[ "$(uname)" != "Darwin" ]]; then
  echo -e "${RED}✗ macOS only. This extension uses Apple's speech recognition.${RESET}"
  exit 1
fi
echo -e "  ${GREEN}✓${RESET} macOS $(sw_vers -productVersion)"

# Check pi
if ! command -v pi &>/dev/null; then
  echo -e "${RED}✗ pi not found. Install it first:${RESET}"
  echo -e "  npm install -g --ignore-scripts @earendil-works/pi-coding-agent"
  exit 1
fi
echo -e "  ${GREEN}✓${RESET} pi $(pi --version 2>&1 | head -1)"

# Check swift
if ! command -v swift &>/dev/null; then
  echo -e "${YELLOW}⚠ Swift not found. Installing Xcode Command Line Tools...${RESET}"
  xcode-select --install 2>/dev/null || true
  echo -e "  Run this script again after installation completes."
  exit 1
fi
echo -e "  ${GREEN}✓${RESET} Swift $(swift --version 2>&1 | head -1)"

# ── Install extension ──────────────────────────────────────────

echo ""
echo -e "${CYAN}Installing extension to ${INSTALL_DIR}...${RESET}"

mkdir -p "$(dirname "$INSTALL_DIR")"

# Remove old symlink or copy if exists
rm -rf "$INSTALL_DIR"

# Symlink so updates to the source folder are picked up automatically
ln -s "$DICTATION_DIR" "$INSTALL_DIR"

echo -e "  ${GREEN}✓${RESET} Extension symlinked"

# ── Build Swift helper ────────────────────────────────────────

echo ""
echo -e "${CYAN}Building speech recognition helper (~10 seconds, one-time only)...${RESET}"

cd "$DICTATION_DIR/dictation-helper"
if swift build -c release --disable-sandbox 2>&1; then
  echo -e "  ${GREEN}✓${RESET} Helper built successfully"
else
  echo -e "${RED}✗ Build failed. Check error output above.${RESET}"
  exit 1
fi

# ── Permissions reminder ──────────────────────────────────────

echo ""
echo -e "${BOLD}${GREEN}✅ Installation complete!${RESET}\n"
echo -e "${BOLD}Before first use, grant macOS permissions:${RESET}"
echo -e "  1. ${CYAN}System Settings > Privacy & Security > Microphone${RESET} → enable for your terminal"
echo -e "  2. ${CYAN}System Settings > Privacy & Security > Speech Recognition${RESET} → enable for your terminal"
echo -e "  3. ${CYAN}System Settings > Siri${RESET} → enable Ask Siri (required for on-device dictation)"
echo ""
echo -e "${BOLD}To start:${RESET}"
echo -e "  - Run ${CYAN}pi${RESET} in any project"
echo -e "  - Type ${CYAN}/dictate${RESET} to dictate once"
echo -e "  - Type ${CYAN}/voicemode${RESET} for continuous conversation"
echo -e "  - Press ${CYAN}Ctrl+Shift+D${RESET} as a keyboard shortcut"
echo ""
echo -e "${BOLD}To test outside pi:${RESET}"
echo -e "  ${CYAN}./test-dictation.sh${RESET}"
echo ""
