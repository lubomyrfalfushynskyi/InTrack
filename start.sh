#!/bin/bash

# ============================================
# Asset Management System - Start Script (WSL/Linux)
# ============================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Asset Management System - Starting${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if running in WSL
if grep -qi microsoft /proc/version 2>/dev/null; then
    echo -e "${BLUE}Running in WSL environment${NC}"
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Docker is not running${NC}"
    echo -e "${YELLOW}Please start Docker Desktop or check Docker service${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker is running${NC}"
echo ""

# Check .env file
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env file...${NC}"
    cp .env.example .env

    # Generate secure JWT secret
    JWT_SECRET=$(openssl rand -base64 32)
    sed -i "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env

    echo -e "${GREEN}✓ .env file created with secure JWT secret${NC}"
    echo -e "${YELLOW}⚠ Review .env file for additional configuration${NC}"
    echo ""
else
    echo -e "${GREEN}✓ .env file exists${NC}"
    echo ""
fi

# Create logs directory
mkdir -p backend/logs

# Build and start containers
echo -e "${BLUE}Building Docker images...${NC}"
docker-compose build

echo ""
echo -e "${BLUE}Starting containers...${NC}"
docker-compose up -d

# Wait for services to be ready
echo ""
echo -e "${BLUE}Waiting for services to start...${NC}"
sleep 15

# Check status
echo ""
echo -e "${BLUE}Checking service status...${NC}"
docker-compose ps

# Check database health
echo ""
echo -e "${BLUE}Checking database health...${NC}"
if docker exec asset-management-db pg_isready -U postgres > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Database is ready${NC}"
else
    echo -e "${YELLOW}⚠ Database not ready yet${NC}"
fi

# Check backend health
echo -e "${BLUE}Checking backend health...${NC}"
if curl -s http://localhost:5000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend is ready${NC}"
else
    echo -e "${YELLOW}⚠ Backend not ready yet (check logs with: docker-compose logs backend)${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}System started successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Services:${NC}"
echo -e "  🌐 Frontend:     ${BLUE}http://localhost:3000${NC}"
echo -e "  🔧 Backend API:  ${BLUE}http://localhost:5000${NC}"
echo -e "  ❤️  Health:      ${BLUE}http://localhost:5000/health${NC}"
echo ""
echo -e "${BLUE}Default credentials:${NC}"
echo -e "  Username: ${BLUE}admin${NC}"
echo -e "  Password: ${BLUE}admin123${NC}"
echo ""
echo -e "${RED}⚠ IMPORTANT: Change the default password after first login!${NC}"
echo ""
echo -e "${BLUE}Useful commands:${NC}"
echo -e "  Stop:    ${YELLOW}./stop.sh${NC}"
echo -e "  Logs:    ${YELLOW}docker-compose logs -f${NC}"
echo -e "  Restart: ${YELLOW}docker-compose restart${NC}"
echo ""
