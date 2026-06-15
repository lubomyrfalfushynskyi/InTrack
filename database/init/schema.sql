-- ============================================
-- InTrack — схема БД (ТЗ v2.0)
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ASSET_TYPES — каталог видів майна (веде глобальний адмін)
-- ============================================
CREATE TABLE IF NOT EXISTS asset_types (
    type_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    normative_life_years INTEGER NOT NULL,
    normative_hours INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- DEPARTMENTS — підрозділи (≈ область/місто)
-- ============================================
CREATE TABLE IF NOT EXISTS departments (
    department_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- LOCATIONS — приміщення під підрозділом
-- ============================================
CREATE TABLE IF NOT EXISTS locations (
    location_id SERIAL PRIMARY KEY,
    department_id INTEGER NOT NULL REFERENCES departments(department_id) ON DELETE CASCADE,
    building VARCHAR(255) NOT NULL,
    floor VARCHAR(50),
    room VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- USERS — 5 ролей
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) NOT NULL CHECK (role IN ('global_admin','global_supervisor','department_admin','editor','viewer')),
    department_id INTEGER REFERENCES departments(department_id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- ============================================
-- ASSETS — майно (8 облікових полів + додатково + зв'язки)
-- ============================================
CREATE TABLE IF NOT EXISTS assets (
    asset_id SERIAL PRIMARY KEY,
    inventory_number VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    asset_type_id INTEGER REFERENCES asset_types(type_id) ON DELETE SET NULL,
    unit VARCHAR(20) DEFAULT 'шт.',
    quantity INTEGER NOT NULL DEFAULT 1,
    initial_value DECIMAL(15, 2),
    balance_value DECIMAL(15, 2),
    additional_info TEXT,
    primary_introduced_date DATE NOT NULL,
    secondary_introduced_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','transferred','written_off')),
    responsible_user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    department_id INTEGER REFERENCES departments(department_id) ON DELETE SET NULL,
    location_id INTEGER REFERENCES locations(location_id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- ACTS — акти (вносяться, не створюються)
-- ============================================
CREATE TABLE IF NOT EXISTS acts (
    act_id SERIAL PRIMARY KEY,
    act_type VARCHAR(30) NOT NULL CHECK (act_type IN ('introduction','transfer','extension','write_off')),
    act_number VARCHAR(100) NOT NULL,
    act_date DATE NOT NULL,
    action_date DATE,
    asset_id INTEGER REFERENCES assets(asset_id) ON DELETE CASCADE,
    from_department_id INTEGER REFERENCES departments(department_id) ON DELETE SET NULL,
    to_department_id INTEGER REFERENCES departments(department_id) ON DELETE SET NULL,
    responsible_user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    created_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (act_type, act_number)
);

-- ============================================
-- ASSET_USAGE — журнал напрацювання (місяць / години / хто вніс)
-- ============================================
CREATE TABLE IF NOT EXISTS asset_usage (
    usage_id SERIAL PRIMARY KEY,
    asset_id INTEGER NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,
    period_year INTEGER NOT NULL,
    period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    hours NUMERIC(12, 2) NOT NULL DEFAULT 0,
    entered_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    entered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (asset_id, period_year, period_month)
);

-- ============================================
-- LOGS — CRUD-журнал
-- ============================================
CREATE TABLE IF NOT EXISTS logs (
    log_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    action_type VARCHAR(30) NOT NULL CHECK (action_type IN ('create','update','delete')),
    entity VARCHAR(100) NOT NULL,
    entity_id INTEGER,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_department ON assets(department_id);
CREATE INDEX IF NOT EXISTS idx_assets_location ON assets(location_id);
CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(asset_type_id);
CREATE INDEX IF NOT EXISTS idx_assets_inventory ON assets(inventory_number);
CREATE INDEX IF NOT EXISTS idx_assets_responsible ON assets(responsible_user_id);
CREATE INDEX IF NOT EXISTS idx_acts_asset ON acts(asset_id);
CREATE INDEX IF NOT EXISTS idx_acts_type ON acts(act_type);
CREATE INDEX IF NOT EXISTS idx_acts_date ON acts(act_date);
CREATE INDEX IF NOT EXISTS idx_logs_user ON logs(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_entity ON logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department_id);
CREATE INDEX IF NOT EXISTS idx_locations_department ON locations(department_id);
CREATE INDEX IF NOT EXISTS idx_asset_usage_asset ON asset_usage(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_usage_period ON asset_usage(period_year, period_month);

-- ============================================
-- updated_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_asset_types_updated_at ON asset_types;
CREATE TRIGGER update_asset_types_updated_at BEFORE UPDATE ON asset_types FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_departments_updated_at ON departments;
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_locations_updated_at ON locations;
CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON locations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_assets_updated_at ON assets;
CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON assets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VIEW — майно з розшифровками зв'язків
-- ============================================
CREATE OR REPLACE VIEW v_assets_full AS
SELECT
    a.*,
    t.name AS type_name,
    t.normative_life_years,
    d.name AS department_name,
    l.building AS location_building,
    l.floor AS location_floor,
    l.room AS location_room,
    u.username AS responsible_username,
    u.full_name AS responsible_full_name,
    t.normative_hours AS type_normative_hours,
    (SELECT COUNT(*) FROM acts WHERE acts.asset_id = a.asset_id AND acts.act_type = 'extension') AS extension_count,
    (SELECT COALESCE(SUM(h.hours), 0) FROM asset_usage h WHERE h.asset_id = a.asset_id) AS usage_hours_total
FROM assets a
LEFT JOIN asset_types t ON a.asset_type_id = t.type_id
LEFT JOIN departments d ON a.department_id = d.department_id
LEFT JOIN locations l ON a.location_id = l.location_id
LEFT JOIN users u ON a.responsible_user_id = u.user_id;

-- ============================================
-- SEED
-- ============================================
-- Підрозділи: 24 області + АР Крим (Київська = department_id 9; там багато підрозділів)
INSERT INTO departments (name) VALUES
  ('Вінницька'),('Волинська'),('Дніпропетровська'),('Донецька'),('Житомирська'),
  ('Закарпатська'),('Запорізька'),('Івано-Франківська'),('Київська'),('Кіровоградська'),
  ('Луганська'),('Львівська'),('Миколаївська'),('Одеська'),('Полтавська'),
  ('Рівненська'),('Сумська'),('Тернопільська'),('Харківська'),('Херсонська'),
  ('Хмельницька'),('Черкаська'),('Чернівецька'),('Чернігівська'),('АР Крим')
ON CONFLICT DO NOTHING;

-- Користувачі всіх 5 ролей (паролі = username; plaintext для Етапу 1; bcrypt на Етапі 3)
-- київські ролі прив'язані до Київської області (department_id = 9)
INSERT INTO users (username, password_hash, full_name, role, department_id, is_active) VALUES
    ('admin',      'admin',      'Глобальний Адміністратор', 'global_admin',      NULL, TRUE),
    ('supervisor', 'supervisor', 'Глобальний Супервізор',    'global_supervisor', NULL, TRUE),
    ('kiev_admin', 'kiev_admin', 'Адмін Київської області',  'department_admin',  9,    TRUE),
    ('editor',     'editor',     'Редактор Київської',       'editor',            9,    TRUE),
    ('viewer',     'viewer',     'Переглядач Київської',     'viewer',            9,    TRUE)
ON CONFLICT (username) DO NOTHING;

-- Види майна (нормативні строки: роки + години напрацювання)
INSERT INTO asset_types (name, description, normative_life_years, normative_hours) VALUES
    ('Принтер лазерний', 'Лазерний принтер, багатофункціональний пристрій', 5, 40000),
    ('Ноутбук',          'Персональний ноутбук',                            4, 30000),
    ('Монітор',          'Монітор ПК',                                      5, 40000),
    ('Системний блок',   'Системний блок ПК',                               4, 40000)
ON CONFLICT DO NOTHING;

-- Приміщення Київської області (department_id = 9)
INSERT INTO locations (department_id, building, floor, room) VALUES
    (9, 'Головна будівля', '3', '301'),
    (9, 'Головна будівля', '3', '302'),
    (9, 'Головна будівля', '2', NULL)
ON CONFLICT DO NOTHING;
