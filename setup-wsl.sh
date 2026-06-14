#!/bin/bash

# ============================================
# WSL Environment Setup Script
# ============================================
# Цей скрипт налаштовує WSL2 середовище
# для розробки та запуску Asset Management System
# ============================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}WSL Environment Setup${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if running in WSL
if grep -qi microsoft /proc/version 2>/dev/null; then
    echo -e "${GREEN}✓ Running in WSL${NC}"
else
    echo -e "${RED}✗ Not running in WSL${NC}"
    echo -e "${YELLOW}This script is designed for WSL2 environment${NC}"
    exit 1
fi

# Check Ubuntu version
echo -e "${BLUE}Checking Ubuntu version...${NC}"
if [ -f /etc/os-release ]; then
    . /etc/os-release
    echo -e "${GREEN}✓ $PRETTY_NAME${NC}"
fi

# Update system packages
echo -e "${BLUE}Updating system packages...${NC}"
sudo apt update && sudo apt upgrade -y

# Install essential packages
echo -e "${BLUE}Installing essential packages...${NC}"
sudo apt install -y \
    git \
    curl \
    wget \
    ca-certificates \
    gnupg \
    lsb-release \
    build-essential \
    nodejs \
    npm

# Check Docker
echo -e "${BLUE}Checking Docker installation...${NC}"
if command -v docker &> /dev/null; then
    echo -e "${GREEN}✓ Docker is installed: $(docker --version)${NC}"
else
    echo -e "${YELLOW}⚠ Docker not found${NC}"
    echo -e "${YELLOW}Please install Docker Desktop for Windows with WSL2 integration${NC}"
    echo -e "${YELLOW}Download from: https://www.docker.com/products/docker-desktop${NC}"
fi

# Check Docker Compose
if command -v docker-compose &> /dev/null; then
    echo -e "${GREEN}✓ Docker Compose is installed: $(docker-compose version)${NC}"
else
    echo -e "${YELLOW}⚠ Docker Compose not found${NC}"
fi

# Configure /etc/wsl.conf for better WSL experience
echo -e "${BLUE}Configuring WSL settings...${NC}"
sudo bash -c 'cat > /etc/wsl.conf << EOF
[network]
generateHosts = false
generateResolvConf = false

[boot]
systemd = true
EOF'
echo -e "${GREEN}✓ WSL configuration updated${NC}"

# Setup .env file if not exists
if [ ! -f .env ]; then
    echo -e "${BLUE}Creating .env file...${NC}"
    cp .env.example .env

    # Generate secure JWT secret
    JWT_SECRET=$(openssl rand -base64 32)
    sed -i "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env

    echo -e "${GREEN}✓ .env file created with secure JWT secret${NC}"
else
    echo -e "${GREEN}✓ .env file already exists${NC}"
fi

# Make scripts executable
echo -e "${BLUE}Making scripts executable...${NC}"
chmod +x *.sh 2>/dev/null || true
echo -e "${GREEN}✓ Scripts are now executable${NC}"

# Create logs directory
echo -e "${BLUE}Creating logs directory...${NC}"
mkdir -p backend/logs
echo -e "${GREEN}✓ Logs directory created${NC}"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Restart WSL from Windows PowerShell (Admin):"
echo -e "   ${BLUE}wsl --shutdown${NC}"
echo -e "   Then open WSL again"
echo ""
echo -e "2. Start the system:"
echo -e "   ${BLUE}./start.sh${NC}"
echo ""
echo -e "3. Open in browser:"
echo -e "   ${BLUE}http://localhost:3000${NC}"
echo ""
echo -e "Default credentials:"
echo -e "   Username: ${BLUE}admin${NC}"
echo -e "   Password: ${BLUE}admin123${NC}"
echo ""
echo -e "${YELLOW}⚠ IMPORTANT: Change the default password after first login!${NC}"
echo ""
