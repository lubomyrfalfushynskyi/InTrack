#!/bin/bash

# ============================================
# Asset Management System - Stop Script
# ============================================

set -e

GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Asset Management System - Stopping${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Stop containers
docker-compose down

echo ""
echo -e "${GREEN}System stopped successfully!${NC}"
echo ""
echo "To start again, run: ./start.sh"
echo ""
