#!/bin/bash

# ============================================
# Asset Management System - Offline Package Creator
# ============================================
# This script creates a self-contained package for offline installation
#
# Usage: ./create-offline-package.sh [output-directory]
# ============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
OUTPUT_DIR="${1:-./offline-package}"
PROJECT_NAME="asset-management-system"
VERSION="1.0.0"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Creating Offline Installation Package${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Create output directory
echo -e "${YELLOW}[1/6]${NC} Creating output directory..."
mkdir -p "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR/images"

# Build and export Docker images
echo -e "${YELLOW}[2/6]${NC} Building Docker images..."
docker-compose build --no-cache

echo -e "${YELLOW}[3/6]${NC} Exporting Docker images..."
images=("asset-management-system-backend" "asset-management-system-frontend" "postgres:15-alpine")

for image in "${images[@]}"; do
    echo -e "  Exporting ${image}..."
    docker save "$image" -o "$OUTPUT_DIR/images/$(echo $image | tr '/:' '-').tar"
done

# Copy project files
echo -e "${YELLOW}[4/6]${NC} Copying project files..."
cp -r backend "$OUTPUT_DIR/"
cp -r frontend "$OUTPUT_DIR/"
cp -r database "$OUTPUT_DIR/"
cp docker-compose.yml "$OUTPUT_DIR/"
cp docker-compose.offline.yml "$OUTPUT_DIR/" 2>/dev/null || true
cp README.md "$OUTPUT_DIR/" 2>/dev/null || true

# Create offline docker-compose file
cat > "$OUTPUT_DIR/docker-compose.offline.yml" << 'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: asset-management-db
    environment:
      POSTGRES_DB: asset_management
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init/schema.sql:/docker-entrypoint-initdb.d/schema.sql
    ports:
      - "5432:5432"
    networks:
      - asset-network

  backend:
    image: asset-management-system-backend:latest
    container_name: asset-management-backend
    environment:
      NODE_ENV: production
      PORT: 5000
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: asset_management
      DB_USER: postgres
      DB_PASSWORD: postgres
      JWT_SECRET: change-this-in-production
      JWT_EXPIRES_IN: 24h
      LOG_LEVEL: info
      FRONTEND_URL: http://localhost:3000
    depends_on:
      - postgres
    ports:
      - "5000:5000"
    volumes:
      - ./backend/logs:/app/logs
    networks:
      - asset-network

  frontend:
    image: asset-management-system-frontend:latest
    container_name: asset-management-frontend
    environment:
      REACT_APP_API_URL: http://localhost:5000
    ports:
      - "3000:80"
    depends_on:
      - backend
    networks:
      - asset-network

volumes:
  postgres_data:
    driver: local

networks:
  asset-network:
    driver: bridge
EOF

# Create installation script
echo -e "${YELLOW}[5/6]${NC} Creating installation script..."
cat > "$OUTPUT_DIR/install.sh" << 'EOFSCRIPT'
#!/bin/bash

# ============================================
# Asset Management System - Offline Installer
# ============================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Asset Management System - Offline Install${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Load Docker images
echo -e "${YELLOW}[1/3]${NC} Loading Docker images..."
for image in images/*.tar; do
    echo -e "  Loading $(basename $image)..."
    docker load -i "$image"
done

# Create .env file if not exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}[2/3]${NC} Creating environment configuration..."
    cat > .env << 'EOF'
# Database Configuration
DB_HOST=postgres
DB_PORT=5432
DB_NAME=asset_management
DB_USER=postgres
DB_PASSWORD=postgres

# JWT Secret (CHANGE IN PRODUCTION!)
JWT_SECRET=$(openssl rand -base64 32)
JWT_EXPIRES_IN=24h

# Logging
LOG_LEVEL=info
EOF
fi

# Start services
echo -e "${YELLOW}[3/3]${NC} Starting services..."
docker-compose -f docker-compose.offline.yml up -d

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Installation Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Backend API: http://localhost:5000"
echo "Frontend: http://localhost:3000"
echo ""
echo "Default admin credentials:"
echo "  Username: admin"
echo "  Password: admin123"
echo ""
echo "IMPORTANT: Change the default password after first login!"
echo ""
EOFSCRIPT

chmod +x "$OUTPUT_DIR/install.sh"

# Create README for offline package
cat > "$OUTPUT_DIR/OFFLINE-README.md" << 'EOF'
# Asset Management System - Offline Installation Package

## Instructions

### Prerequisites
- Docker 20.10 or higher
- Docker Compose 2.0 or higher
- At least 2GB of free disk space

### Installation

1. Copy this entire package to the target computer (USB drive, network share, etc.)

2. Navigate to the package directory:
   ```bash
   cd asset-management-system-offline
   ```

3. Run the installation script:
   ```bash
   ./install.sh
   ```

4. Wait for all services to start (may take 2-3 minutes)

5. Access the application:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000
   - Health Check: http://localhost:5000/health

### Default Credentials

```
Username: admin
Password: admin123
```

**IMPORTANT**: Change the default password immediately after first login!

### Starting/Stopping Services

```bash
# Start all services
docker-compose -f docker-compose.offline.yml up -d

# Stop all services
docker-compose -f docker-compose.offline.yml down

# View logs
docker-compose -f docker-compose.offline.yml logs -f
```

### Backup and Restore

```bash
# Backup database
docker exec asset-management-db pg_dump -U postgres asset_management > backup.sql

# Restore database
docker exec -i asset-management-db psql -U postgres asset_management < backup.sql
```

### Troubleshooting

1. **Services not starting**: Check logs
   ```bash
   docker-compose -f docker-compose.offline.yml logs
   ```

2. **Database connection issues**: Ensure postgres container is healthy
   ```bash
   docker ps
   docker logs asset-management-db
   ```

3. **Port conflicts**: Edit docker-compose.offline.yml to change ports

### Support

For issues and questions, please contact your system administrator.
EOF

# Create package info
cat > "$OUTPUT_DIR/VERSION.txt" << EOF
Asset Management System
Version: $VERSION
Package created: $(date)
EOF

# Calculate sizes
echo -e "${YELLOW}[6/6]${NC} Calculating package size..."
PACKAGE_SIZE=$(du -sh "$OUTPUT_DIR" | cut -f1)
IMAGES_SIZE=$(du -sh "$OUTPUT_DIR/images" | cut -f1)

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Offline package created successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Package location: $OUTPUT_DIR"
echo "Package size: $PACKAGE_SIZE"
echo "Images size: $IMAGES_SIZE"
echo ""
echo "To install on offline machine:"
echo "  1. Copy entire '$OUTPUT_DIR' folder to target computer"
echo "  2. Run: cd $OUTPUT_DIR && ./install.sh"
echo ""
echo -e "${YELLOW}Note:${NC} The package can be copied to USB drive for offline installation"
echo ""
