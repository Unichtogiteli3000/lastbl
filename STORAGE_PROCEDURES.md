# Документация по хранимым процедурам и функциям

## Общая информация
Все операции с базой данных в системе "Музыкальная библиотека" выполняются через хранимые процедуры, написанные на языке PL/pgSQL. Это обеспечивает безопасность, контроль доступа и аудит всех операций.

## Таблицы базы данных

### user
- user_id: SERIAL PRIMARY KEY
- login: VARCHAR(50) UNIQUE NOT NULL
- password_hash: TEXT NOT NULL
- first_name: VARCHAR(100)
- last_name: VARCHAR(100)
- email: VARCHAR(100)
- avatar_url: TEXT
- is_admin: BOOLEAN DEFAULT FALSE
- is_active: BOOLEAN DEFAULT TRUE
- created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- updated_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP

### genres
- genre_id: SERIAL PRIMARY KEY
- name: VARCHAR(100) UNIQUE NOT NULL
- created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP

### artists
- artist_id: SERIAL PRIMARY KEY
- name: VARCHAR(100) UNIQUE NOT NULL
- created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP

### tracks
- track_id: SERIAL PRIMARY KEY
- title: VARCHAR(255) NOT NULL
- artist_id: INTEGER NOT NULL
- genre_id: INTEGER NOT NULL
- bpm: INTEGER
- duration_sec: INTEGER
- created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- user_id: INTEGER NOT NULL

### collections
- collection_id: SERIAL PRIMARY KEY
- user_id: INTEGER NOT NULL
- name: VARCHAR(255) NOT NULL
- is_favorite: BOOLEAN DEFAULT FALSE
- created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP

### collection_tracks
- collection_id: INTEGER
- track_id: INTEGER
- added_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP

### user_favorite_genres
- user_id: INTEGER
- genre_id: INTEGER

### user_favorite_artists
- user_id: INTEGER
- artist_id: INTEGER

### audit_log
- log_id: SERIAL PRIMARY KEY
- user_id: INTEGER
- operation_type: VARCHAR(20) NOT NULL ('INSERT', 'UPDATE', 'DELETE')
- table_name: VARCHAR(50) NOT NULL
- record_id: INTEGER
- operation_time: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- details: JSONB

## Хранимые процедуры и функции

### 1. authenticate_user(p_login, p_password)
**Назначение:** Аутентификация пользователя
**Параметры:**
- p_login: VARCHAR(50) - логин пользователя
- p_password: VARCHAR(255) - пароль пользователя
**Возвращает:** Таблицу с информацией о пользователе и статусом аутентификации
**Описание:** Проверяет логин и пароль пользователя, возвращает информацию о пользователе при успешной аутентификации

### 2. register_user(p_login, p_password, p_first_name, p_last_name, p_email)
**Назначение:** Регистрация нового пользователя
**Параметры:**
- p_login: VARCHAR(50) - логин пользователя
- p_password: VARCHAR(255) - пароль пользователя
- p_first_name: VARCHAR(100) - имя пользователя
- p_last_name: VARCHAR(100) - фамилия пользователя
- p_email: VARCHAR(100) - email пользователя
**Возвращает:** Таблицу с информацией о созданном пользователе
**Описание:** Создает нового пользователя с указанными параметрами

### 3. get_user_profile(p_user_id)
**Назначение:** Получение профиля пользователя
**Параметры:**
- p_user_id: INTEGER - ID пользователя
**Возвращает:** Таблицу с информацией о пользователе
**Описание:** Возвращает информацию о пользователе по его ID

### 4. update_user_profile(p_user_id, p_first_name, p_last_name, p_email, p_avatar_url)
**Назначение:** Обновление профиля пользователя
**Параметры:**
- p_user_id: INTEGER - ID пользователя
- p_first_name: VARCHAR(100) - имя пользователя
- p_last_name: VARCHAR(100) - фамилия пользователя
- p_email: VARCHAR(100) - email пользователя
- p_avatar_url: TEXT - URL аватара
**Возвращает:** success BOOLEAN
**Описание:** Обновляет информацию о пользователе

### 5. get_user_favorite_genres(p_user_id)
**Назначение:** Получение любимых жанров пользователя
**Параметры:**
- p_user_id: INTEGER - ID пользователя
**Возвращает:** Таблицу с любимыми жанрами
**Описание:** Возвращает список любимых жанров пользователя

### 6. get_user_favorite_artists(p_user_id)
**Назначение:** Получение любимых исполнителей пользователя
**Параметры:**
- p_user_id: INTEGER - ID пользователя
**Возвращает:** Таблицу с любимыми исполнителями
**Описание:** Возвращает список любимых исполнителей пользователя

### 7. get_all_genres()
**Назначение:** Получение всех жанров
**Параметры:** Нет
**Возвращает:** Таблицу со всеми жанрами
**Описание:** Возвращает список всех доступных жанров

### 8. get_all_artists()
**Назначение:** Получение всех исполнителей
**Параметры:** Нет
**Возвращает:** Таблицу со всеми исполнителями
**Описание:** Возвращает список всех доступных исполнителей

### 9. add_artist(p_name)
**Назначение:** Добавление нового исполнителя
**Параметры:**
- p_name: VARCHAR(100) - имя исполнителя
**Возвращает:** Таблицу с ID и именем созданного исполнителя
**Описание:** Создает нового исполнителя

### 10. update_artist(p_artist_id, p_name)
**Назначение:** Обновление информации об исполнителе
**Параметры:**
- p_artist_id: INTEGER - ID исполнителя
- p_name: VARCHAR(100) - новое имя исполнителя
**Возвращает:** success BOOLEAN
**Описание:** Обновляет имя исполнителя

### 11. delete_artist(p_artist_id)
**Назначение:** Удаление исполнителя
**Параметры:**
- p_artist_id: INTEGER - ID исполнителя
**Возвращает:** success BOOLEAN
**Описание:** Удаляет исполнителя, если у него нет связанных треков

### 12. add_track(p_user_id, p_title, p_artist_id, p_genre_id, p_bpm, p_duration_sec)
**Назначение:** Добавление нового трека
**Параметры:**
- p_user_id: INTEGER - ID пользователя
- p_title: VARCHAR(255) - название трека
- p_artist_id: INTEGER - ID исполнителя
- p_genre_id: INTEGER - ID жанра
- p_bpm: INTEGER - BPM
- p_duration_sec: INTEGER - длительность в секундах
**Возвращает:** Таблицу с информацией о созданном треке
**Описание:** Создает новый трек для пользователя

### 13. update_track(p_track_id, p_title, p_artist_id, p_genre_id, p_bpm, p_duration_sec)
**Назначение:** Обновление информации о треке
**Параметры:**
- p_track_id: INTEGER - ID трека
- p_title: VARCHAR(255) - новое название
- p_artist_id: INTEGER - ID исполнителя
- p_genre_id: INTEGER - ID жанра
- p_bpm: INTEGER - BPM
- p_duration_sec: INTEGER - длительность в секундах
**Возвращает:** success BOOLEAN
**Описание:** Обновляет информацию о треке

### 14. delete_track(p_track_id)
**Назначение:** Удаление трека
**Параметры:**
- p_track_id: INTEGER - ID трека
**Возвращает:** success BOOLEAN
**Описание:** Удаляет трек

### 15. get_user_tracks(p_user_id)
**Назначение:** Получение треков пользователя
**Параметры:**
- p_user_id: INTEGER - ID пользователя
**Возвращает:** Таблицу с треками пользователя
**Описание:** Возвращает все треки, принадлежащие пользователю

### 16. get_all_tracks_admin()
**Назначение:** Получение всех треков (для администраторов)
**Параметры:** Нет
**Возвращает:** Таблицу со всеми треками
**Описание:** Возвращает все треки в системе с информацией о владельце

### 17. create_collection(p_user_id, p_name, p_is_favorite)
**Назначение:** Создание коллекции
**Параметры:**
- p_user_id: INTEGER - ID пользователя
- p_name: VARCHAR(255) - название коллекции
- p_is_favorite: BOOLEAN - является ли коллекцией "любимых треков"
**Возвращает:** Таблицу с информацией о созданной коллекции
**Описание:** Создает новую коллекцию для пользователя

### 18. update_collection(p_collection_id, p_name, p_is_favorite)
**Назначение:** Обновление коллекции
**Параметры:**
- p_collection_id: INTEGER - ID коллекции
- p_name: VARCHAR(255) - новое название
- p_is_favorite: BOOLEAN - статус "любимой коллекции"
**Возвращает:** success BOOLEAN
**Описание:** Обновляет информацию о коллекции

### 19. delete_collection(p_collection_id)
**Назначение:** Удаление коллекции
**Параметры:**
- p_collection_id: INTEGER - ID коллекции
**Возвращает:** success BOOLEAN
**Описание:** Удаляет коллекцию

### 20. get_user_collections(p_user_id)
**Назначение:** Получение коллекций пользователя
**Параметры:**
- p_user_id: INTEGER - ID пользователя
**Возвращает:** Таблицу с коллекциями пользователя
**Описание:** Возвращает все коллекции пользователя

### 21. add_track_to_collection(p_collection_id, p_track_id)
**Назначение:** Добавление трека в коллекцию
**Параметры:**
- p_collection_id: INTEGER - ID коллекции
- p_track_id: INTEGER - ID трека
**Возвращает:** success BOOLEAN
**Описание:** Добавляет трек в указанную коллекцию

### 22. remove_track_from_collection(p_collection_id, p_track_id)
**Назначение:** Удаление трека из коллекции
**Параметры:**
- p_collection_id: INTEGER - ID коллекции
- p_track_id: INTEGER - ID трека
**Возвращает:** success BOOLEAN
**Описание:** Удаляет трек из указанной коллекции

### 23. search_tracks(p_title, p_artist, p_genre_id, p_bpm, p_duration)
**Назначение:** Поиск треков по различным критериям
**Параметры:**
- p_title: VARCHAR(255) - название трека
- p_artist: VARCHAR(100) - имя исполнителя
- p_genre_id: INTEGER - ID жанра
- p_bpm: INTEGER - BPM
- p_duration: INTEGER - длительность
**Возвращает:** Таблицу с найденными треками
**Описание:** Выполняет поиск треков по указанным критериям

### 24. get_all_users_admin()
**Назначение:** Получение всех пользователей (для администраторов)
**Параметры:** Нет
**Возвращает:** Таблицу со всеми пользователями
**Описание:** Возвращает информацию о всех пользователях системы

### 25. get_audit_log()
**Назначение:** Получение журнала аудита
**Параметры:** Нет
**Возвращает:** Таблицу с записями аудита
**Описание:** Возвращает журнал всех операций в системе

## Триггеры

### 1. update_user_updated_at
**Таблица:** user
**Тип:** BEFORE UPDATE
**Описание:** Автоматически обновляет поле updated_at при изменении пользователя

### 2. audit_track_operations
**Таблица:** tracks
**Тип:** AFTER INSERT/UPDATE/DELETE
**Описание:** Автоматически записывает в журнал аудита все операции с треками

### 3. audit_user_operations
**Таблица:** user
**Тип:** AFTER INSERT/UPDATE/DELETE
**Описание:** Автоматически записывает в журнал аудита все операции с пользователями

## Безопасность и аудит

### Разграничение прав
- Обычные пользователи могут работать только со своими данными
- Администраторы имеют доступ ко всей базе данных
- Все операции проверяют права доступа перед выполнением

### Аудит
- Все операции добавления, изменения и удаления записываются в таблицу audit_log
- Журнал содержит информацию о пользователе, типе операции, таблице, ID записи и деталях
- Используются триггеры для автоматического аудита

### Хранимые процедуры как интерфейс к БД
- Все операции с базой данных выполняются только через хранимые процедуры
- Это предотвращает SQL-инъекции и обеспечивает контроль бизнес-логики на стороне сервера БД