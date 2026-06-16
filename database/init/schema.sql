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
-- REGIONS — області (єдине джерело істини для областей)
-- ============================================
CREATE TABLE IF NOT EXISTS regions (
    region_id SERIAL PRIMARY KEY,
    region_name VARCHAR(255) UNIQUE NOT NULL,
    display_order INTEGER DEFAULT 999,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- DEPARTMENTS — підрозділи (прив'язані до областей)
-- ============================================
CREATE TABLE IF NOT EXISTS departments (
    department_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    region_id INTEGER REFERENCES regions(region_id) ON DELETE CASCADE,
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
    r.region_name,
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
LEFT JOIN regions r ON d.region_id = r.region_id
LEFT JOIN locations l ON a.location_id = l.location_id
LEFT JOIN users u ON a.responsible_user_id = u.user_id;

-- ============================================
-- SEED
-- ============================================

-- 1. ОБЛАСТІ (regions) — фіксований порядок для 6 спец-областей
INSERT INTO regions (region_name, display_order) VALUES
  ('Київська', 1),
  ('Харківська', 2),
  ('Полтавська', 3),
  ('Рівненська', 4),
  ('Одеська', 5),
  ('Житомирська', 6),
  ('Вінницька', 10),
  ('Волинська', 11),
  ('Дніпропетровська', 12),
  ('Донецька', 13),
  ('Закарпатська', 14),
  ('Запорізька', 15),
  ('Івано-Франківська', 16),
  ('Кіровоградська', 17),
  ('Луганська', 18),
  ('Львівська', 19),
  ('Миколаївська', 20),
  ('Сумська', 21),
  ('Тернопільська', 22),
  ('Херсонська', 23),
  ('Хмельницька', 24),
  ('Черкаська', 25),
  ('Чернівецька', 26),
  ('Чернігівська', 27),
  ('АР Крим', 28)
ON CONFLICT DO NOTHING;

-- 2. ПІДРОЗДІЛИ (departments) — з прив'язкою до regions

-- 1. КИЇВСЬКА ОБЛАСТЬ (12 підрозділів: Управління + ТвУЗ + 10 тестових)
INSERT INTO departments (name, region_id) VALUES
  ('Київське Управління', (SELECT region_id FROM regions WHERE region_name = 'Київська')),
  ('Київський ТвУЗ', (SELECT region_id FROM regions WHERE region_name = 'Київська')),
  ('Київський Підрозділ_1', (SELECT region_id FROM regions WHERE region_name = 'Київська')),
  ('Київський Підрозділ_2', (SELECT region_id FROM regions WHERE region_name = 'Київська')),
  ('Київський Підрозділ_3', (SELECT region_id FROM regions WHERE region_name = 'Київська')),
  ('Київський Підрозділ_4', (SELECT region_id FROM regions WHERE region_name = 'Київська')),
  ('Київський Підрозділ_5', (SELECT region_id FROM regions WHERE region_name = 'Київська')),
  ('Київський Підрозділ_6', (SELECT region_id FROM regions WHERE region_name = 'Київська')),
  ('Київський Підрозділ_7', (SELECT region_id FROM regions WHERE region_name = 'Київська')),
  ('Київський Підрозділ_8', (SELECT region_id FROM regions WHERE region_name = 'Київська')),
  ('Київський Підрозділ_9', (SELECT region_id FROM regions WHERE region_name = 'Київська')),
  ('Київський Підрозділ_10', (SELECT region_id FROM regions WHERE region_name = 'Київська'))
ON CONFLICT DO NOTHING;

-- 2. ХАРКІВСЬКА ОБЛАСТЬ (2 підрозділи: Управління + ТвУЗ)
INSERT INTO departments (name, region_id) VALUES
  ('Харківське Управління', (SELECT region_id FROM regions WHERE region_name = 'Харківська')),
  ('Харківський ТвУЗ', (SELECT region_id FROM regions WHERE region_name = 'Харківська'))
ON CONFLICT DO NOTHING;

-- 3. ПОЛТАВСЬКА ОБЛАСТЬ (2 підрозділи: Управління + ТвУЗ)
INSERT INTO departments (name, region_id) VALUES
  ('Полтавське Управління', (SELECT region_id FROM regions WHERE region_name = 'Полтавська')),
  ('Полтавський ТвУЗ', (SELECT region_id FROM regions WHERE region_name = 'Полтавська'))
ON CONFLICT DO NOTHING;

-- 4. РІВНЕНСЬКА ОБЛАСТЬ (2 підрозділи: Управління + ТвУЗ)
INSERT INTO departments (name, region_id) VALUES
  ('Рівненське Управління', (SELECT region_id FROM regions WHERE region_name = 'Рівненська')),
  ('Рівненський ТвУЗ', (SELECT region_id FROM regions WHERE region_name = 'Рівненська'))
ON CONFLICT DO NOTHING;

-- 5. ОДЕСЬКА ОБЛАСТЬ (2 підрозділи: Управління + ТвУЗ)
INSERT INTO departments (name, region_id) VALUES
  ('Одеське Управління', (SELECT region_id FROM regions WHERE region_name = 'Одеська')),
  ('Одеський ТвУЗ', (SELECT region_id FROM regions WHERE region_name = 'Одеська'))
ON CONFLICT DO NOTHING;

-- 6. ЖИТОМИРСЬКА ОБЛАСТЬ (2 підрозділи: Управління + ТвУЗ)
INSERT INTO departments (name, region_id) VALUES
  ('Житомирське Управління', (SELECT region_id FROM regions WHERE region_name = 'Житомирська')),
  ('Житомирський ТвУЗ', (SELECT region_id FROM regions WHERE region_name = 'Житомирська'))
ON CONFLICT DO NOTHING;

-- 7. РЕШТА ОБЛАСТЕЙ (алфавітно, по 1 підрозділу: Управління)
INSERT INTO departments (name, region_id) VALUES
  ('Вінницьке Управління', (SELECT region_id FROM regions WHERE region_name = 'Вінницька')),
  ('Волинське Управління', (SELECT region_id FROM regions WHERE region_name = 'Волинська')),
  ('Дніпропетровське Управління', (SELECT region_id FROM regions WHERE region_name = 'Дніпропетровська')),
  ('Донецьке Управління', (SELECT region_id FROM regions WHERE region_name = 'Донецька')),
  ('Закарпатське Управління', (SELECT region_id FROM regions WHERE region_name = 'Закарпатська')),
  ('Запорізьке Управління', (SELECT region_id FROM regions WHERE region_name = 'Запорізька')),
  ('Івано-Франківське Управління', (SELECT region_id FROM regions WHERE region_name = 'Івано-Франківська')),
  ('Кіровоградське Управління', (SELECT region_id FROM regions WHERE region_name = 'Кіровоградська')),
  ('Луганське Управління', (SELECT region_id FROM regions WHERE region_name = 'Луганська')),
  ('Львівське Управління', (SELECT region_id FROM regions WHERE region_name = 'Львівська')),
  ('Миколаївське Управління', (SELECT region_id FROM regions WHERE region_name = 'Миколаївська')),
  ('Сумське Управління', (SELECT region_id FROM regions WHERE region_name = 'Сумська')),
  ('Тернопільське Управління', (SELECT region_id FROM regions WHERE region_name = 'Тернопільська')),
  ('Херсонське Управління', (SELECT region_id FROM regions WHERE region_name = 'Херсонська')),
  ('Хмельницьке Управління', (SELECT region_id FROM regions WHERE region_name = 'Хмельницька')),
  ('Черкаське Управління', (SELECT region_id FROM regions WHERE region_name = 'Черкаська')),
  ('Чернівецьке Управління', (SELECT region_id FROM regions WHERE region_name = 'Чернівецька')),
  ('Чернігівське Управління', (SELECT region_id FROM regions WHERE region_name = 'Чернігівська')),
  ('АР Крим Управління', (SELECT region_id FROM regions WHERE region_name = 'АР Крим'))
ON CONFLICT DO NOTHING;

-- Користувачі всіх 5 ролей (паролі = username; plaintext для Етапу 1; bcrypt на Етапі 3)
-- прив'язані до Київського Управління (department_id = 1)
INSERT INTO users (username, password_hash, full_name, role, department_id, is_active) VALUES
    ('admin',      'admin',      'Глобальний Адміністратор', 'global_admin',      NULL, TRUE),
    ('supervisor', 'supervisor', 'Глобальний Супервізор',    'global_supervisor', NULL, TRUE),
    ('kiev_admin', 'kiev_admin', 'Адмін Київського Управління', 'department_admin',  1,    TRUE),
    ('editor',     'editor',     'Редактор Київського',       'editor',            1,    TRUE),
    ('viewer',     'viewer',     'Переглядач Київського',     'viewer',            1,    TRUE)
ON CONFLICT (username) DO NOTHING;

-- Види майна (нормативні строки: роки + години напрацювання)
INSERT INTO asset_types (name, description, normative_life_years, normative_hours) VALUES
    ('Принтер лазерний', 'Лазерний принтер, багатофункціональний пристрій', 5, 40000),
    ('Ноутбук',          'Персональний ноутбук',                            4, 30000),
    ('Монітор',          'Монітор ПК',                                      5, 40000),
    ('Системний блок',   'Системний блок ПК',                               4, 40000)
ON CONFLICT DO NOTHING;

-- ============================================
-- БУДІВЛІ ЗА ЗАМОВЧУВАННЯМ ДЛЯ ВСІХ ПІДРОЗДІЛІВ
-- ============================================

-- Будівля "Управління" для всіх підрозділів
INSERT INTO locations (department_id, building, floor, room)
SELECT d.department_id, 'Управління', NULL, NULL
FROM departments d
ON CONFLICT DO NOTHING;

-- Будівля "ТвУЗ" для підрозділів ТвУЗ в 6 спеціальних областей
INSERT INTO locations (department_id, building, floor, room)
SELECT d.department_id, 'ТвУЗ', NULL, NULL
FROM departments d
WHERE d.name LIKE '% ТвУЗ'
ON CONFLICT DO NOTHING;

-- Будівля "Будівля_підрозділу" для Київський Підрозділ_1...10
INSERT INTO locations (department_id, building, floor, room)
SELECT d.department_id, 'Будівля_підрозділу', NULL, NULL
FROM departments d
WHERE d.name LIKE 'Київський Підрозділ_%'
ON CONFLICT DO NOTHING;
