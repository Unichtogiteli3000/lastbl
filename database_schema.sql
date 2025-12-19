-- Музыкальная библиотека - Схема базы данных и хранимые процедуры

-- Включение расширения для шифрования паролей
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Таблица пользователей
CREATE TABLE IF NOT EXISTS "user" (
    user_id SERIAL PRIMARY KEY,
    login VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(100),
    avatar_url TEXT,
    is_admin BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица жанров
CREATE TABLE IF NOT EXISTS genres (
    genre_id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица исполнителей
CREATE TABLE IF NOT EXISTS artists (
    artist_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES "user"(user_id) ON DELETE CASCADE,
    UNIQUE(user_id, name) -- Один и тот же автор может быть у разных пользователей, но у одного пользователя имя должно быть уникальным
);

-- Таблица треков
CREATE TABLE IF NOT EXISTS tracks (
    track_id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    artist_id INTEGER NOT NULL,
    genre_id INTEGER NOT NULL,
    bpm INTEGER,
    duration_sec INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER NOT NULL,
    FOREIGN KEY (artist_id) REFERENCES artists(artist_id) ON DELETE CASCADE,
    FOREIGN KEY (genre_id) REFERENCES genres(genre_id) ON DELETE RESTRICT,
    FOREIGN KEY (user_id) REFERENCES "user"(user_id) ON DELETE CASCADE
);

-- Таблица коллекций
CREATE TABLE IF NOT EXISTS collections (
    collection_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    is_favorite BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES "user"(user_id) ON DELETE CASCADE
);

-- Таблица связи коллекций и треков
CREATE TABLE IF NOT EXISTS collection_tracks (
    collection_id INTEGER,
    track_id INTEGER,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (collection_id, track_id),
    FOREIGN KEY (collection_id) REFERENCES collections(collection_id) ON DELETE CASCADE,
    FOREIGN KEY (track_id) REFERENCES tracks(track_id) ON DELETE CASCADE
);

-- Таблица любимых жанров пользователя
CREATE TABLE IF NOT EXISTS user_favorite_genres (
    user_id INTEGER,
    genre_id INTEGER,
    PRIMARY KEY (user_id, genre_id),
    FOREIGN KEY (user_id) REFERENCES "user"(user_id) ON DELETE CASCADE,
    FOREIGN KEY (genre_id) REFERENCES genres(genre_id) ON DELETE CASCADE
);

-- Таблица любимых исполнителей пользователя
CREATE TABLE IF NOT EXISTS user_favorite_artists (
    user_id INTEGER,
    artist_id INTEGER,
    PRIMARY KEY (user_id, artist_id),
    FOREIGN KEY (user_id) REFERENCES "user"(user_id) ON DELETE CASCADE,
    FOREIGN KEY (artist_id) REFERENCES artists(artist_id) ON DELETE CASCADE
);

-- Таблица аудита
CREATE TABLE IF NOT EXISTS audit_log (
    log_id SERIAL PRIMARY KEY,
    user_id INTEGER,
    operation_type VARCHAR(20) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    table_name VARCHAR(50) NOT NULL,
    record_id INTEGER,
    operation_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    details JSONB,
    FOREIGN KEY (user_id) REFERENCES "user"(user_id) ON DELETE SET NULL
);

-- Триггер для обновления времени изменения пользователя
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_updated_at 
    BEFORE UPDATE ON "user" 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Триггеры для аудита операций

-- Триггер для аудита операций с треками
CREATE OR REPLACE FUNCTION audit_track_operations()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        INSERT INTO audit_log (user_id, operation_type, table_name, record_id, details)
        VALUES (OLD.user_id, 'DELETE', 'tracks', OLD.track_id, 
                json_build_object('title', OLD.title, 'artist_id', OLD.artist_id, 'genre_id', OLD.genre_id));
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO audit_log (user_id, operation_type, table_name, record_id, details)
        VALUES (NEW.user_id, 'UPDATE', 'tracks', NEW.track_id, 
                json_build_object('old_title', OLD.title, 'new_title', NEW.title, 
                                 'old_artist_id', OLD.artist_id, 'new_artist_id', NEW.artist_id,
                                 'old_genre_id', OLD.genre_id, 'new_genre_id', NEW.genre_id));
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO audit_log (user_id, operation_type, table_name, record_id, details)
        VALUES (NEW.user_id, 'INSERT', 'tracks', NEW.track_id, 
                json_build_object('title', NEW.title, 'artist_id', NEW.artist_id, 'genre_id', NEW.genre_id));
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

CREATE TRIGGER audit_tracks_trigger
    AFTER INSERT OR UPDATE OR DELETE ON tracks
    FOR EACH ROW EXECUTE FUNCTION audit_track_operations();

-- Триггер для аудита операций с пользователями
CREATE OR REPLACE FUNCTION audit_user_operations()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        -- When deleting a user, set user_id to NULL since the user no longer exists
        INSERT INTO audit_log (user_id, operation_type, table_name, record_id, details)
        VALUES (NULL, 'DELETE', 'user', OLD.user_id, 
                json_build_object('login', OLD.login, 'deleted_user_id', OLD.user_id));
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO audit_log (user_id, operation_type, table_name, record_id, details)
        VALUES (NEW.user_id, 'UPDATE', 'user', NEW.user_id, 
                json_build_object('old_login', OLD.login, 'new_login', NEW.login));
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO audit_log (user_id, operation_type, table_name, record_id, details)
        VALUES (NEW.user_id, 'INSERT', 'user', NEW.user_id, 
                json_build_object('login', NEW.login));
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

CREATE TRIGGER audit_users_trigger
    AFTER INSERT OR UPDATE OR DELETE ON "user"
    FOR EACH ROW EXECUTE FUNCTION audit_user_operations();

-- Хранимые процедуры

-- Процедура аутентификации пользователя
CREATE OR REPLACE FUNCTION authenticate_user(
    p_login VARCHAR(50),
    p_password VARCHAR(255)
)
RETURNS TABLE(
    success BOOLEAN,
    user_id INTEGER,
    login VARCHAR(50),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(100),
    avatar_url TEXT,
    is_admin BOOLEAN
) AS $$
DECLARE
    user_record RECORD;
    decrypted_password TEXT;
BEGIN
    SELECT u.*
    INTO user_record
    FROM "user" u
    WHERE u.login = p_login AND u.is_active = true;
    
    -- If user not found, return failure
    IF user_record IS NULL THEN
        RETURN QUERY SELECT 
            false::BOOLEAN,
            NULL::INTEGER,
            NULL::VARCHAR(50),
            NULL::VARCHAR(100),
            NULL::VARCHAR(100),
            NULL::VARCHAR(100),
            NULL::TEXT,
            NULL::BOOLEAN;
        RETURN;
    END IF;
    
    -- Decrypt password (assuming base64 format)
    BEGIN
        decrypted_password := pgp_sym_decrypt(
            decode(user_record.password_hash, 'base64'), 
            'music_library_key'
        );
    EXCEPTION
        WHEN OTHERS THEN
            -- If base64 decode fails, try as bytea (for old format)
            BEGIN
                decrypted_password := pgp_sym_decrypt(
                    user_record.password_hash::bytea,
                    'music_library_key'
                );
                -- Convert to base64 for future use
                UPDATE "user"
                SET password_hash = encode(user_record.password_hash::bytea, 'base64')::TEXT
                WHERE user_id = user_record.user_id;
            EXCEPTION
                WHEN OTHERS THEN
                    decrypted_password := NULL;
            END;
    END;
    
    -- Check if password matches
    IF decrypted_password IS NOT NULL AND decrypted_password = p_password THEN
            RETURN QUERY SELECT 
                true::BOOLEAN AS success,
                user_record.user_id,
                user_record.login,
                user_record.first_name,
                user_record.last_name,
                user_record.email,
                user_record.avatar_url,
                user_record.is_admin;
        ELSE
            RETURN QUERY SELECT 
            false::BOOLEAN,
            NULL::INTEGER,
            NULL::VARCHAR(50),
            NULL::VARCHAR(100),
            NULL::VARCHAR(100),
            NULL::VARCHAR(100),
            NULL::TEXT,
            NULL::BOOLEAN;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Процедура регистрации пользователя
CREATE OR REPLACE FUNCTION register_user(
    p_login VARCHAR(50),
    p_password VARCHAR(255),
    p_first_name VARCHAR(100),
    p_last_name VARCHAR(100),
    p_email VARCHAR(100)
)
RETURNS TABLE(
    success BOOLEAN,
    user_id INTEGER,
    login VARCHAR(50),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(100),
    avatar_url TEXT,
    is_admin BOOLEAN
) AS $$
DECLARE
    new_user_id INTEGER;
    encrypted_password TEXT;
    encrypted_bytea BYTEA;
BEGIN
    -- Шифруем пароль (в реальной системе используйте proper password hashing)
    -- pgp_sym_encrypt returns BYTEA, encode converts it to base64 TEXT
    encrypted_bytea := pgp_sym_encrypt(p_password, 'music_library_key');
    encrypted_password := encode(encrypted_bytea, 'base64');
    
    -- Ensure we're inserting as TEXT, not BYTEA
    INSERT INTO "user" (login, password_hash, first_name, last_name, email, is_admin)
    VALUES (p_login, encrypted_password, p_first_name, p_last_name, p_email, false)
    RETURNING "user".user_id INTO new_user_id;
    
    IF new_user_id IS NOT NULL THEN
        RETURN QUERY SELECT 
            true::BOOLEAN AS success,
            new_user_id,
            p_login,
            p_first_name,
            p_last_name,
            p_email,
            NULL::TEXT,
            false::BOOLEAN;
    ELSE
        RETURN QUERY SELECT 
            false::BOOLEAN AS success,
            NULL::INTEGER,
            NULL::VARCHAR(50),
            NULL::VARCHAR(100),
            NULL::VARCHAR(100),
            NULL::VARCHAR(100),
            NULL::TEXT,
            NULL::BOOLEAN;
    END IF;
EXCEPTION
    WHEN unique_violation THEN
        RETURN QUERY SELECT 
            false::BOOLEAN AS success,
            NULL::INTEGER,
            NULL::VARCHAR(50),
            NULL::VARCHAR(100),
            NULL::VARCHAR(100),
            NULL::VARCHAR(100),
            NULL::TEXT,
            NULL::BOOLEAN;
END;
$$ LANGUAGE plpgsql;

-- Процедура получения профиля пользователя
CREATE OR REPLACE FUNCTION get_user_profile(p_user_id INTEGER)
RETURNS TABLE(
    user_id INTEGER,
    login VARCHAR(50),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(100),
    avatar_url TEXT,
    is_admin BOOLEAN,
    created_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT u.user_id, u.login, u.first_name, u.last_name, u.email, u.avatar_url, u.is_admin, u.created_at
    FROM "user" u
    WHERE u.user_id = p_user_id AND u.is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Процедура обновления профиля пользователя
CREATE OR REPLACE FUNCTION update_user_profile(
    p_user_id INTEGER,
    p_first_name VARCHAR(100),
    p_last_name VARCHAR(100),
    p_email VARCHAR(100),
    p_avatar_url TEXT
)
RETURNS TABLE(success BOOLEAN) AS $$
BEGIN
    UPDATE "user"
    SET first_name = COALESCE(p_first_name, first_name),
        last_name = COALESCE(p_last_name, last_name),
        email = COALESCE(p_email, email),
        avatar_url = COALESCE(p_avatar_url, avatar_url),
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = p_user_id AND is_active = true;
    
    IF FOUND THEN
        RETURN QUERY SELECT true::BOOLEAN;
    ELSE
        RETURN QUERY SELECT false::BOOLEAN;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Процедура получения любимых жанров пользователя
CREATE OR REPLACE FUNCTION get_user_favorite_genres(p_user_id INTEGER)
RETURNS TABLE(genre_id INTEGER, name VARCHAR(100)) AS $$
BEGIN
    RETURN QUERY
    SELECT g.genre_id, g.name
    FROM user_favorite_genres ufg
    JOIN genres g ON ufg.genre_id = g.genre_id
    WHERE ufg.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Процедура получения любимых исполнителей пользователя
CREATE OR REPLACE FUNCTION get_user_favorite_artists(p_user_id INTEGER)
RETURNS TABLE(artist_id INTEGER, name VARCHAR(100)) AS $$
BEGIN
    RETURN QUERY
    SELECT a.artist_id, a.name
    FROM user_favorite_artists ufa
    JOIN artists a ON ufa.artist_id = a.artist_id
    WHERE ufa.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Процедура получения всех жанров
CREATE OR REPLACE FUNCTION get_all_genres()
RETURNS TABLE(genre_id INTEGER, name VARCHAR(100), created_at TIMESTAMP) AS $$
BEGIN
    RETURN QUERY
    SELECT g.genre_id, g.name, g.created_at
    FROM genres g
    ORDER BY g.name;
END;
$$ LANGUAGE plpgsql;

-- Процедура получения всех исполнителей пользователя
CREATE OR REPLACE FUNCTION get_user_artists(p_user_id INTEGER)
RETURNS TABLE(artist_id INTEGER, name VARCHAR(100), created_at TIMESTAMP) AS $$
BEGIN
    RETURN QUERY
    SELECT a.artist_id, a.name, a.created_at
    FROM artists a
    WHERE a.user_id = p_user_id
    ORDER BY a.name;
END;
$$ LANGUAGE plpgsql;

-- Процедура добавления исполнителя
CREATE OR REPLACE FUNCTION add_artist(p_user_id INTEGER, p_name VARCHAR(100))
RETURNS TABLE(artist_id INTEGER, name VARCHAR(100)) AS $$
DECLARE
    new_artist_id INTEGER;
BEGIN
    INSERT INTO artists (user_id, name)
    VALUES (p_user_id, p_name)
    RETURNING artists.artist_id INTO new_artist_id;
    
    RETURN QUERY
    SELECT new_artist_id, p_name;
EXCEPTION
    WHEN unique_violation THEN
        RETURN QUERY
        SELECT NULL::INTEGER, NULL::VARCHAR(100);
END;
$$ LANGUAGE plpgsql;

-- Процедура обновления исполнителя
CREATE OR REPLACE FUNCTION update_artist(p_artist_id INTEGER, p_user_id INTEGER, p_name VARCHAR(100))
RETURNS TABLE(success BOOLEAN) AS $$
BEGIN
    UPDATE artists
    SET name = p_name
    WHERE artists.artist_id = p_artist_id AND artists.user_id = p_user_id;
    
    IF FOUND THEN
        RETURN QUERY SELECT true::BOOLEAN;
    ELSE
        RETURN QUERY SELECT false::BOOLEAN;
    END IF;
EXCEPTION
    WHEN unique_violation THEN
        RETURN QUERY SELECT false::BOOLEAN;
END;
$$ LANGUAGE plpgsql;

-- Процедура получения количества треков исполнителя
CREATE OR REPLACE FUNCTION get_artist_tracks_count(p_artist_id INTEGER, p_user_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
    tracks_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO tracks_count
    FROM tracks
    WHERE tracks.artist_id = p_artist_id AND tracks.user_id = p_user_id;
    
    RETURN COALESCE(tracks_count, 0);
END;
$$ LANGUAGE plpgsql;

-- Процедура удаления исполнителя (с каскадным удалением треков)
CREATE OR REPLACE FUNCTION delete_artist(p_artist_id INTEGER, p_user_id INTEGER)
RETURNS TABLE(success BOOLEAN) AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Удаляем все треки этого исполнителя пользователя (каскадное удаление)
    DELETE FROM tracks
    WHERE tracks.artist_id = p_artist_id AND tracks.user_id = p_user_id;
    
    -- Удаляем самого исполнителя и сохраняем количество удаленных строк
    DELETE FROM artists
    WHERE artists.artist_id = p_artist_id AND artists.user_id = p_user_id;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    IF deleted_count > 0 THEN
        RETURN QUERY SELECT true::BOOLEAN;
    ELSE
        RETURN QUERY SELECT false::BOOLEAN;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Процедура добавления трека
CREATE OR REPLACE FUNCTION add_track(
    p_user_id INTEGER,
    p_title VARCHAR(255),
    p_artist_id INTEGER,
    p_genre_id INTEGER,
    p_bpm INTEGER,
    p_duration_sec INTEGER
)
RETURNS TABLE(track_id INTEGER, title VARCHAR(255), created_at TIMESTAMP) AS $$
DECLARE
    new_track_id INTEGER;
    artist_owner_id INTEGER;
BEGIN
    -- Проверяем, что автор принадлежит пользователю
    SELECT a.user_id INTO artist_owner_id
    FROM artists a
    WHERE a.artist_id = p_artist_id;
    
    IF artist_owner_id IS NULL OR artist_owner_id != p_user_id THEN
        -- Автор не найден или не принадлежит пользователю
        RETURN QUERY SELECT NULL::INTEGER, NULL::VARCHAR(255), NULL::TIMESTAMP;
        RETURN;
    END IF;
    
    INSERT INTO tracks (user_id, title, artist_id, genre_id, bpm, duration_sec)
    VALUES (p_user_id, p_title, p_artist_id, p_genre_id, p_bpm, p_duration_sec)
    RETURNING tracks.track_id INTO new_track_id;
    
    RETURN QUERY
    SELECT new_track_id, p_title, CURRENT_TIMESTAMP::TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Процедура обновления трека
CREATE OR REPLACE FUNCTION update_track(
    p_track_id INTEGER,
    p_user_id INTEGER,
    p_title VARCHAR(255),
    p_artist_id INTEGER,
    p_genre_id INTEGER,
    p_bpm INTEGER,
    p_duration_sec INTEGER
)
RETURNS TABLE(success BOOLEAN) AS $$
DECLARE
    artist_owner_id INTEGER;
BEGIN
    -- Проверяем, что трек принадлежит пользователю
    IF NOT EXISTS (SELECT 1 FROM tracks WHERE tracks.track_id = p_track_id AND tracks.user_id = p_user_id) THEN
        RETURN QUERY SELECT false::BOOLEAN;
        RETURN;
    END IF;
    
    -- Проверяем, что автор принадлежит пользователю
    SELECT a.user_id INTO artist_owner_id
    FROM artists a
    WHERE a.artist_id = p_artist_id;
    
    IF artist_owner_id IS NULL OR artist_owner_id != p_user_id THEN
        RETURN QUERY SELECT false::BOOLEAN;
        RETURN;
    END IF;
    
    UPDATE tracks
    SET title = p_title,
        artist_id = p_artist_id,
        genre_id = p_genre_id,
        bpm = p_bpm,
        duration_sec = p_duration_sec
    WHERE tracks.track_id = p_track_id AND tracks.user_id = p_user_id;
    
    IF FOUND THEN
        RETURN QUERY SELECT true::BOOLEAN;
    ELSE
        RETURN QUERY SELECT false::BOOLEAN;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Процедура удаления трека
CREATE OR REPLACE FUNCTION delete_track(p_track_id INTEGER)
RETURNS TABLE(success BOOLEAN) AS $$
BEGIN
    DELETE FROM tracks
    WHERE track_id = p_track_id;
    
    IF FOUND THEN
        RETURN QUERY SELECT true::BOOLEAN;
    ELSE
        RETURN QUERY SELECT false::BOOLEAN;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Процедура получения треков пользователя
CREATE OR REPLACE FUNCTION get_user_tracks(p_user_id INTEGER)
RETURNS TABLE(
    track_id INTEGER,
    title VARCHAR(255),
    artist_name VARCHAR(100),
    genre_name VARCHAR(100),
    bpm INTEGER,
    duration_sec INTEGER,
    created_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT t.track_id, t.title, a.name, g.name, t.bpm, t.duration_sec, t.created_at
    FROM tracks t
    JOIN artists a ON t.artist_id = a.artist_id
    JOIN genres g ON t.genre_id = g.genre_id
    WHERE t.user_id = p_user_id
    ORDER BY t.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Процедура получения всех треков (для администраторов)
CREATE OR REPLACE FUNCTION get_all_tracks_admin()
RETURNS TABLE(
    track_id INTEGER,
    title VARCHAR(255),
    artist_name VARCHAR(100),
    genre_name VARCHAR(100),
    bpm INTEGER,
    duration_sec INTEGER,
    created_at TIMESTAMP,
    user_login VARCHAR(50)
) AS $$
BEGIN
    RETURN QUERY
    SELECT t.track_id, t.title, a.name, g.name, t.bpm, t.duration_sec, t.created_at, u.login
    FROM tracks t
    JOIN artists a ON t.artist_id = a.artist_id
    JOIN genres g ON t.genre_id = g.genre_id
    JOIN "user" u ON t.user_id = u.user_id
    ORDER BY t.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Процедура создания коллекции
CREATE OR REPLACE FUNCTION create_collection(
    p_user_id INTEGER,
    p_name VARCHAR(255),
    p_is_favorite BOOLEAN
)
RETURNS TABLE(collection_id INTEGER, name VARCHAR(255), is_favorite BOOLEAN, created_at TIMESTAMP) AS $$
DECLARE
    new_collection_id INTEGER;
BEGIN
    -- Если создается любимая коллекция, снять флаг is_favorite со всех других коллекций пользователя
    IF p_is_favorite THEN
        UPDATE collections
        SET is_favorite = false
        WHERE collections.user_id = p_user_id AND collections.is_favorite = true;
    END IF;
    
    INSERT INTO collections (user_id, name, is_favorite)
    VALUES (p_user_id, p_name, p_is_favorite)
    RETURNING collections.collection_id INTO new_collection_id;
    
    RETURN QUERY
    SELECT new_collection_id, p_name, p_is_favorite, CURRENT_TIMESTAMP::TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Процедура обновления коллекции
CREATE OR REPLACE FUNCTION update_collection(
    p_collection_id INTEGER,
    p_name VARCHAR(255),
    p_is_favorite BOOLEAN
)
RETURNS TABLE(success BOOLEAN) AS $$
DECLARE
    v_user_id INTEGER;
BEGIN
    -- Получить user_id коллекции
    SELECT user_id INTO v_user_id
    FROM collections
    WHERE collection_id = p_collection_id;
    
    -- Если коллекция становится любимой, снять флаг is_favorite со всех других коллекций этого пользователя
    IF p_is_favorite AND v_user_id IS NOT NULL THEN
        UPDATE collections
        SET is_favorite = false
        WHERE collections.user_id = v_user_id AND collections.is_favorite = true AND collections.collection_id != p_collection_id;
    END IF;
    
    UPDATE collections
    SET name = p_name,
        is_favorite = p_is_favorite
    WHERE collections.collection_id = p_collection_id;
    
    IF FOUND THEN
        RETURN QUERY SELECT true::BOOLEAN;
    ELSE
        RETURN QUERY SELECT false::BOOLEAN;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Процедура удаления коллекции
CREATE OR REPLACE FUNCTION delete_collection(p_collection_id INTEGER)
RETURNS TABLE(success BOOLEAN) AS $$
BEGIN
    DELETE FROM collections
    WHERE collection_id = p_collection_id;
    
    IF FOUND THEN
        RETURN QUERY SELECT true::BOOLEAN;
    ELSE
        RETURN QUERY SELECT false::BOOLEAN;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Процедура получения коллекций пользователя
CREATE OR REPLACE FUNCTION get_user_collections(p_user_id INTEGER)
RETURNS TABLE(
    collection_id INTEGER,
    name VARCHAR(255),
    is_favorite BOOLEAN,
    created_at TIMESTAMP,
    tracks_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT c.collection_id, c.name, c.is_favorite, c.created_at,
           (SELECT COUNT(*)::INTEGER FROM collection_tracks ct WHERE ct.collection_id = c.collection_id) AS tracks_count
    FROM collections c
    WHERE c.user_id = p_user_id
    ORDER BY c.is_favorite DESC, c.name;
END;
$$ LANGUAGE plpgsql;

-- Процедура добавления трека в коллекцию
CREATE OR REPLACE FUNCTION add_track_to_collection(
    p_collection_id INTEGER,
    p_track_id INTEGER
)
RETURNS TABLE(success BOOLEAN) AS $$
BEGIN
    INSERT INTO collection_tracks (collection_id, track_id)
    VALUES (p_collection_id, p_track_id);
    
    IF FOUND THEN
        RETURN QUERY SELECT true::BOOLEAN;
    ELSE
        RETURN QUERY SELECT false::BOOLEAN;
    END IF;
EXCEPTION
    WHEN unique_violation THEN
        RETURN QUERY SELECT true::BOOLEAN; -- Уже добавлено
END;
$$ LANGUAGE plpgsql;

-- Процедура удаления трека из коллекции
CREATE OR REPLACE FUNCTION remove_track_from_collection(
    p_collection_id INTEGER,
    p_track_id INTEGER
)
RETURNS TABLE(success BOOLEAN) AS $$
BEGIN
    DELETE FROM collection_tracks
    WHERE collection_id = p_collection_id AND track_id = p_track_id;
    
    IF FOUND THEN
        RETURN QUERY SELECT true::BOOLEAN;
    ELSE
        RETURN QUERY SELECT false::BOOLEAN;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Процедура получения треков в коллекции
CREATE OR REPLACE FUNCTION get_collection_tracks(p_collection_id INTEGER)
RETURNS TABLE(
    track_id INTEGER,
    title VARCHAR(255),
    artist_name VARCHAR(100),
    genre_name VARCHAR(100),
    bpm INTEGER,
    duration_sec INTEGER,
    added_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT t.track_id, t.title, a.name, g.name, t.bpm, t.duration_sec, ct.added_at
    FROM collection_tracks ct
    JOIN tracks t ON ct.track_id = t.track_id
    JOIN artists a ON t.artist_id = a.artist_id
    JOIN genres g ON t.genre_id = g.genre_id
    WHERE ct.collection_id = p_collection_id
    ORDER BY ct.added_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Процедура поиска треков
CREATE OR REPLACE FUNCTION search_tracks(
    p_title VARCHAR(255),
    p_artist VARCHAR(100),
    p_genre_id INTEGER,
    p_bpm INTEGER,
    p_duration INTEGER
)
RETURNS TABLE(
    track_id INTEGER,
    title VARCHAR(255),
    artist_name VARCHAR(100),
    genre_name VARCHAR(100),
    bpm INTEGER,
    duration_sec INTEGER,
    created_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT t.track_id, t.title, a.name, g.name, t.bpm, t.duration_sec, t.created_at
    FROM tracks t
    JOIN artists a ON t.artist_id = a.artist_id
    JOIN genres g ON t.genre_id = g.genre_id
    WHERE (p_title IS NULL OR t.title ILIKE '%' || p_title || '%')
      AND (p_artist IS NULL OR a.name ILIKE '%' || p_artist || '%')
      AND (p_genre_id IS NULL OR t.genre_id = p_genre_id)
      AND (p_bpm IS NULL OR t.bpm = p_bpm)
      AND (p_duration IS NULL OR t.duration_sec = p_duration)
    ORDER BY t.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Процедура получения всех пользователей (для администраторов)
CREATE OR REPLACE FUNCTION get_all_users_admin()
RETURNS TABLE(
    user_id INTEGER,
    login VARCHAR(50),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(100),
    is_admin BOOLEAN,
    is_active BOOLEAN,
    created_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT u.user_id, u.login, u.first_name, u.last_name, u.email, u.is_admin, u.is_active, u.created_at
    FROM "user" u
    ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Процедура получения журнала аудита
CREATE OR REPLACE FUNCTION get_audit_log()
RETURNS TABLE(
    log_id INTEGER,
    user_login VARCHAR(50),
    operation_type VARCHAR(20),
    table_name VARCHAR(50),
    record_id INTEGER,
    operation_time TIMESTAMP,
    details JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT al.log_id, u.login, al.operation_type, al.table_name, al.record_id, al.operation_time, al.details
    FROM audit_log al
    LEFT JOIN "user" u ON al.user_id = u.user_id
    ORDER BY al.operation_time DESC;
END;
$$ LANGUAGE plpgsql;

-- Процедура получения информации о пользователе по ID (для валидации токена)
CREATE OR REPLACE FUNCTION get_user_by_id(p_user_id INTEGER)
RETURNS TABLE(
    user_id INTEGER,
    login VARCHAR(50),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(100),
    avatar_url TEXT,
    is_admin BOOLEAN,
    is_active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT u.user_id, u.login, u.first_name, u.last_name, u.email, u.avatar_url, u.is_admin, u.is_active
    FROM "user" u
    WHERE u.user_id = p_user_id AND u.is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Процедура проверки прав администратора
CREATE OR REPLACE FUNCTION check_user_is_admin(p_user_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    admin_status BOOLEAN;
BEGIN
    SELECT u.is_admin INTO admin_status
    FROM "user" u
    WHERE u.user_id = p_user_id AND u.is_active = true;
    
    RETURN COALESCE(admin_status, false);
END;
$$ LANGUAGE plpgsql;

-- Процедура получения владельца трека
CREATE OR REPLACE FUNCTION get_track_owner(p_track_id INTEGER)
RETURNS TABLE(user_id INTEGER) AS $$
BEGIN
    RETURN QUERY
    SELECT t.user_id
    FROM tracks t
    WHERE t.track_id = p_track_id;
END;
$$ LANGUAGE plpgsql;

-- Процедура получения владельца коллекции
CREATE OR REPLACE FUNCTION get_collection_owner(p_collection_id INTEGER)
RETURNS TABLE(user_id INTEGER) AS $$
BEGIN
    RETURN QUERY
    SELECT c.user_id
    FROM collections c
    WHERE c.collection_id = p_collection_id;
END;
$$ LANGUAGE plpgsql;

-- Вставка начальных данных
INSERT INTO genres (name) VALUES 
    ('Рок'), 
    ('Поп'), 
    ('Джаз'), 
    ('Хип-хоп'), 
    ('Электроника'), 
    ('Классика')
ON CONFLICT (name) DO NOTHING;

-- Начальные исполнители для администратора (user_id = 1)
INSERT INTO artists (user_id, name) 
SELECT 1, name FROM (VALUES 
    ('The Beatles'), 
    ('Michael Jackson'), 
    ('Eminem'), 
    ('Queen'), 
    ('Miles Davis')
) AS v(name)
WHERE NOT EXISTS (
    SELECT 1 FROM artists WHERE artists.user_id = 1 AND artists.name = v.name
);

-- Создание администратора по умолчанию
INSERT INTO "user" (login, password_hash, first_name, last_name, email, is_admin, is_active)
VALUES (
    'admin',
    encode(pgp_sym_encrypt('admin', 'music_library_key'), 'base64')::TEXT,
    'System',
    'Administrator',
    'admin@example.com',
    true,
    true
)
ON CONFLICT (login) DO NOTHING;

INSERT INTO "user" (login, password_hash, first_name, last_name, email, is_admin, is_active)
VALUES (
    'user',
    encode(pgp_sym_encrypt('user', 'music_library_key'), 'base64')::TEXT,
    'Regular',
    'User',
    'user@example.com',
    false,
    true
)
ON CONFLICT (login) DO NOTHING;