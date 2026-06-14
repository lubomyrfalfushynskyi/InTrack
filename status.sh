#!/bin/bash

# ============================================
# Asset Management System - Status Check Script
# ============================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}System Status Check${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check WSL environment
if grep -qi microsoft /proc/version 2>/dev/null; then
    echo -e "${GREEN}✓${NC} WSL Environment: ${BLUE}Running${NC}"
else
    echo -e "${YELLOW}⚠${NC} WSL Environment: ${YELLOW}Not detected${NC}"
fi

# Check Docker
if command -v docker &> /dev/null; then
    echo -e "${GREEN}✓${NC} Docker: ${BLUE}$(docker --version)${NC}"
else
    echo -e "${RED}✗${NC} Docker: ${RED}Not installed${NC}"
fi

# Check Docker Compose
if command -v docker-compose &> /dev/null; then
    echo -e "${GREEN}✓${NC} Docker Compose: ${BLUE}$(docker-compose version --short)${NC}"
else
    echo -e "${RED}✗${NC} Docker Compose: ${RED}Not installed${NC}"
fi

# Check containers
echo ""
echo -e "${BLUE}Container Status:${NC}"
if docker ps &> /dev/null; then
    CONTAINERS=$(docker-compose ps -q)
    if [ -n "$CONTAINERS" ]; then
        docker-compose ps
    else
        echo -e "${YELLOW}⚠${NC} No containers running"
    fi
else
    echo -e "${RED}✗${NC} Cannot access Docker"
fi

# Check services health
echo ""
echo -e "${BLUE}Service Health:${NC}"

# Database
if docker exec asset-management-db pg_isready -U postgres &> /dev/null; then
    echo -e "${GREEN}✓${NC} PostgreSQL: ${GREEN}Healthy${NC}"
else
    echo -e "${RED}✗${NC} PostgreSQL: ${RED}Not ready${NC}"
fi

# Backend
if curl -s http://localhost:5000/health &> /dev/null; then
    echo -e "${GREEN}✓${NC} Backend API: ${GREEN}Healthy${NC}"
else
    echo -e "${RED}✗${NC} Backend API: ${RED}Not responding${NC}"
fi

# Frontend
if curl -s http://localhost:3000 &> /dev/null; then
    echo -e "${GREEN}✓${NC} Frontend: ${GREEN}Healthy${NC}"
else
    echo -e "${YELLOW}⚠${NC} Frontend: ${YELLOW}Not responding${NC}"
fi

# Check logs for errors
echo ""
echo -e "${BLUE}Recent Errors (if any):${NC}"
ERROR_COUNT=$(docker-compose logs --since=1h 2>&1 | grep -i "error\|failed" | wc -l)
if [ "$ERROR_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}Found $ERROR_COUNT error messages${NC}"
    docker-compose logs --since=1h 2>&1 | grep -i "error\|failed" | tail -5
else
    echo -e "${GREEN}No errors in the last hour${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${BLUE}For detailed logs:${NC} ${YELLOW}docker-compose logs -f${NC}"
echo ""
