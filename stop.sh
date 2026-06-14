#!/bin/bash

# ============================================
# Asset Management System - Stop Script (WSL/Linux)
# ============================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Asset Management System - Stopping${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if running in WSL
if grep -qi microsoft /proc/version 2>/dev/null; then
    echo -e "${BLUE}Running in WSL environment${NC}"
fi

# Stop containers
echo -e "${BLUE}Stopping containers...${NC}"
docker-compose down

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}System stopped successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}To start again, run:${NC} ${YELLOW}./start.sh${NC}"
echo ""
