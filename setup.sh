#!/bin/bash

# Скрипт установки и настройки сервера музыкальной библиотеки

echo "Установка зависимостей..."
pip install -r requirements.txt

echo "Создание базы данных (требуется PostgreSQL)..."
echo "Пожалуйста, убедитесь, что PostgreSQL запущен и доступен"
echo "Для создания базы данных выполните:"
echo "  createdb music_library"
echo "  psql -d music_library -f database_schema.sql"
echo

echo "Для быстрого запуска выполните:"
echo "  export DB_HOST=localhost"
echo "  export DB_NAME=music_library"
echo "  export DB_USER=postgres"
echo "  export DB_PASSWORD=ваш_пароль"
echo "  export SECRET_KEY=ваш_секретный_ключ"
echo "  python server.py"
echo

echo "Готово! Не забудьте настроить переменные окружения перед запуском сервера."