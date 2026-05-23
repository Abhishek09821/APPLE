#!/bin/bash
# APPLE — macOS Setup Script
# Run this once: chmod +x setup.sh && ./setup.sh

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${BLUE}╔══════════════════════════════════╗${NC}"
echo -e "${BLUE}║   APPLE — AI Action Assistant    ║${NC}"
echo -e "${BLUE}║       macOS Setup Script         ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════╝${NC}"
echo ""

# Check Python
if ! command -v python3 &>/dev/null; then
  echo -e "${RED}✗ Python 3 not found. Install from https://python.org${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Python3 found: $(python3 --version)${NC}"

# Check Node
if ! command -v node &>/dev/null; then
  echo -e "${RED}✗ Node.js not found. Install from https://nodejs.org${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Node found: $(node --version)${NC}"

# Backend setup
echo ""
echo -e "${BLUE}→ Setting up backend...${NC}"
cd backend

python3 -m venv venv
source venv/bin/activate

pip install -q -r requirements.txt
echo -e "${GREEN}✓ Python dependencies installed${NC}"

playwright install chromium
echo -e "${GREEN}✓ Playwright chromium installed${NC}"

mkdir -p data
deactivate
cd ..

# Frontend setup
echo ""
echo -e "${BLUE}→ Setting up frontend...${NC}"
cd frontend
npm install --silent
echo -e "${GREEN}✓ Node modules installed${NC}"
cd ..

# Gemini API key
echo ""
echo -e "${YELLOW}⚡ IMPORTANT: Add your Gemini API key${NC}"
echo -e "   1. Get a free key at: ${BLUE}https://aistudio.google.com/app/apikey${NC}"
echo -e "   2. Open backend/.env and replace YOUR_GEMINI_API_KEY_HERE"
echo ""

echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo -e "${BLUE}To start APPLE:${NC}"
echo -e "   Terminal 1: ${YELLOW}cd backend && source venv/bin/activate && python main.py${NC}"
echo -e "   Terminal 2: ${YELLOW}cd frontend && npm run dev${NC}"
echo -e "   Then open: ${BLUE}http://localhost:5173${NC}"
echo ""
