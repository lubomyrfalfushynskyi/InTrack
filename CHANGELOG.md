# Changelog

All notable changes to InTrack (Inventory Tracker System) will be documented in this file.

## [1.1.0] - 2026-06-14 - WSL Edition

### Changed
- ✅ Project renamed to **InTrack** (Inventory Tracker)
- ✅ Adapted for WSL2 (Ubuntu) development environment

### Changed

#### Environment
- ✅ Adapted for WSL2 (Ubuntu) development environment
- ✅ Removed Windows-specific files (.bat scripts)
- ✅ Updated all shell scripts for Linux/bash
- ✅ Added WSL configuration file (.wslconfig)
- ✅ Optimized for Ubuntu 22.04 LTS compatibility

#### Documentation
- ✅ Updated README with WSL-specific instructions
- ✅ Added Windows Subsystem for Linux setup guide
- ✅ Updated Docker Compose configuration for WSL networking
- ✅ Added WSL performance optimization tips

### Fixed

- ✅ Fixed line endings (CRLF → LF) for all shell scripts
- ✅ Fixed file permissions for executable scripts
- ✅ Updated backend health check for WSL networking
- ✅ Fixed Docker socket permissions for WSL2

### Improved

- ✅ Better Docker Desktop for Windows integration
- ✅ Optimized for WSL2 filesystem performance
- ✅ Added .env.example with WSL-specific defaults
- ✅ Improved startup scripts with WSL detection

## [1.0.0] - 2024

### Added

#### Backend
- ✅ Express.js server with clean architecture
- ✅ JWT authentication with bcrypt password hashing
- ✅ Role-based access control (4 roles)
- ✅ CRUD API for assets, acts, users, departments, locations
- ✅ Automatic audit logging for all operations
- ✅ PostgreSQL database with optimized schema
- ✅ Health check endpoint
- ✅ Rate limiting and security middleware
- ✅ Winston logger with file and console output

#### Frontend
- ✅ React 18 with Vite build system
- ✅ Ant Design UI components
- ✅ Zustand state management
- ✅ Responsive layout with mobile support
- ✅ Dashboard with statistics
- ✅ Assets management page
- ✅ Asset detail page with history
- ✅ Acts management page
- ✅ Users management page (admin only)
- ✅ Locations tree view
- ✅ Logs viewer (admin only)
- ✅ Profile page with password change

#### Infrastructure
- ✅ Docker Compose configuration
- ✅ Offline package creator script
- ✅ Quick start scripts
- ✅ Nginx configuration for frontend
- ✅ Environment variable templates

#### Documentation
- ✅ Comprehensive README
- ✅ Contributing guidelines
- ✅ MIT License
- ✅ Changelog

### Features

#### Asset Management
- Create, read, update, delete assets
- Automatic status calculation
- Service life tracking
- Balance and actual value tracking
- Operating hours and days tracking
- Location and department assignment

#### Acts System
- Introduction acts (create new assets)
- Transfer acts (move between departments)
- Write-off acts (decommission assets)
- Automatic asset status updates
- Full history tracking

#### User Management
- Create, update, delete users
- Role-based permissions
- Department assignment
- Active/inactive status
- Password change functionality

#### Location Management
- Hierarchical structure (region → building → room → floor)
- Tree view visualization
- Create, update, delete locations

#### Audit & Logging
- Automatic logging of all CRUD operations
- User action tracking
- IP address logging
- Export logs to CSV
- Log filtering and search

### Security

- JWT token authentication
- Bcrypt password hashing
- Rate limiting on API endpoints
- CORS protection
- Role-based access control
- SQL injection prevention (parameterized queries)
- XSS protection headers

### Performance

- Database indexes on frequently queried fields
- Optimized SQL queries
- Pagination for large datasets
- Lazy loading for components
- Gzip compression in nginx
- Static asset caching

### Upcoming Features

- [ ] MFA (Multi-Factor Authentication)
- [ ] TLS/HTTPS support
- [ ] Automated backups
- [ ] Advanced reporting
- [ ] Data export (PDF, Excel)
- [ ] Mobile app
- [ ] Barcode/QR code scanning
- [ ] Asset photos
- [ ] File attachments
- [ ] Notifications system
