# 🏢 Asset Management System (WSL Edition)

Система для обліку майна в організації з автоматизованим документообігом.

**Версія:** 1.1.0 (WSL Edition)
**Платформа:** Windows Subsystem for Linux 2 (WSL2) - Ubuntu 22.04 LTS

## 📋 Функціональні можливості

- ✅ Повний облік майна (введення, передача, списання)
- 🔄 Автоматичний розрахунок статусу та строку служби
- 📝 Система актів (введення, передача, списання)
- 👥 Рольовий доступ до даних (4 ролі)
- 🌍 Ієрархічна навігація по локаціях
- 📜 Автоматичний аудит всіх дій
- 🔒 Підтримка офлайн роботи через Docker
- 💾 Офлайн встановлення без доступу до інтернету

## 🖥️ Системні вимоги (WSL)

### Обов'язково:
- **Windows 10/11** з WSL2 встановленим
- **Ubuntu 22.04 LTS** (або інша версія в WSL2)
- **Docker Desktop** для Windows з WSL2 інтеграцією
- **Не менше 4GB RAM** для Docker
- **20GB вільного диску**

### Перевірка WSL2:

```bash
# У Windows PowerShell (з правами адміністратора)
wsl --list --verbose

# Повинно показувати:
# NAME      STATE    VERSION
# Ubuntu    Running  2
```

## 🚀 Швидкий старт (WSL2)

### Крок 1: Підготовка середовища

#### У Windows (PowerShell Admin):

```powershell
# Перевірте статус WSL2
wsl --status

# Якщо WSL2 не встановлено, встановіть:
wsl --install -d Ubuntu-22.04

# Перезавантажте комп'ютер
```

#### У WSL2 (Ubuntu terminal):

```bash
# Оновіть систему
sudo apt update && sudo apt upgrade -y

# Встановіть необхідні інструменти
sudo apt install -y git curl ca-certificates

# Перевірте Docker (повинен бути доступний через WSL2 інтеграцію)
docker --version
docker-compose version
```

### Крок 2: Отримання проекту

```bash
# Клонувати репозиторій (або перейти в папку проекту)
cd /mnt/c/Users/Admin/Desktop/Yarik_Project/asset-management-system

# Або якщо клонуєте з GitHub:
# git clone https://github.com/your-org/asset-management-system.git
# cd asset-management-system
```

### Крок 3: Налаштування

```bash
# Скопіювати та відредагувати .env файл
cp .env.example .env

# Змінити JWT_SECRET на безпечний
nano .env  # або використовуйте vim
```

### Крок 4: Запуск системи

```bash
# Зробіть скрипти виконуваними
chmod +x start.sh stop.sh create-offline-package.sh

# Запустіть систему
./start.sh
```

### Крок 5: Доступ до системи

Відкрийте у браузері:
- 🌐 Frontend: http://localhost:3000
- 🔧 Backend API: http://localhost:5000
- ❤️ Health Check: http://localhost:5000/health

### Облікові дані за замовчуванням:

```
Username: admin
Password: admin123
```

⚠️ **ВАЖЛИВО**: Змініть пароль адміністратора після першого входу!

## 📁 Структура проекту

```
asset-management-system/
├── backend/                    # Backend API (Node.js + Express)
├── frontend/                   # Frontend (React + Ant Design)
├── database/                   # PostgreSQL schema
├── docker-compose.yml          # Docker Compose конфігурація
├── start.sh                   # Скрипт запуску
├── stop.sh                    # Скрипт зупинки
├── create-offline-package.sh  # Офлайн інсталятор
├── .wslconfig                 # WSL конфігурація
├── .env.example               # Template для .env
└── README.md                  # Цей файл
```

## 🔧 Технологічний стек

### Backend:
- **Runtime**: Node.js 18+ (Alpine Linux)
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
- **Reverse Proxy**: Nginx
- **Platform**: WSL2 (Ubuntu 22.04 LTS)

## 👥 Ролі та доступи

### Global Admin (Глобальний адміністратор)
- Повний доступ до всієї системи
- Управління користувачами та підрозділами
- Доступ до всіх логів

### Department Admin (Адмін підрозділу)
- Повний доступ в межах свого підрозділу
- Управління користувачами підрозділу

### Editor (Редактор)
- Створення та редагування актів
- Редагування майна в своєму підрозділі

### Viewer (Переглядач)
- Тільки перегляд даних

## 📝 API Ендпоінти

### Authentication
- `POST /api/auth/login` - Вхід в систему
- `GET /api/auth/me` - Отримати інформацію про користувача
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

## 🐳 Docker Commands

```bash
# Запуск всіх сервісів
docker-compose up -d

# Зупинка всіх сервісів
docker-compose down

# Перегляд логів
docker-compose logs -f

# Перегляд логів конкретного сервісу
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres

# Рестарт сервісів
docker-compose restart

# Перевірка статусу
docker-compose ps
```

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

## 🔧 WSL2 Оптимізація

### Створіть файл `.wslconfig` у Windows (`C:\Users\<YourUser>\.wslconfig`):

```ini
[wsl2]
memory=8GB
processors=4
swap=2GB
localhostForwarding=true
```

### Додайте `/etc/wsl.conf` в Ubuntu:

```bash
sudo bash -c 'cat > /etc/wsl.conf << EOF
[network]
generateHosts = false
generateResolvConf = false

[boot]
systemd = true
EOF'
```

### Перезапустіть WSL з Windows PowerShell:

```powershell
wsl --shutdown
```

## 🐛 Troubleshooting

### Docker не працює в WSL2

```bash
# Перевірте Docker Desktop
# Settings > General > Use the WSL 2 based engine

# Перевірте, що Docker доступний
docker --version
docker ps
```

### Проблеми з портами

```bash
# Перевірте зайняті порти
sudo netstat -tuln | grep -E ':(3000|5000|5432)'

# Звільніть порт, якщо потрібно
sudo kill <PID>
```

### Проблеми з файлами

```bash
# Переконайтеся, що скрипти виконувані
chmod +x *.sh

# Перевірте права доступу
ls -la *.sh
```

### Перевірка здоров'я сервісів

```bash
# Health check
curl http://localhost:5000/health

# Перевірка бази даних
docker exec asset-management-db pg_isready -U postgres

# Перегляд логів
docker-compose logs --tail=50 backend
```

## 📄 License

MIT License - дивіться файл LICENSE для деталей.

## 🤝 Contributing

Дивіться [CONTRIBUTING.md](CONTRIBUTING.md) для деталей.

## 📞 Support

Для зв'язку та підтримки:
- Email: support@your-organization.com
- Issues: https://github.com/your-org/asset-management-system/issues

---

**Версія:** 1.1.0 (WSL Edition)
**Дата останнього оновлення:** 2026-06-14
**Платформа:** WSL2 (Ubuntu 22.04 LTS)
