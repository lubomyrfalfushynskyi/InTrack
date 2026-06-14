-- ============================================
-- Asset Management System Database Schema
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- REGIONS table
-- ============================================
CREATE TABLE IF NOT EXISTS regions (
    region_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- DEPARTMENTS table
-- ============================================
CREATE TABLE IF NOT EXISTS departments (
    department_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    region_id INTEGER REFERENCES regions(region_id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- LOCATIONS table (hierarchical: region -> building -> room -> floor)
-- ============================================
CREATE TABLE IF NOT EXISTS locations (
    location_id SERIAL PRIMARY KEY,
    region VARCHAR(255) NOT NULL,
    building VARCHAR(255) NOT NULL,
    room VARCHAR(100),
    floor VARCHAR(50),
    full_path TEXT GENERATED ALWAYS AS (
        region || ' → ' || building ||
        CASE WHEN room IS NOT NULL THEN ' → ' || room ELSE '' END ||
        CASE WHEN floor IS NOT NULL THEN ' → ' || floor ELSE '' END
    ) STORED,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- USERS table with roles
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) NOT NULL CHECK (role IN ('global_admin', 'department_admin', 'editor', 'viewer')),
    department_id INTEGER REFERENCES departments(department_id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- ============================================
-- ASSETS table (main entity)
-- ============================================
CREATE TABLE IF NOT EXISTS assets (
    asset_id SERIAL PRIMARY KEY,
    inventory_number VARCHAR(100) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    owner_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    department_id INTEGER REFERENCES departments(department_id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'transferred', 'written_off')),
    location_id INTEGER REFERENCES locations(location_id) ON DELETE SET NULL,
    primary_introduced_date DATE,
    secondary_introduced_date DATE,
    operating_hours DECIMAL(10, 2),
    operating_days DECIMAL(10, 2),
    balance_value DECIMAL(15, 2),
    actual_value DECIMAL(15, 2),
    service_life_years INTEGER,
    service_life_hours INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- ACTS table (introduction, transfer, write-off)
-- ============================================
CREATE TABLE IF NOT EXISTS acts (
    act_id SERIAL PRIMARY KEY,
    act_type VARCHAR(50) NOT NULL CHECK (act_type IN ('introduction', 'transfer', 'write_off')),
    act_number VARCHAR(100) NOT NULL,
    act_date DATE NOT NULL,
    asset_id INTEGER REFERENCES assets(asset_id) ON DELETE CASCADE,
    from_department_id INTEGER REFERENCES departments(department_id) ON DELETE SET NULL,
    to_department_id INTEGER REFERENCES departments(department_id) ON DELETE SET NULL,
    created_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    UNIQUE (act_type, act_number)
);

-- ============================================
-- LOGS table (audit trail)
-- ============================================
CREATE TABLE IF NOT EXISTS logs (
    log_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('create', 'update', 'delete', 'view')),
    entity VARCHAR(100) NOT NULL,
    entity_id INTEGER NOT NULL,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_department ON assets(department_id);
CREATE INDEX IF NOT EXISTS idx_assets_location ON assets(location_id);
CREATE INDEX IF NOT EXISTS idx_assets_inventory ON assets(inventory_number);
CREATE INDEX IF NOT EXISTS idx_acts_asset ON acts(asset_id);
CREATE INDEX IF NOT EXISTS idx_acts_type ON acts(act_type);
CREATE INDEX IF NOT EXISTS idx_acts_date ON acts(act_date);
CREATE INDEX IF NOT EXISTS idx_logs_user ON logs(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_entity ON logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department_id);
CREATE INDEX IF NOT EXISTS idx_locations_region ON locations(region);

-- ============================================
-- FUNCTIONS for automatic updates
-- ============================================

-- Update updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all relevant tables
DROP TRIGGER IF EXISTS update_regions_updated_at ON regions;
CREATE TRIGGER update_regions_updated_at
    BEFORE UPDATE ON regions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_departments_updated_at ON departments;
CREATE TRIGGER update_departments_updated_at
    BEFORE UPDATE ON departments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_locations_updated_at ON locations;
CREATE TRIGGER update_locations_updated_at
    BEFORE UPDATE ON locations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_assets_updated_at ON assets;
CREATE TRIGGER update_assets_updated_at
    BEFORE UPDATE ON assets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- AUDIT TRIGGERS for logging
-- ============================================

-- Generic audit logging function
CREATE OR REPLACE FUNCTION audit_log_func()
RETURNS TRIGGER AS $$
DECLARE
    old_data JSONB;
    new_data JSONB;
    entity_name TEXT;
BEGIN
    -- Determine entity name from table name
    entity_name := TG_TABLE_NAME;

    -- Get old and new values
    IF TG_OP = 'DELETE' THEN
        old_data := to_jsonb(OLD);
        new_data := NULL;
    ELSIF TG_OP = 'INSERT' THEN
        old_data := NULL;
        new_data := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        old_data := to_jsonb(OLD);
        new_data := to_jsonb(NEW);
    END IF;

    -- Insert into logs table (without creating infinite loop)
    -- We need to get user_id from session, this is handled in application layer
    -- For now, we'll store NULL for user_id and let app fill it

    INSERT INTO logs (
        user_id,
        action_type,
        entity,
        entity_id,
        old_values,
        new_values,
        ip_address,
        user_agent
    ) VALUES (
        NULL, -- Will be filled by application middleware
        LOWER(TG_OP),
        entity_name,
        CASE
            WHEN TG_OP = 'DELETE' THEN OLD.asset_id
            ELSE NEW.asset_id
        END,
        old_data,
        new_data,
        inet_client_addr(),
        NULL
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Note: Audit triggers will be applied selectively in the application
-- to avoid circular triggers with the logs table itself

-- ============================================
-- VIEWS for common queries
-- ============================================

-- View: Assets with full details
CREATE OR REPLACE VIEW v_assets_full AS
SELECT
    a.*,
    d.name as department_name,
    r.name as region_name,
    u.username as owner_username,
    u.full_name as owner_full_name,
    l.full_path as location_full,
    l.region as location_region,
    l.building as location_building,
    l.room as location_room,
    l.floor as location_floor
FROM assets a
LEFT JOIN departments d ON a.department_id = d.department_id
LEFT JOIN regions r ON d.region_id = r.region_id
LEFT JOIN users u ON a.owner_id = u.user_id
LEFT JOIN locations l ON a.location_id = l.location_id;

-- View: Acts with full details
CREATE OR REPLACE VIEW v_acts_full AS
SELECT
    act.*,
    a.inventory_number,
    a.description as asset_description,
    from_dept.name as from_department_name,
    to_dept.name as to_department_name,
    creator.username as created_by_username
FROM acts act
LEFT JOIN assets a ON act.asset_id = a.asset_id
LEFT JOIN departments from_dept ON act.from_department_id = from_dept.department_id
LEFT JOIN departments to_dept ON act.to_department_id = to_dept.department_id
LEFT JOIN users creator ON act.created_by = creator.user_id;

-- ============================================
-- INSERT default data
-- ============================================

-- Insert default global admin (password: admin123)
-- Password hash is bcrypt hash of 'admin123'
INSERT INTO users (username, password_hash, full_name, role, is_active)
VALUES (
    'admin',
    '$2a$10$YourBcryptHashHereForAdmin123',
    'Системний Адміністратор',
    'global_admin',
    TRUE
) ON CONFLICT (username) DO NOTHING;

-- Insert default region
INSERT INTO regions (name) VALUES ('Центральний регіон') ON CONFLICT DO NOTHING;

-- Insert default department
INSERT INTO departments (name, region_id)
VALUES ('Головне управління', 1) ON CONFLICT DO NOTHING;

-- Insert default location
INSERT INTO locations (region, building, room, floor)
VALUES ('Центральний регіон', 'Головна будівля', 'Офіс 101', '1 поверх') ON CONFLICT DO NOTHING;
