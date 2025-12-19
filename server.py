from flask import Flask, request, jsonify, session
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from datetime import datetime, timedelta
import jwt
from functools import wraps
from flask_cors import CORS
import re

app = Flask(__name__)
CORS(app)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key-here')

# Database connection configuration
DB_CONFIG = {
    'host': 'localhost',
    'database': 'music_library',
    'user': 'postgres',
    'password': 'NIf9J_HT8B'
}

def get_db_connection():
    """Create a database connection"""
    conn = psycopg2.connect(**DB_CONFIG)
    return conn

def token_required(f):
    """Decorator to protect routes that require authentication"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]  # Bearer token
            except IndexError:
                return jsonify({'message': 'Неверный формат токена'}), 401
        
        if not token:
            return jsonify({'message': 'Токен отсутствует'}), 401
        
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            current_user_id = data['user_id']
            
            # Check if user still exists in database using stored procedure
            conn = get_db_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.callproc('get_user_by_id', (current_user_id,))
            current_user = cursor.fetchone()
            cursor.close()
            conn.close()
            
            if not current_user:
                return jsonify({'message': 'Пользователь больше не существует'}), 401
                
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Токен истек'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Неверный токен'}), 401
        
        return f(current_user, *args, **kwargs)
    
    return decorated

def admin_required(f):
    """Decorator to ensure only admin users can access certain routes"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]  # Bearer token
            except IndexError:
                return jsonify({'message': 'Неверный формат токена'}), 401
        
        if not token:
            return jsonify({'message': 'Токен отсутствует'}), 401
        
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            current_user_id = data['user_id']
            
            # Check if user is admin using stored procedure
            conn = get_db_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.callproc('check_user_is_admin', (current_user_id,))
            result = cursor.fetchone()
            cursor.close()
            conn.close()
            
            if not result or not result['check_user_is_admin']:
                return jsonify({'message': 'Требуется доступ администратора'}), 403
                
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Токен истек'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Неверный токен'}), 401
        
        return f(*args, **kwargs)
    
    return decorated

# Authentication routes
@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    login = data.get('login')
    password = data.get('password')

    # Validation
    if not login:
        return jsonify({'message': 'Логин обязателен для заполнения'}), 400
    
    if not password:
        return jsonify({'message': 'Пароль обязателен для заполнения'}), 400
    
    login = login.strip()
    password = password.strip()
    
    if len(login) < 3 or len(login) > 50:
        return jsonify({'message': 'Логин должен содержать от 3 до 50 символов'}), 400
    
    if not re.match(r'^[a-zA-Z0-9_]+$', login):
        return jsonify({'message': 'Логин может содержать только буквы, цифры и подчеркивание'}), 400
    
    if len(password) < 6 or len(password) > 255:
        return jsonify({'message': 'Пароль должен содержать от 6 до 255 символов'}), 400
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Call stored procedure to authenticate user
        cursor.callproc('authenticate_user', (login, password))
        result = cursor.fetchone()
        
        if result and result['success']:
            user_data = result
            
            # Generate JWT token
            token = jwt.encode({
                'user_id': user_data['user_id'],
                'exp': datetime.utcnow() + timedelta(hours=24)
            }, app.config['SECRET_KEY'], algorithm='HS256')
            
            return jsonify({
                'token': token,
                'user': {
                    'user_id': user_data['user_id'],
                    'login': user_data['login'],
                    'first_name': user_data['first_name'],
                    'last_name': user_data['last_name'],
                    'email': user_data['email'],
                    'avatar_url': user_data['avatar_url'],
                    'is_admin': user_data['is_admin']
                }
            }), 200
        else:
            return jsonify({'message': 'Неверный логин или пароль'}), 401
            
    except Exception as e:
        print(f"Login error: {str(e)}")
        return jsonify({'message': 'Ошибка аутентификации. Попробуйте позже.'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json()
    login = data.get('login')
    password = data.get('password')
    first_name = data.get('first_name')
    last_name = data.get('last_name')
    email = data.get('email')
    
    # Validation
    if not login:
        return jsonify({'message': 'Логин обязателен для заполнения'}), 400
    
    if not password:
        return jsonify({'message': 'Пароль обязателен для заполнения'}), 400
    
    if not first_name:
        return jsonify({'message': 'Имя обязательно для заполнения'}), 400
    
    if not last_name:
        return jsonify({'message': 'Фамилия обязательна для заполнения'}), 400
    
    if not email:
        return jsonify({'message': 'Email обязателен для заполнения'}), 400
    
    # Trim and validate lengths
    login = login.strip()
    password = password.strip()
    first_name = first_name.strip()
    last_name = last_name.strip()
    email = email.strip()
    
    if len(login) < 3 or len(login) > 50:
        return jsonify({'message': 'Логин должен содержать от 3 до 50 символов'}), 400
    
    if not re.match(r'^[a-zA-Z0-9_]+$', login):
        return jsonify({'message': 'Логин может содержать только буквы, цифры и подчеркивание'}), 400
    
    if len(password) < 6 or len(password) > 255:
        return jsonify({'message': 'Пароль должен содержать от 6 до 255 символов'}), 400
    
    if len(first_name) > 100:
        return jsonify({'message': 'Имя не должно превышать 100 символов'}), 400
    
    if len(last_name) > 100:
        return jsonify({'message': 'Фамилия не должна превышать 100 символов'}), 400
    
    if len(email) > 100:
        return jsonify({'message': 'Email не должен превышать 100 символов'}), 400
    
    # Validate email format
    email_regex = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
    if not re.match(email_regex, email):
        return jsonify({'message': 'Введите корректный email адрес'}), 400
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Call stored procedure to register user
        cursor.callproc('register_user', (login, password, first_name, last_name, email))
        result = cursor.fetchone()
        
        # Commit the transaction
        conn.commit()
        
        if result and result['success']:
            user_data = result
            
            # Generate JWT token
            token = jwt.encode({
                'user_id': user_data['user_id'],
                'exp': datetime.utcnow() + timedelta(hours=24)
            }, app.config['SECRET_KEY'], algorithm='HS256')
            
            return jsonify({
                'token': token,
                'user': {
                    'user_id': user_data['user_id'],
                    'login': user_data['login'],
                    'first_name': user_data['first_name'],
                    'last_name': user_data['last_name'],
                    'email': user_data['email'],
                    'avatar_url': user_data['avatar_url'],
                    'is_admin': user_data['is_admin']
                }
            }), 201
        else:
            return jsonify({'message': 'Регистрация не удалась. Возможно, пользователь с таким логином уже существует.'}), 400
            
    except Exception as e:
        print(f"Registration error: {str(e)}")
        if 'conn' in locals():
            conn.rollback()
        
        error_msg = str(e).lower()
        if 'unique' in error_msg or 'duplicate' in error_msg:
            if 'login' in error_msg:
                return jsonify({'message': 'Пользователь с таким логином уже существует'}), 400
            elif 'email' in error_msg:
                return jsonify({'message': 'Пользователь с таким email уже существует'}), 400
            else:
                return jsonify({'message': 'Пользователь с такими данными уже существует'}), 400
        
        return jsonify({'message': 'Ошибка регистрации. Попробуйте позже.'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

# User profile routes
@app.route('/api/profile', methods=['GET'])
@token_required
def get_profile(current_user):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get user profile with favorite genres and artists
        cursor.callproc('get_user_profile', (current_user['user_id'],))
        profile = cursor.fetchone()
        
        if profile:
            # Get favorite genres
            cursor.callproc('get_user_favorite_genres', (current_user['user_id'],))
            favorite_genres = cursor.fetchall()
            
            # Get favorite artists
            cursor.callproc('get_user_favorite_artists', (current_user['user_id'],))
            favorite_artists = cursor.fetchall()
            
            profile_result = dict(profile)
            profile_result['favorite_genres'] = favorite_genres
            profile_result['favorite_artists'] = favorite_artists
            
            return jsonify(profile_result), 200
        else:
            return jsonify({'message': 'Пользователь не найден'}), 404
            
    except Exception as e:
        print(f"Get profile error: {str(e)}")
        return jsonify({'message': 'Не удалось получить профиль'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

@app.route('/api/profile', methods=['PUT'])
@token_required
def update_profile(current_user):
    data = request.get_json()
    
    first_name = data.get('first_name')
    last_name = data.get('last_name')
    email = data.get('email')
    avatar_url = data.get('avatar_url')
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Call stored procedure to update profile
        cursor.callproc('update_user_profile', (
            current_user['user_id'], first_name, last_name, email, avatar_url
        ))
        result = cursor.fetchone()
        
        # Commit the transaction
        conn.commit()
        
        if result and result['success']:
            return jsonify({'message': 'Профиль успешно обновлен'}), 200
        else:
            return jsonify({'message': 'Не удалось обновить профиль'}), 400
            
    except Exception as e:
        print(f"Update profile error: {str(e)}")
        if 'conn' in locals():
            conn.rollback()
        return jsonify({'message': 'Ошибка при обновлении профиля'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

# Genre routes
@app.route('/api/genres', methods=['GET'])
@token_required
def get_genres(current_user):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.callproc('get_all_genres')
        genres = cursor.fetchall()
        
        return jsonify(genres), 200
        
    except Exception as e:
        print(f"Get genres error: {str(e)}")
        return jsonify({'message': 'Не удалось получить жанры'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

# Artist routes
@app.route('/api/artists', methods=['GET'])
@token_required
def get_artists(current_user):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get user's artists
        cursor.callproc('get_user_artists', (current_user['user_id'],))
        artists = cursor.fetchall()
        
        return jsonify(artists), 200
        
    except Exception as e:
        print(f"Get artists error: {str(e)}")
        return jsonify({'message': 'Не удалось получить исполнителей'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

@app.route('/api/artists', methods=['POST'])
@token_required
def add_artist(current_user):
    data = request.get_json()
    name = data.get('name')
    
    if not name:
        return jsonify({'message': 'Имя исполнителя обязательно'}), 400
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.callproc('add_artist', (current_user['user_id'], name))
        result = cursor.fetchone()
        
        # Commit the transaction
        conn.commit()
        
        if result and result['artist_id']:
            return jsonify(result), 201
        else:
            return jsonify({'message': 'Не удалось добавить исполнителя. Возможно, исполнитель с таким именем уже существует.'}), 400
            
    except Exception as e:
        print(f"Add artist error: {str(e)}")
        if 'conn' in locals():
            conn.rollback()
        return jsonify({'message': 'Ошибка при добавлении исполнителя'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

@app.route('/api/artists/<int:artist_id>', methods=['PUT'])
@token_required
def update_artist(current_user, artist_id):
    data = request.get_json()
    name = data.get('name')
    
    if not name:
        return jsonify({'message': 'Имя исполнителя обязательно'}), 400
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check if artist belongs to user using stored procedure
        cursor.callproc('get_user_artists', (current_user['user_id'],))
        user_artists = cursor.fetchall()
        artist_exists = any(a['artist_id'] == artist_id for a in user_artists)
        
        if not artist_exists:
            return jsonify({'message': 'Нет прав для изменения этого исполнителя'}), 403
        
        cursor.callproc('update_artist', (artist_id, current_user['user_id'], name))
        result = cursor.fetchone()
        
        # Commit the transaction
        conn.commit()
        
        if result and result['success']:
            return jsonify({'message': 'Исполнитель успешно обновлен'}), 200
        else:
            return jsonify({'message': 'Не удалось обновить исполнителя. Возможно, исполнитель с таким именем уже существует.'}), 400
            
    except Exception as e:
        print(f"Update artist error: {str(e)}")
        if 'conn' in locals():
            conn.rollback()
        return jsonify({'message': 'Ошибка при обновлении исполнителя'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

@app.route('/api/artists/<int:artist_id>/tracks-count', methods=['GET'])
@token_required
def get_artist_tracks_count(current_user, artist_id):
    """Получить количество треков исполнителя"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check if artist belongs to user using stored procedure
        cursor.callproc('get_user_artists', (current_user['user_id'],))
        user_artists = cursor.fetchall()
        artist_exists = any(a['artist_id'] == artist_id for a in user_artists)
        
        if not artist_exists:
            return jsonify({'message': 'Нет прав для просмотра этого исполнителя'}), 403
        
        cursor.execute('SELECT get_artist_tracks_count(%s, %s) AS tracks_count', (artist_id, current_user['user_id']))
        result = cursor.fetchone()
        
        tracks_count = result['tracks_count'] if result else 0
        
        return jsonify({'tracks_count': tracks_count}), 200
        
    except Exception as e:
        print(f"Get artist tracks count error: {str(e)}")
        return jsonify({'message': 'Ошибка при получении количества треков'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

@app.route('/api/artists/<int:artist_id>', methods=['DELETE'])
@token_required
def delete_artist(current_user, artist_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check if artist belongs to user using stored procedure
        cursor.callproc('get_user_artists', (current_user['user_id'],))
        user_artists = cursor.fetchall()
        artist_exists = any(a['artist_id'] == artist_id for a in user_artists)
        
        if not artist_exists:
            return jsonify({'message': 'Нет прав для удаления этого исполнителя'}), 403
        
        cursor.callproc('delete_artist', (artist_id, current_user['user_id']))
        result = cursor.fetchone()
        
        # Commit the transaction
        conn.commit()
        
        if result and result['success']:
            return jsonify({'message': 'Исполнитель и все связанные треки успешно удалены'}), 200
        else:
            return jsonify({'message': 'Не удалось удалить исполнителя'}), 400
            
    except Exception as e:
        print(f"Delete artist error: {str(e)}")
        if 'conn' in locals():
            conn.rollback()
        return jsonify({'message': 'Ошибка при удалении исполнителя'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

# Track routes
@app.route('/api/tracks', methods=['GET'])
@token_required
def get_tracks(current_user):
    # Check if user is admin to determine if they can see all tracks
    is_admin = current_user.get('is_admin', False)
    user_id = current_user['user_id'] if not is_admin else None
    
    # Get filters from query parameters
    title_filter = request.args.get('title')
    artist_filter = request.args.get('artist')
    genre_filter = request.args.get('genre_id')
    bpm_filter = request.args.get('bpm')
    duration_filter = request.args.get('duration')
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Call appropriate stored procedure based on admin status
        if is_admin:
            cursor.callproc('get_all_tracks_admin')
        else:
            cursor.callproc('get_user_tracks', (user_id,))
        
        tracks = cursor.fetchall()
        
        return jsonify(tracks), 200
        
    except Exception as e:
        print(f"Get tracks error: {str(e)}")
        return jsonify({'message': 'Не удалось получить треки'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

@app.route('/api/tracks', methods=['POST'])
@token_required
def add_track(current_user):
    data = request.get_json()
    
    title = data.get('title')
    artist_id = data.get('artist_id')
    genre_id = data.get('genre_id')
    bpm = data.get('bpm')
    duration_sec = data.get('duration_sec')
    
    if not title or not artist_id or not genre_id:
        return jsonify({'message': 'Название, исполнитель и жанр обязательны'}), 400
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.callproc('add_track', (
            current_user['user_id'], title, artist_id, genre_id, bpm, duration_sec
        ))
        result = cursor.fetchone()
        
        # Commit the transaction
        conn.commit()
        
        if result and result['track_id']:
            return jsonify(result), 201
        else:
            return jsonify({'message': 'Не удалось добавить трек. Убедитесь, что выбранный исполнитель принадлежит вам.'}), 400
            
    except Exception as e:
        print(f"Add track error: {str(e)}")
        if 'conn' in locals():
            conn.rollback()
        return jsonify({'message': 'Ошибка при добавлении трека'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

@app.route('/api/tracks/<int:track_id>', methods=['PUT'])
@token_required
def update_track(current_user, track_id):
    data = request.get_json()
    
    title = data.get('title')
    artist_id = data.get('artist_id')
    genre_id = data.get('genre_id')
    bpm = data.get('bpm')
    duration_sec = data.get('duration_sec')
    
    if not title or not artist_id or not genre_id:
        return jsonify({'message': 'Название, исполнитель и жанр обязательны'}), 400
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # First, check if the track belongs to the current user (unless admin) using stored procedure
        if not current_user.get('is_admin'):
            cursor.callproc('get_track_owner', (track_id,))
            track_owner = cursor.fetchone()
            if not track_owner or track_owner['user_id'] != current_user['user_id']:
                return jsonify({'message': 'Нет прав для изменения этого трека'}), 403
        
        cursor.callproc('update_track', (
            track_id, current_user['user_id'], title, artist_id, genre_id, bpm, duration_sec
        ))
        result = cursor.fetchone()
        
        # Commit the transaction
        conn.commit()
        
        if result and result['success']:
            return jsonify({'message': 'Трек успешно обновлен'}), 200
        else:
            return jsonify({'message': 'Не удалось обновить трек'}), 400
            
    except Exception as e:
        print(f"Update track error: {str(e)}")
        if 'conn' in locals():
            conn.rollback()
        return jsonify({'message': 'Ошибка при обновлении трека'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

@app.route('/api/tracks/<int:track_id>', methods=['DELETE'])
@token_required
def delete_track(current_user, track_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # First, check if the track belongs to the current user (unless admin) using stored procedure
        if not current_user.get('is_admin'):
            cursor.callproc('get_track_owner', (track_id,))
            track_owner = cursor.fetchone()
            if not track_owner or track_owner['user_id'] != current_user['user_id']:
                return jsonify({'message': 'Нет прав для удаления этого трека'}), 403
        
        cursor.callproc('delete_track', (track_id,))
        result = cursor.fetchone()
        
        # Commit the transaction
        conn.commit()
        
        if result and result['success']:
            return jsonify({'message': 'Трек успешно удален'}), 200
        else:
            return jsonify({'message': 'Не удалось удалить трек'}), 400
            
    except Exception as e:
        print(f"Delete track error: {str(e)}")
        if 'conn' in locals():
            conn.rollback()
        return jsonify({'message': 'Ошибка при удалении трека'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

# Collection routes
@app.route('/api/collections', methods=['GET'])
@token_required
def get_collections(current_user):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.callproc('get_user_collections', (current_user['user_id'],))
        collections = cursor.fetchall()
        
        return jsonify(collections), 200
        
    except Exception as e:
        print(f"Get collections error: {str(e)}")
        return jsonify({'message': 'Не удалось получить коллекции'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

@app.route('/api/collections', methods=['POST'])
@token_required
def add_collection(current_user):
    data = request.get_json()
    
    name = data.get('name')
    is_favorite = data.get('is_favorite', False)
    
    if not name:
        return jsonify({'message': 'Название коллекции обязательно'}), 400
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.callproc('create_collection', (current_user['user_id'], name, is_favorite))
        result = cursor.fetchone()
        
        # Commit the transaction
        conn.commit()
        
        if result and result['collection_id']:
            return jsonify(result), 201
        else:
            return jsonify({'message': 'Не удалось создать коллекцию'}), 400
            
    except Exception as e:
        print(f"Add collection error: {str(e)}")
        if 'conn' in locals():
            conn.rollback()
        return jsonify({'message': 'Ошибка при создании коллекции'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

@app.route('/api/collections/<int:collection_id>', methods=['PUT'])
@token_required
def update_collection(current_user, collection_id):
    data = request.get_json()
    
    name = data.get('name')
    is_favorite = data.get('is_favorite')
    
    if not name:
        return jsonify({'message': 'Название коллекции обязательно'}), 400
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # First, check if the collection belongs to the current user using stored procedure
        cursor.callproc('get_collection_owner', (collection_id,))
        collection_owner = cursor.fetchone()
        if not collection_owner or collection_owner['user_id'] != current_user['user_id']:
            return jsonify({'message': 'Нет прав для изменения этой коллекции'}), 403
        
        cursor.callproc('update_collection', (collection_id, name, is_favorite))
        result = cursor.fetchone()
        
        # Commit the transaction
        conn.commit()
        
        if result and result['success']:
            return jsonify({'message': 'Коллекция успешно обновлена'}), 200
        else:
            return jsonify({'message': 'Не удалось обновить коллекцию'}), 400
            
    except Exception as e:
        print(f"Update collection error: {str(e)}")
        if 'conn' in locals():
            conn.rollback()
        return jsonify({'message': 'Ошибка при обновлении коллекции'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

@app.route('/api/collections/<int:collection_id>', methods=['DELETE'])
@token_required
def delete_collection(current_user, collection_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # First, check if the collection belongs to the current user using stored procedure
        cursor.callproc('get_collection_owner', (collection_id,))
        collection_owner = cursor.fetchone()
        if not collection_owner or collection_owner['user_id'] != current_user['user_id']:
            return jsonify({'message': 'Нет прав для удаления этой коллекции'}), 403
        
        cursor.callproc('delete_collection', (collection_id,))
        result = cursor.fetchone()
        
        # Commit the transaction
        conn.commit()
        
        if result and result['success']:
            return jsonify({'message': 'Коллекция успешно удалена'}), 200
        else:
            return jsonify({'message': 'Не удалось удалить коллекцию'}), 400
            
    except Exception as e:
        print(f"Delete collection error: {str(e)}")
        if 'conn' in locals():
            conn.rollback()
        return jsonify({'message': 'Ошибка при удалении коллекции'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

# Add track to collection
@app.route('/api/collections/<int:collection_id>/tracks', methods=['POST'])
@token_required
def add_track_to_collection(current_user, collection_id):
    data = request.get_json()
    track_id = data.get('track_id')
    
    if not track_id:
        return jsonify({'message': 'ID трека обязателен'}), 400
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check if collection belongs to user using stored procedure
        cursor.callproc('get_collection_owner', (collection_id,))
        collection_owner = cursor.fetchone()
        if not collection_owner or collection_owner['user_id'] != current_user['user_id']:
            return jsonify({'message': 'Нет прав для изменения этой коллекции'}), 403
        
        # Check if track belongs to user (or if admin) using stored procedure
        if not current_user.get('is_admin'):
            cursor.callproc('get_track_owner', (track_id,))
            track_owner = cursor.fetchone()
            if not track_owner or track_owner['user_id'] != current_user['user_id']:
                return jsonify({'message': 'Нет прав для добавления этого трека в коллекцию'}), 403
        
        cursor.callproc('add_track_to_collection', (collection_id, track_id))
        result = cursor.fetchone()
        
        # Commit the transaction
        conn.commit()
        
        if result and result['success']:
            return jsonify({'message': 'Трек успешно добавлен в коллекцию'}), 200
        else:
            return jsonify({'message': 'Не удалось добавить трек в коллекцию'}), 400
            
    except Exception as e:
        print(f"Add track to collection error: {str(e)}")
        if 'conn' in locals():
            conn.rollback()
        return jsonify({'message': 'Ошибка при добавлении трека в коллекцию'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

# Remove track from collection
@app.route('/api/collections/<int:collection_id>/tracks/<int:track_id>', methods=['DELETE'])
@token_required
def remove_track_from_collection(current_user, collection_id, track_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check if collection belongs to user using stored procedure
        cursor.callproc('get_collection_owner', (collection_id,))
        collection_owner = cursor.fetchone()
        if not collection_owner or collection_owner['user_id'] != current_user['user_id']:
            return jsonify({'message': 'Нет прав для изменения этой коллекции'}), 403
        
        cursor.callproc('remove_track_from_collection', (collection_id, track_id))
        result = cursor.fetchone()
        
        # Commit the transaction
        conn.commit()
        
        if result and result['success']:
            return jsonify({'message': 'Трек успешно удален из коллекции'}), 200
        else:
            return jsonify({'message': 'Не удалось удалить трек из коллекции'}), 400
            
    except Exception as e:
        print(f"Remove track from collection error: {str(e)}")
        if 'conn' in locals():
            conn.rollback()
        return jsonify({'message': 'Ошибка при удалении трека из коллекции'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

@app.route('/api/collections/<int:collection_id>/tracks', methods=['GET'])
@token_required
def get_collection_tracks(current_user, collection_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check if collection belongs to user using stored procedure
        cursor.callproc('get_collection_owner', (collection_id,))
        collection_owner = cursor.fetchone()
        if not collection_owner or collection_owner['user_id'] != current_user['user_id']:
            return jsonify({'message': 'Нет прав для просмотра этой коллекции'}), 403
        
        # Get tracks in collection using stored procedure
        cursor.callproc('get_collection_tracks', (collection_id,))
        tracks = cursor.fetchall()
        
        return jsonify(tracks), 200
        
    except Exception as e:
        print(f"Get collection tracks error: {str(e)}")
        return jsonify({'message': 'Не удалось получить треки коллекции'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

# Search routes
@app.route('/api/search/tracks', methods=['GET'])
@token_required
def search_tracks(current_user):
    title = request.args.get('title')
    artist = request.args.get('artist')
    genre_id = request.args.get('genre_id')
    bpm = request.args.get('bpm')
    duration = request.args.get('duration')
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Call search procedure
        cursor.callproc('search_tracks', (title, artist, genre_id, bpm, duration))
        results = cursor.fetchall()
        
        return jsonify(results), 200
        
    except Exception as e:
        print(f"Search tracks error: {str(e)}")
        return jsonify({'message': 'Ошибка при поиске'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

# Admin routes
@app.route('/api/admin/users', methods=['GET'])
@admin_required
def get_all_users():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.callproc('get_all_users_admin')
        users = cursor.fetchall()
        
        return jsonify(users), 200
        
    except Exception as e:
        print(f"Get all users error: {str(e)}")
        return jsonify({'message': 'Не удалось получить список пользователей'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

@app.route('/api/admin/tracks', methods=['GET'])
@admin_required
def get_all_tracks_admin():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.callproc('get_all_tracks_admin')
        tracks = cursor.fetchall()
        
        return jsonify(tracks), 200
        
    except Exception as e:
        print(f"Get all tracks admin error: {str(e)}")
        return jsonify({'message': 'Не удалось получить треки'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

@app.route('/api/admin/audit', methods=['GET'])
@admin_required
def get_audit_log():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.callproc('get_audit_log')
        audit_entries = cursor.fetchall()
        
        return jsonify(audit_entries), 200
        
    except Exception as e:
        print(f"Get audit log error: {str(e)}")
        return jsonify({'message': 'Не удалось получить журнал операций'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

# Health check endpoint
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'timestamp': datetime.utcnow()}), 200

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)