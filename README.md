# 🏢 Asset Management System

Система для обліку майна в організації з автоматизованим документообігом.

## 📋 Функціональні можливості

- ✅ Повний облік майна (введення, передача, списання)
- 🔄 Автоматичний розрахунок статусу та строку служби
- 📝 Система актів (введення, передача, списання)
- 👥 Рольовий доступ до даних (глобальний адмін, адмін підрозділу, редактор, переглядач)
- 🌍 Ієрархічна навігація по локаціях (регіон → будівля → приміщення → поверх)
- 📜 Автоматичний аудит всіх дій
- 🔒 Підтримка офлайн роботи через Docker
- 💾 Офлайн встановлення без доступу до інтернету

## 🚀 Швидкий старт

### Спосіб 1: Швидкий запуск (скрипти)

#### Вимоги:
- Docker 20.10+
- Docker Compose 2.0+
- 2GB вільного диску

#### Встановлення:

```bash
# Для Linux/Mac
./start.sh

# Для Windows
start.bat
```

Система автоматично:
1. Перевірить Docker
2. Створить .env файл (якщо немає)
3. Збілдить Docker образи
4. Запустить всі сервіси

### Спосіб 2: Ручний запуск

```bash
# Клонувати репозиторій
git clone https://github.com/your-org/asset-management-system.git
cd asset-management-system

# Скопіювати .env файл
cp .env.example .env

# Редагувати .env та змінити JWT_SECRET!
# nano .env  # або vim .env

# Запустити систему
docker-compose up -d

# Перевірити статус
docker-compose ps
```

Сервіси будуть доступні за адресами:
- 🌐 Frontend: http://localhost:3000
- 🔧 Backend API: http://localhost:5000
- ❤️ Health Check: http://localhost:5000/health

#### Облікові дані за замовчуванням:

```
Username: admin
Password: admin123
```

⚠️ **ВАЖЛИВО**: Змініть пароль адміністратора після першого входу!

### Управління сервісами

#### Скрипти:

```bash
# Linux/Mac
./start.sh    # Запуск
./stop.sh     # Зупинка

# Windows
start.bat     # Запуск
stop.bat      # Зупинка
```

#### Docker Compose:

```bash
# Запустити всі сервіси
docker-compose up -d

# Зупинити всі сервіси
docker-compose down

# Перезапустити сервіси
docker-compose restart

# Переглянути логи
docker-compose logs -f

# Переглянути логи конкретного сервісу
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
```

### Офлайн встановлення (без інтернету)

#### Встановлення на машині з інтернетом:

```bash
# Створити офлайн пакет
./create-offline-package.sh

# Пакет буде створено в ./offline-package/
```

#### Перенесення на офлайн машину:

1. Скопіюйте папку `offline-package` на USB флешку
2. Перенесіть на цільову машину
3. Запустіть установку:

```bash
cd offline-package
./install.sh
```

## 📁 Структура проекту

```
asset-management-system/
├── backend/                    # Backend API (Node.js + Express)
│   ├── src/
│   │   ├── config/            # Конфігурація
│   │   ├── controllers/       # Контролери
│   │   ├── middleware/         # Middleware (auth, audit)
│   │   ├── routes/            # API routes
│   │   ├── services/          # Сервіси (db, logger)
│   │   └── server.js          # Головний файл сервера
│   ├── Dockerfile
│   └── package.json
│
├── frontend/                   # Frontend (React + Ant Design)
│   ├── src/
│   │   ├── components/        # React компоненти
│   │   ├── pages/             # Сторінки додатку
│   │   ├── services/          # API клієнти
│   │   ├── store/             # State management (Zustand)
│   │   └── App.jsx            # Головний компонент
│   ├── Dockerfile
│   └── package.json
│
├── database/                   # База даних
│   └── init/
│       └── schema.sql         # SQL схема
│
├── docker-compose.yml          # Docker Compose конфігурація
├── docker-compose.offline.yml  # Офлайн конфігурація
├── create-offline-package.sh   # Скрипт створення офлайн пакету
└── README.md
```

## 🔧 Технологічний стек

### Backend:
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL 15
- **Authentication**: JWT + bcrypt
- **Logging**: Winston
- **Architecture**: REST API

### Frontend:
- **Framework**: React 18
- **UI Library**: Ant Design
- **State Management**: Zustand
- **Build Tool**: Vite
- **HTTP Client**: Axios

### Infrastructure:
- **Containerization**: Docker + Docker Compose
- **Reverse Proxy**: Nginx (опціонально)
- **TLS**: Let's Encrypt або self-signed certs

## 👥 Ролі та доступи

### Global Admin (Глобальний адміністратор)
- Повний доступ до всієї системи
- Управління користувачами та підрозділами
- Доступ до всіх логів
- Налаштування системи

### Department Admin (Адмін підрозділу)
- Повний доступ в межах свого підрозділу
- Управління користувачами підрозділу
- Доступ до логів підрозділу

### Editor (Редактор)
- Створення та редагування актів
- Редагування майна в своєму підрозділі
- Без доступу до логів

### Viewer (Переглядач)
- Тільки перегляд даних
- Без права редагування

## 📝 API Ендпоінти

### Authentication
- `POST /api/auth/login` - Вхід в систему
- `GET /api/auth/me` - Отримати інформацію про поточного користувача
- `POST /api/auth/change-password` - Змінити пароль

### Assets
- `GET /api/assets` - Отримати список майна
- `GET /api/assets/:id` - Отримати деталі майна
- `POST /api/assets` - Створити майно
- `PUT /api/assets/:id` - Оновити майно
- `DELETE /api/assets/:id` - Видалити майно

### Acts
- `GET /api/acts` - Отримати список актів
- `POST /api/acts/introduction` - Акт введення
- `POST /api/acts/transfer` - Акт передачі
- `POST /api/acts/write-off` - Акт списання

### Users
- `GET /api/users` - Отримати список користувачів
- `POST /api/users` - Створити користувача
- `PUT /api/users/:id` - Оновити користувача
- `DELETE /api/users/:id` - Видалити користувача

## 🔧 Налаштування

### Environment Variables

```bash
# Server
NODE_ENV=production
PORT=5000

# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=asset_management
DB_USER=postgres
DB_PASSWORD=your-secure-password

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=24h

# Logging
LOG_LEVEL=info

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000
```

## 🔒 Безпека

- JWT токени для аутентифікації
- Bcrypt для хешування паролів
- Rate limiting для API
- CORS для захисту від CSRF
- Audit logging для всіх CRUD операцій
- Role-based access control

## 📦 Backup та Restore

```bash
# Backup database
docker exec asset-management-db pg_dump -U postgres asset_management > backup.sql

# Restore database
docker exec -i asset-management-db psql -U postgres asset_management < backup.sql

# Backup volumes
docker run --rm -v asset_management_postgres_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/postgres-backup.tar.gz -C /data .
```

## 🐛 Troubleshooting

### Сервіси не запускаються

```bash
# Перевірити логи
docker-compose logs

# Перевірити статус контейнерів
docker-compose ps

# Перезапустити сервіси
docker-compose restart
```

### Проблеми з базою даних

```bash
# Перевірити з'єднання з базою
docker exec asset-management-db psql -U postgres -d asset_management

# Переглянути логи бази даних
docker logs asset-management-db
```

### Проблеми з портом

```bash
# Перевірити зайняті порти
netstat -tuln | grep -E ':(3000|5000|5432)'

# Змінити порти в docker-compose.yml
```

## 📄 License

MIT License - дивіться файл LICENSE для деталей.

## 🤝 Contributing

1. Fork проекту
2. Створіть feature branch
3. Commit ваші зміни
4. Push в branch
5. Створіть Pull Request

## 📞 Support

Для зв'язку та підтримки:
- Email: support@your-organization.com
- Issues: https://github.com/your-org/asset-management-system/issues

---

**Версія**: 1.0.0
**Дата останнього оновлення**: 2026
