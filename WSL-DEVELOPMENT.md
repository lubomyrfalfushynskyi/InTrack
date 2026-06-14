# WSL Development Guide

Цей документ містить інструкції для налаштування та розробки проекту в WSL2 (Ubuntu) середовищі.

## Підготовка WSL2

### 1. Встановлення WSL2

У Windows PowerShell (з правами адміністратора):

```powershell
# Оновіть WSL
wsl --update

# Встановіть Ubuntu 22.04
wsl --install -d Ubuntu-22.04

# Перезавантажте комп'ютер
```

### 2. Налаштування WSL

#### Windows - `.wslconfig`

Створіть файл `C:\Users\<YourUsername>\.wslconfig`:

```ini
[wsl2]
memory=8GB
processors=4
swap=2GB
localhostForwarding=true
```

#### Ubuntu - `/etc/wsl.conf`

```bash
sudo bash -c 'cat > /etc/wsl.conf << EOF
[network]
generateHosts = false
generateResolvConf = false

[boot]
systemd = true
EOF'
```

### 3. Перезапустіть WSL

```powershell
wsl --shutdown
```

## Встановлення Docker Desktop

1. Завантажте Docker Desktop для Windows: https://www.docker.com/products/docker-desktop

2. Під час встановлення:
   - Увімкніть "Use WSL 2 based engine"
   - Увімкніть "Add shortcut to desktop"

3. Після встановлення:
   - Відкрийте Docker Desktop
   - Settings → General → Увімкніть "Use the WSL 2 based engine"
   - Settings → Resources → WSL Integration → Увімкніть Ubuntu

## Налаштування проекту

### 1. Перейдіть в папку проекту в WSL

```bash
cd /mnt/c/Users/Admin/Desktop/Yarik_Project/asset-management-system
```

### 2. Запустіть скрипт налаштування

```bash
./setup-wsl.sh
```

### 3. Запустіть систему

```bash
./start.sh
```

## Розробка

### Backend розробка

```bash
# Увійдіть в backend контейнер
docker-compose exec backend bash

# Встановіть залежності (якщо потрібно)
npm install

# Запустіть в режимі розробки (якщо налаштовано)
npm run dev
```

### Frontend розробка

```bash
# Увійдіть в frontend контейнер
docker-compose exec frontend sh

# Встановіть залежності (якщо потрібно)
npm install

# Запустіть в режимі розробки
npm run dev
```

### Робота з базою даних

```bash
# Підключення до PostgreSQL
docker-compose exec postgres psql -U postgres asset_management

# Запуск SQL скриптів
docker-compose exec postgres psql -U postgres -d asset_management -f /path/to/script.sql

# Backup
docker-compose exec postgres pg_dump -U postgres asset_management > backup.sql

# Restore
docker-compose exec -T postgres psql -U postgres asset_management < backup.sql
```

## Корисні команди

### Перегляд логів

```bash
# Всі логи
docker-compose logs -f

# Конкретний сервіс
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres

# Останні 100 рядків
docker-compose logs --tail=100 backend
```

### Управління контейнерами

```bash
# Статус
docker-compose ps

# Рестарт
docker-compose restart

# Зупинка
docker-compose down

# Повна очистка (разом з томами)
docker-compose down -v
```

### Моніторинг ресурсів

```bash
# Використання дисків
df -h

# Використання пам'яті
free -h

# Процеси
top
```

## Вирішення проблем

### Docker не працює в WSL

1. Перевірте, що Docker Desktop запущений
2. Перевірте налаштування WSL Integration в Docker Desktop
3. Перезавантажте WSL: `wsl --shutdown` в PowerShell

### Проблеми з портами

```bash
# Перевірка зайнятих портів
sudo netstat -tuln | grep -E ':(3000|5000|5432)'

# Звільнення порту
sudo kill <PID>
```

### Помилки доступу до файлів

```bash
# Перевірте права доступу
ls -la

# Зміна власника
sudo chown -R $USER:$USER .

# Зміна прав
chmod +x *.sh
```

### Проблеми з мережею

```bash
# Перевірте DNS
cat /etc/resolv.conf

# Оновіть DNS (якщо потрібно)
sudo bash -c 'echo "nameserver 8.8.8.8" > /etc/resolv.conf'

# Перевірте з'єднання
ping google.com
curl http://localhost:5000/health
```

## Продуктивність

### Оптимізація файлової системи

Розмістіть проект у WSL файловій системі для кращої продуктивності:

```bash
# Копіюйте проект з Windows файлової системи
cp -r /mnt/c/Users/Admin/Desktop/Yarik_Project/asset-management-system ~/
cd ~/asset-management-system
```

### Оптимізація Docker

```bash
# Очистка неиспользуемых ресурсов
docker system prune -a

# Перегляд використання дисків
docker system df
```

## Hot Reload

Для налаштування hot reload під час розробки, використовуйте volumes в docker-compose.yml:

```yaml
backend:
  volumes:
    - ./backend/src:/app/src
    - /app/node_modules
```

## Профайлинг

```bash
# CPU профайлінг
docker stats

# Пам'ять
docker stats --no-stream
```

## Корисні посилання

- [WSL Documentation](https://docs.microsoft.com/en-us/windows/wsl/)
- [Docker Desktop WSL2](https://docs.docker.com/desktop/windows/wsl/)
- [Ubuntu Documentation](https://ubuntu.com/server/docs)
