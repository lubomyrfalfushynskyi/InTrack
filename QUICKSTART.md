# 🚀 Quick Start - Asset Management System (WSL Edition)

Швидкий старт для WSL2 (Ubuntu) середовища.

## ⚡ Швидкий старт (3 кроки)

### 1️⃣ Підготовка WSL (перший раз)

У Windows PowerShell (Admin):
```powershell
wsl --install -d Ubuntu-22.04
```

Після встановлення перезавантажте комп'ютер.

### 2️⃣ Встановлення Docker Desktop

1. Завантажте: https://www.docker.com/products/docker-desktop
2. Встановіть і увімкніть WSL2 інтеграцію

### 3️⃣ Запуск системи

```bash
# У WSL terminal
cd /mnt/c/Users/Admin/Desktop/Yarik_Project/asset-management-system

# Налаштування (перший раз)
./setup-wsl.sh

# Запуск
./start.sh
```

## 🌐 Доступ

- **Frontend:** http://localhost:3000
- **Backend:** http://localhost:5000
- **Health:** http://localhost:5000/health

## 👤 Облікові дані

```
Username: admin
Password: admin123
```

⚠️ **Змініть пароль після першого входу!**

## 📋 Корисні команди

```bash
./start.sh      # Запуск системи
./stop.sh       # Зупинка
./status.sh     # Перевірка статусу

docker-compose logs -f    # Логи
docker-compose restart    # Рестарт
```

## 🐛 Проблеми?

### Docker не працює
```powershell
# У Windows PowerShell (Admin)
wsl --shutdown
```
Потім відкрийте Docker Desktop і WSL знову.

### Порти зайняті
```bash
sudo netstat -tuln | grep -E ':(3000|5000|5432)'
sudo kill <PID>
```

### Детальніше: [WSL-DEVELOPMENT.md](WSL-DEVELOPMENT.md)

---

**Версія:** 1.1.0 (WSL Edition)
**Платформа:** WSL2 (Ubuntu 22.04 LTS)
