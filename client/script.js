// API Configuration
const API_BASE_URL = 'http://localhost:5000/api';

// Глобальные переменные
let currentUser = null;
let isAdmin = false;
let allGenres = [];
let allArtists = [];

// API Helper Functions
async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers
        });
        
        if (response.status === 401) {
            // Token expired or invalid
            localStorage.clear();
            window.location.href = 'login.html';
            return null;
        }
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Request failed');
        }
        
        return data;
    } catch (error) {
        console.error('API request error:', error);
        alert(`Ошибка: ${error.message}`);
        return null;
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// Инициализация приложения
async function initializeApp() {
    // Проверка сессии пользователя
    await checkUserSession();
    
    // Настройка обработчиков событий
    setupEventListeners();
    
    // Загрузка начальных данных
    await loadInitialData();
}

// Проверка сессии пользователя
async function checkUserSession() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }
    
    try {
        const profile = await apiRequest('/profile');
        if (profile) {
    currentUser = {
                user_id: profile.user_id,
                login: profile.login,
                first_name: profile.first_name,
                last_name: profile.last_name,
                email: profile.email,
                avatar_url: profile.avatar_url,
                is_admin: profile.is_admin
    };
    
            isAdmin = profile.is_admin || false;
    
    updateUserInfo();
    toggleAdminPanel();
            
            // Load favorite genres and artists
            if (profile.favorite_genres) {
                // Display favorite genres if needed
            }
            if (profile.favorite_artists) {
                // Display favorite artists if needed
            }
        } else {
            window.location.href = 'login.html';
        }
    } catch (error) {
        console.error('Session check error:', error);
        window.location.href = 'login.html';
    }
}

// Обновление информации о пользователе в интерфейсе
function updateUserInfo() {
    if (currentUser) {
        const fullName = `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() || currentUser.login;
        document.getElementById('username').textContent = fullName;
        document.getElementById('avatar-img').src = currentUser.avatar_url || 'https://via.placeholder.com/150';
        document.getElementById('first-name').value = currentUser.first_name || '';
        document.getElementById('last-name').value = currentUser.last_name || '';
        document.getElementById('email').value = currentUser.email || '';
        document.getElementById('avatar-url').value = currentUser.avatar_url || '';
    }
}

// Переключение видимости админ-панели
function toggleAdminPanel() {
    const adminBtn = document.getElementById('admin-btn');
    if (isAdmin) {
        adminBtn.style.display = 'block';
    } else {
        adminBtn.style.display = 'none';
        document.getElementById('admin-section').classList.remove('active');
    }
}

// Показать модальное окно добавления автора
function showAddArtistModal() {
    const modalBody = document.getElementById('modal-body');
    modalBody.innerHTML = `
        <form id="artist-form">
            <div class="form-group">
                <label for="artist-name">Имя исполнителя:</label>
                <input type="text" id="artist-name" required>
            </div>
            <div class="form-group">
                <button type="submit" class="btn btn-primary">Сохранить</button>
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Отмена</button>
            </div>
        </form>
    `;
    document.getElementById('modal-title').textContent = 'Добавить автора';
    document.getElementById('artist-form').addEventListener('submit', saveArtist);
    showModal();
}

// Показать модальное окно редактирования автора
function showEditArtistModal(artistId) {
    const artist = allArtists.find(a => a.artist_id === artistId);
    if (!artist) return;

    const modalBody = document.getElementById('modal-body');
    modalBody.innerHTML = `
        <form id="artist-form">
            <input type="hidden" id="artist-id" value="${artist.artist_id}">
            <div class="form-group">
                <label for="artist-name">Имя исполнителя:</label>
                <input type="text" id="artist-name" value="${artist.name}" required>
            </div>
            <div class="form-group">
                <button type="submit" class="btn btn-primary">Сохранить</button>
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Отмена</button>
            </div>
        </form>
    `;
    document.getElementById('modal-title').textContent = 'Редактировать автора';
    document.getElementById('artist-form').addEventListener('submit', saveArtist);
    showModal();
}

// Сохранение автора
async function saveArtist(e) {
    e.preventDefault();
    const name = document.getElementById('artist-name').value.trim();
    if (!name) return;

    const artistId = document.getElementById('artist-id')?.value;

    try {
    if (artistId) {
        // Редактирование
            const result = await apiRequest(`/artists/${artistId}`, {
                method: 'PUT',
                body: JSON.stringify({ name })
            });
            
            if (result) {
                alert('Исполнитель успешно обновлен!');
                await loadUserArtists();
                closeModal();
        }
    } else {
        // Добавление
            const result = await apiRequest('/artists', {
                method: 'POST',
                body: JSON.stringify({ name })
            });
            
            if (result && result.artist_id) {
                alert('Исполнитель успешно добавлен!');
                await loadUserArtists();
                closeModal();
            } else {
                const errorMsg = result?.message || 'Не удалось добавить исполнителя. Возможно, исполнитель с таким именем уже существует.';
                alert(`Ошибка: ${errorMsg}`);
            }
        }
    } catch (error) {
        console.error('Save artist error:', error);
        const errorMessage = error.message || 'Ошибка при сохранении исполнителя';
        alert(`Ошибка: ${errorMessage}`);
    }
}

// Удаление автора
async function deleteArtist(artistId) {
    try {
        // Сначала получаем количество треков у автора
        const tracksCountData = await apiRequest(`/artists/${artistId}/tracks-count`);
        const tracksCount = tracksCountData?.tracks_count || 0;
        
        let confirmMessage;
        if (tracksCount > 0) {
            confirmMessage = `У этого исполнителя ${tracksCount} ${tracksCount === 1 ? 'трек' : tracksCount < 5 ? 'трека' : 'треков'}. Удалить исполнителя и все его треки?`;
        } else {
            confirmMessage = 'Удалить этого исполнителя?';
        }
        
        if (!confirm(confirmMessage)) return;

        const result = await apiRequest(`/artists/${artistId}`, {
            method: 'DELETE'
        });
        
        if (result) {
            alert('Исполнитель успешно удален!');
            await loadUserArtists();
            // Если были удалены треки, обновить список треков
            if (tracksCount > 0) {
                await loadUserTracks();
            }
        }
    } catch (error) {
        console.error('Delete artist error:', error);
        const errorMsg = error.message || 'Не удалось удалить исполнителя';
        alert(`Ошибка: ${errorMsg}`);
    }
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Навигация
    document.getElementById('profile-btn').addEventListener('click', async () => await showSection('profile-section'));
    document.getElementById('tracks-btn').addEventListener('click', async () => await showSection('tracks-section'));
    document.getElementById('collections-btn').addEventListener('click', async () => await showSection('collections-section'));
    document.getElementById('search-btn').addEventListener('click', async () => await showSection('search-section'));
    document.getElementById('admin-btn').addEventListener('click', async () => await showSection('admin-section'));
    document.getElementById('artists-btn').addEventListener('click', async () => await showSection('artists-section'));

    // Выход
    document.getElementById('logout-btn').addEventListener('click', logout);
    
    // Профиль
    document.getElementById('profile-form').addEventListener('submit', saveProfile);
    document.getElementById('change-avatar-btn').addEventListener('click', changeAvatar);
    
    // Треки
    document.getElementById('add-track-btn').addEventListener('click', showAddTrackModal);
    
    // Авторы
    document.getElementById('add-artist-btn').addEventListener('click', showAddArtistModal);

    // Коллекции
    document.getElementById('add-collection-btn').addEventListener('click', showAddCollectionModal);
    
    // Поиск
    document.getElementById('search-submit-btn').addEventListener('click', performSearch);
    document.getElementById('search-reset-btn').addEventListener('click', resetSearch);
    
    // Админ-панель
    document.getElementById('admin-users-tab').addEventListener('click', () => switchAdminTab('users'));
    document.getElementById('admin-tracks-tab').addEventListener('click', () => switchAdminTab('tracks'));
    document.getElementById('admin-audit-tab').addEventListener('click', () => switchAdminTab('audit'));
    
    // Модальные окна
    document.getElementById('close-modal-btn').addEventListener('click', closeModal);
    document.getElementById('modal-overlay').addEventListener('click', function(e) {
        if (e.target === this) {
            closeModal();
        }
    });
}

// Загрузка профиля пользователя
async function loadUserProfile() {
    try {
        const profile = await apiRequest('/profile');
        if (profile) {
            currentUser = {
                user_id: profile.user_id,
                login: profile.login,
                first_name: profile.first_name,
                last_name: profile.last_name,
                email: profile.email,
                avatar_url: profile.avatar_url,
                is_admin: profile.is_admin
            };
            updateUserInfo();
        }
    } catch (error) {
        console.error('Load profile error:', error);
    }
}

// Показать определенную секцию
async function showSection(sectionId) {
    // Скрыть все секции
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Убрать активный класс с кнопок навигации
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Показать выбранную секцию
    document.getElementById(sectionId).classList.add('active');
    
    // Добавить активный класс к соответствующей кнопке
    const activeBtnId = sectionId.replace('-section', '-btn');
    document.getElementById(activeBtnId).classList.add('active');
    
    // Загрузить данные для секции, если нужно
    switch(sectionId) {
        case 'profile-section':
            await loadUserProfile();
            break;
        case 'tracks-section':
            loadUserTracks();
            break;
        case 'collections-section':
            loadUserCollections();
            break;
        case 'search-section':
            loadGenresForSearch();
            break;
        case 'artists-section':
            loadUserArtists();
            break;
        case 'admin-section':
            if (isAdmin) {
                loadAdminUsers();
            }
            break;
    }
}

// Загрузка начальных данных
async function loadInitialData() {
    await Promise.all([
        loadGenres(),
        loadArtists()
    ]);
}

// Загрузка жанров
async function loadGenres() {
    try {
        const genres = await apiRequest('/genres');
        if (genres) {
            allGenres = genres;
        }
    } catch (error) {
        console.error('Load genres error:', error);
    }
}

// Загрузка всех исполнителей пользователя
async function loadArtists() {
    try {
        const artists = await apiRequest('/artists');
        if (artists) {
            allArtists = artists;
        }
    } catch (error) {
        console.error('Load artists error:', error);
    }
}

// Загрузка авторов пользователя
async function loadUserArtists() {
    try {
        await loadArtists(); // Reload artists from server
        displayArtists(allArtists);
    } catch (error) {
        console.error('Load user artists error:', error);
    }
}

// Отображение авторов
function displayArtists(artists) {
    const tbody = document.getElementById('artists-tbody');
    tbody.innerHTML = '';
    
    if (!artists || artists.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2">Нет исполнителей</td></tr>';
        return;
    }
    
    artists.forEach(artist => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${artist.name}</td>
            <td>
                <button class="btn btn-secondary" onclick="showEditArtistModal(${artist.artist_id})">Редактировать</button>
                <button class="btn btn-danger" onclick="deleteArtist(${artist.artist_id})">Удалить</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Загрузка жанров для поиска
function loadGenresForSearch() {
    const genreSelect = document.getElementById('search-genre');
    genreSelect.innerHTML = '<option value="">Все жанры</option>';
    
    allGenres.forEach(genre => {
        const option = document.createElement('option');
        option.value = genre.genre_id;
        option.textContent = genre.name;
        genreSelect.appendChild(option);
    });
}

// Выход из системы
function logout() {
    localStorage.clear();
    window.location.href = 'login.html';
}

// Сохранение профиля
async function saveProfile(e) {
    e.preventDefault();
    
    // Get avatar URL from hidden field (if changed) or use current user's avatar
    const avatarUrl = document.getElementById('avatar-url').value || currentUser.avatar_url;
    
    const profileData = {
        first_name: document.getElementById('first-name').value,
        last_name: document.getElementById('last-name').value,
        email: document.getElementById('email').value,
        avatar_url: avatarUrl
    };
    
    try {
        const result = await apiRequest('/profile', {
            method: 'PUT',
            body: JSON.stringify(profileData)
        });
        
        if (result) {
            // Reload profile from server to get updated data
            const updatedProfile = await apiRequest('/profile');
            if (updatedProfile) {
                currentUser = {
                    user_id: updatedProfile.user_id,
                    login: updatedProfile.login,
                    first_name: updatedProfile.first_name,
                    last_name: updatedProfile.last_name,
                    email: updatedProfile.email,
                    avatar_url: updatedProfile.avatar_url,
                    is_admin: updatedProfile.is_admin
                };
                updateUserInfo();
                alert('Профиль успешно сохранен!');
            }
        }
    } catch (error) {
        console.error('Save profile error:', error);
    }
}

// Смена аватара
function changeAvatar() {
    const url = prompt('Введите URL аватара:');
    if (url) {
        // Update only the preview - don't save yet
        document.getElementById('avatar-img').src = url || 'https://via.placeholder.com/150';
        // Store the new avatar URL in hidden field - will be saved when form is submitted
        document.getElementById('avatar-url').value = url;
    }
}

// Загрузка треков пользователя
async function loadUserTracks() {
    try {
        const tracks = await apiRequest('/tracks');
        if (tracks) {
    displayTracks(tracks);
        }
    } catch (error) {
        console.error('Load tracks error:', error);
    }
}

// Отображение треков в таблице
function displayTracks(tracks) {
    const tbody = document.getElementById('tracks-tbody');
    tbody.innerHTML = '';
    
    if (!tracks || tracks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">Нет треков</td></tr>';
        return;
    }
    
    tracks.forEach(track => {
        const row = document.createElement('tr');
        
        const durationFormatted = formatDuration(track.duration_sec);
        
        row.innerHTML = `
            <td>${track.title}</td>
            <td>${track.artist_name}</td>
            <td>${track.genre_name}</td>
            <td>${track.bpm || 'N/A'}</td>
            <td>${durationFormatted}</td>
            <td>${track.created_at ? new Date(track.created_at).toLocaleDateString('ru-RU') : 'N/A'}</td>
            <td>
                <button class="btn btn-primary" onclick="showAddTrackToCollectionModal(${track.track_id})">В коллекцию</button>
                <button class="btn btn-secondary" onclick="showEditTrackModal(${track.track_id})">Редактировать</button>
                <button class="btn btn-danger" onclick="deleteTrack(${track.track_id})">Удалить</button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Форматирование длительности (секунды в MM:SS)
function formatDuration(seconds) {
    if (!seconds) return 'N/A';
    
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// Показать модальное окно добавления трека
async function showAddTrackModal() {
    // Ensure artists and genres are loaded
    if (allArtists.length === 0) await loadArtists();
    if (allGenres.length === 0) await loadGenres();
    
    const modalBody = document.getElementById('modal-body');
    modalBody.innerHTML = `
        <form id="track-form">
            <div class="form-group">
                <label for="track-title">Название:</label>
                <input type="text" id="track-title" required>
            </div>
            <div class="form-group">
                <label for="track-artist">Исполнитель:</label>
                <select id="track-artist" required>
                    <option value="">Выберите исполнителя</option>
                    ${allArtists.map(artist => `<option value="${artist.artist_id}">${artist.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label for="track-genre">Жанр:</label>
                <select id="track-genre" required>
                    <option value="">Выберите жанр</option>
                    ${allGenres.map(genre => `<option value="${genre.genre_id}">${genre.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label for="track-bpm">BPM:</label>
                <input type="number" id="track-bpm" min="0">
            </div>
            <div class="form-group">
                <label for="track-duration">Длительность (сек):</label>
                <input type="number" id="track-duration" min="0">
            </div>
            <div class="form-group">
                <button type="submit" class="btn btn-primary">Сохранить</button>
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Отмена</button>
            </div>
        </form>
    `;
    
    document.getElementById('modal-title').textContent = 'Добавить трек';
    document.getElementById('track-form').addEventListener('submit', saveTrack);
    
    showModal();
}

// Показать модальное окно редактирования трека
async function showEditTrackModal(trackId) {
    try {
        // Load current tracks to find the one to edit
        const tracks = await apiRequest('/tracks');
        const track = tracks.find(t => t.track_id === trackId);
        
        if (!track) {
            alert('Трек не найден');
            return;
        }
        
        // Ensure artists and genres are loaded
        if (allArtists.length === 0) await loadArtists();
        if (allGenres.length === 0) await loadGenres();
        
        // Find artist_id and genre_id from names
        const artist = allArtists.find(a => a.name === track.artist_name);
        const genre = allGenres.find(g => g.name === track.genre_name);
    
    const modalBody = document.getElementById('modal-body');
    modalBody.innerHTML = `
        <form id="track-form">
            <input type="hidden" id="track-id" value="${track.track_id}">
            <div class="form-group">
                <label for="track-title">Название:</label>
                <input type="text" id="track-title" value="${track.title}" required>
            </div>
            <div class="form-group">
                <label for="track-artist">Исполнитель:</label>
                <select id="track-artist" required>
                    <option value="">Выберите исполнителя</option>
                        ${allArtists.map(a => 
                            `<option value="${a.artist_id}" ${artist && a.artist_id === artist.artist_id ? 'selected' : ''}>${a.name}</option>`
                    ).join('')}
                </select>
            </div>
            <div class="form-group">
                <label for="track-genre">Жанр:</label>
                <select id="track-genre" required>
                    <option value="">Выберите жанр</option>
                        ${allGenres.map(g => 
                            `<option value="${g.genre_id}" ${genre && g.genre_id === genre.genre_id ? 'selected' : ''}>${g.name}</option>`
                    ).join('')}
                </select>
            </div>
            <div class="form-group">
                <label for="track-bpm">BPM:</label>
                    <input type="number" id="track-bpm" value="${track.bpm || ''}" min="0">
            </div>
            <div class="form-group">
                <label for="track-duration">Длительность (сек):</label>
                    <input type="number" id="track-duration" value="${track.duration_sec || ''}" min="0">
            </div>
            <div class="form-group">
                <button type="submit" class="btn btn-primary">Сохранить</button>
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Отмена</button>
            </div>
        </form>
    `;
    
    document.getElementById('modal-title').textContent = 'Редактировать трек';
    document.getElementById('track-form').addEventListener('submit', saveTrack);
    
    showModal();
    } catch (error) {
        console.error('Show edit track modal error:', error);
    }
}

// Сохранение трека
async function saveTrack(e) {
    e.preventDefault();
    
    const trackId = document.getElementById('track-id')?.value;
    const trackData = {
        title: document.getElementById('track-title').value,
        artist_id: parseInt(document.getElementById('track-artist').value),
        genre_id: parseInt(document.getElementById('track-genre').value),
        bpm: document.getElementById('track-bpm').value ? parseInt(document.getElementById('track-bpm').value) : null,
        duration_sec: document.getElementById('track-duration').value ? parseInt(document.getElementById('track-duration').value) : null
    };
    
    try {
        if (trackId) {
            // Редактирование
            const result = await apiRequest(`/tracks/${trackId}`, {
                method: 'PUT',
                body: JSON.stringify(trackData)
            });
            
            if (result) {
                alert('Трек успешно обновлен!');
    closeModal();
                await loadUserTracks();
            }
        } else {
            // Добавление
            const result = await apiRequest('/tracks', {
                method: 'POST',
                body: JSON.stringify(trackData)
            });
            
            if (result && result.track_id) {
                alert('Трек успешно добавлен!');
                closeModal();
                await loadUserTracks();
            } else {
                const errorMsg = result?.message || 'Не удалось добавить трек. Проверьте, что все поля заполнены правильно.';
                alert(`Ошибка: ${errorMsg}`);
            }
        }
    } catch (error) {
        console.error('Save track error:', error);
        const errorMessage = error.message || 'Ошибка при сохранении трека';
        alert(`Ошибка: ${errorMessage}`);
    }
}

// Удаление трека
async function deleteTrack(trackId) {
    if (!confirm('Вы уверены, что хотите удалить этот трек?')) return;

    try {
        const result = await apiRequest(`/tracks/${trackId}`, {
            method: 'DELETE'
        });
        
        if (result) {
            alert('Трек успешно удален!');
            await loadUserTracks();
        }
    } catch (error) {
        console.error('Delete track error:', error);
    }
}

// Загрузка коллекций пользователя
async function loadUserCollections() {
    try {
        const collections = await apiRequest('/collections');
        if (collections) {
            // Load tracks for each collection
            for (let collection of collections) {
                // Note: Backend doesn't return tracks in collection, so we'll display basic info
                collection.tracks = []; // Placeholder
            }
    displayCollections(collections);
        }
    } catch (error) {
        console.error('Load collections error:', error);
    }
}

// Отображение коллекций
function displayCollections(collections) {
    const container = document.getElementById('collections-container');
    container.innerHTML = '';
    
    if (!collections || collections.length === 0) {
        container.innerHTML = '<p>Нет коллекций. Создайте первую коллекцию!</p>';
        return;
    }
    
    collections.forEach(collection => {
        const collectionDiv = document.createElement('div');
        collectionDiv.className = 'collection-item';
        collectionDiv.id = `collection-${collection.collection_id}`;
        
        collectionDiv.innerHTML = `
            <div class="collection-header">
                <div class="collection-name">${collection.name} ${collection.is_favorite ? '❤️' : ''}</div>
                <div class="collection-info">Создано: ${collection.created_at ? new Date(collection.created_at).toLocaleDateString('ru-RU') : 'N/A'}</div>
                <div class="collection-info">Треков: <span id="tracks-count-${collection.collection_id}">${collection.tracks_count || 0}</span></div>
            </div>
            <div class="collection-tracks" id="tracks-list-${collection.collection_id}" style="display: none;">
                <h4>Треки в коллекции:</h4>
                <div id="tracks-content-${collection.collection_id}">
                    <p>Загрузка...</p>
                </div>
            </div>
            <div class="collection-controls">
                <button class="btn btn-primary" id="toggle-btn-${collection.collection_id}" onclick="toggleCollectionTracks(${collection.collection_id})">Показать треки</button>
                <button class="btn btn-secondary" onclick="showEditCollectionModal(${collection.collection_id})">Редактировать</button>
                <button class="btn btn-danger" onclick="deleteCollection(${collection.collection_id})">Удалить</button>
            </div>
        `;
        
        container.appendChild(collectionDiv);
    });
}

// Переключение отображения треков коллекции (безопасная версия)
async function toggleCollectionTracks(collectionId) {
    try {
        const tracksList = document.getElementById(`tracks-list-${collectionId}`);
        const tracksContent = document.getElementById(`tracks-content-${collectionId}`);
        const button = document.getElementById(`toggle-btn-${collectionId}`);
        
        if (!tracksList || !tracksContent || !button) {
            console.error('Элементы коллекции не найдены');
            return;
        }
        
        if (tracksList.style.display === 'none' || tracksList.style.display === '') {
            // Загрузить треки
            tracksContent.innerHTML = '<p>Загрузка...</p>';
            tracksList.style.display = 'block';
            button.textContent = 'Скрыть треки';
            
            try {
                const tracks = await apiRequest(`/collections/${collectionId}/tracks`);
                if (tracks) {
                    if (tracks.length === 0) {
                        tracksContent.innerHTML = '<p>В коллекции пока нет треков. Добавьте треки из списка "Мои треки".</p>';
                    } else {
                        let html = '<table class="tracks-table"><thead><tr><th>Название</th><th>Исполнитель</th><th>Жанр</th><th>BPM</th><th>Длительность</th><th>Добавлено</th><th>Действия</th></tr></thead><tbody>';
                        tracks.forEach(track => {
                            html += `<tr>
                                <td>${track.title}</td>
                                <td>${track.artist_name}</td>
                                <td>${track.genre_name}</td>
                                <td>${track.bpm || 'N/A'}</td>
                                <td>${formatDuration(track.duration_sec)}</td>
                                <td>${track.added_at ? new Date(track.added_at).toLocaleDateString('ru-RU') : 'N/A'}</td>
                                <td><button class="btn btn-sm btn-danger" onclick="removeTrackFromCollection(${collectionId}, ${track.track_id})">Удалить</button></td>
                            </tr>`;
                        });
                        html += '</tbody></table>';
                        tracksContent.innerHTML = html;
                    }
                }
            } catch (error) {
                console.error('Load collection tracks error:', error);
                tracksContent.innerHTML = '<p>Ошибка при загрузке треков</p>';
            }
        } else {
            tracksList.style.display = 'none';
            button.textContent = 'Показать треки';
        }
    } catch (error) {
        console.error('Toggle collection tracks error:', error);
        alert('Ошибка при отображении треков коллекции');
    }
}


// Показать модальное окно добавления коллекции
function showAddCollectionModal() {
    const modalBody = document.getElementById('modal-body');
    modalBody.innerHTML = `
        <form id="collection-form">
            <div class="form-group">
                <label for="collection-name">Название коллекции:</label>
                <input type="text" id="collection-name" required>
            </div>
            <div class="form-group">
                <label>
                    <input type="checkbox" id="collection-favorite"> 
                    Сделать коллекцией "Любимые треки"
                </label>
            </div>
            <div class="form-group">
                <button type="submit" class="btn btn-primary">Создать</button>
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Отмена</button>
            </div>
        </form>
    `;
    
    document.getElementById('modal-title').textContent = 'Создать коллекцию';
    
    // Удалить старые обработчики и добавить новый
    const form = document.getElementById('collection-form');
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);
    document.getElementById('collection-form').addEventListener('submit', saveCollection);
    
    showModal();
}

// Сохранение коллекции
async function saveCollection(e) {
    e.preventDefault();
    
    // Предотвратить множественные отправки
    const submitButton = e.target.querySelector('button[type="submit"]');
    if (submitButton && submitButton.disabled) {
        return; // Уже отправляется
    }
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Сохранение...';
    }
    
    const collectionId = document.getElementById('collection-id')?.value;
    const collectionData = {
        name: document.getElementById('collection-name').value.trim(),
        is_favorite: document.getElementById('collection-favorite').checked
    };
    
    if (!collectionData.name) {
        alert('Название коллекции обязательно');
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = collectionId ? 'Сохранить' : 'Создать';
        }
        return;
    }
    
    try {
        if (collectionId) {
            // Редактирование
            const result = await apiRequest(`/collections/${collectionId}`, {
                method: 'PUT',
                body: JSON.stringify(collectionData)
            });
            
            if (result) {
                alert('Коллекция успешно обновлена!');
                closeModal();
                await loadUserCollections();
            }
        } else {
            // Создание
            const result = await apiRequest('/collections', {
                method: 'POST',
                body: JSON.stringify(collectionData)
            });
            
            if (result && result.collection_id) {
                alert('Коллекция успешно создана!');
                closeModal();
                await loadUserCollections();
            } else {
                const errorMsg = result?.message || 'Не удалось создать коллекцию';
                alert(`Ошибка: ${errorMsg}`);
            }
        }
    } catch (error) {
        console.error('Save collection error:', error);
        const errorMsg = error.message || 'Ошибка при сохранении коллекции';
        alert(`Ошибка: ${errorMsg}`);
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = collectionId ? 'Сохранить' : 'Создать';
        }
    }
}

// Показать модальное окно редактирования коллекции
async function showEditCollectionModal(collectionId) {
    try {
        const collections = await apiRequest('/collections');
        const collection = collections.find(c => c.collection_id === collectionId);
        
        if (!collection) {
            alert('Коллекция не найдена');
            return;
        }
        
        const modalBody = document.getElementById('modal-body');
        modalBody.innerHTML = `
            <form id="collection-form">
                <input type="hidden" id="collection-id" value="${collection.collection_id}">
                <div class="form-group">
                    <label for="collection-name">Название коллекции:</label>
                    <input type="text" id="collection-name" value="${collection.name}" required>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="collection-favorite" ${collection.is_favorite ? 'checked' : ''}> 
                        Сделать коллекцией "Любимые треки"
                    </label>
                </div>
                <div class="form-group">
                    <button type="submit" class="btn btn-primary">Сохранить</button>
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Отмена</button>
                </div>
            </form>
        `;
        
        document.getElementById('modal-title').textContent = 'Редактировать коллекцию';
        
        // Удалить старые обработчики и добавить новый
        const form = document.getElementById('collection-form');
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        document.getElementById('collection-form').addEventListener('submit', saveCollection);
        
        showModal();
    } catch (error) {
        console.error('Show edit collection modal error:', error);
    }
}

// Удаление коллекции
async function deleteCollection(collectionId) {
    if (!confirm('Вы уверены, что хотите удалить эту коллекцию?')) return;

    try {
        const result = await apiRequest(`/collections/${collectionId}`, {
            method: 'DELETE'
        });
        
        if (result) {
            alert('Коллекция успешно удалена!');
            await loadUserCollections();
        }
    } catch (error) {
        console.error('Delete collection error:', error);
    }
}

// Выполнение поиска
async function performSearch() {
    const title = document.getElementById('search-title').value.trim() || null;
    const artist = document.getElementById('search-artist').value.trim() || null;
    const genreId = document.getElementById('search-genre').value || null;
    const bpm = document.getElementById('search-bpm').value || null;
    const duration = document.getElementById('search-duration').value || null;
    
    try {
        const params = new URLSearchParams();
        if (title) params.append('title', title);
        if (artist) params.append('artist', artist);
        if (genreId) params.append('genre_id', genreId);
        if (bpm) params.append('bpm', bpm);
        if (duration) params.append('duration', duration);
        
        const results = await apiRequest(`/search/tracks?${params.toString()}`);
        if (results) {
            displaySearchResults(results);
        }
    } catch (error) {
        console.error('Search error:', error);
    }
}

// Отображение результатов поиска
function displaySearchResults(results) {
    const tbody = document.getElementById('search-results-tbody');
    tbody.innerHTML = '';
    
    if (!results || results.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">Ничего не найдено</td></tr>';
        return;
    }
    
    results.forEach(track => {
        const durationFormatted = formatDuration(track.duration_sec);
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${track.title}</td>
            <td>${track.artist_name}</td>
            <td>${track.genre_name}</td>
            <td>${track.bpm || 'N/A'}</td>
            <td>${durationFormatted}</td>
            <td>${track.created_at ? new Date(track.created_at).toLocaleDateString('ru-RU') : 'N/A'}</td>
            <td>
                <button class="btn btn-primary" onclick="showAddTrackToCollectionModal(${track.track_id})">В коллекцию</button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Сброс поиска
function resetSearch() {
    document.getElementById('search-title').value = '';
    document.getElementById('search-artist').value = '';
    document.getElementById('search-genre').value = '';
    document.getElementById('search-bpm').value = '';
    document.getElementById('search-duration').value = '';
    
    document.getElementById('search-results-tbody').innerHTML = '';
}

// Показать модальное окно добавления трека в коллекцию
async function showAddTrackToCollectionModal(trackId) {
    try {
        // Загрузить список коллекций пользователя
        const collections = await apiRequest('/collections');
        if (!collections || collections.length === 0) {
            alert('У вас нет коллекций. Создайте коллекцию сначала!');
            return;
        }
        
        const modalBody = document.getElementById('modal-body');
        modalBody.innerHTML = `
            <form id="add-to-collection-form">
                <input type="hidden" id="track-id-to-add" value="${trackId}">
                <div class="form-group">
                    <label for="collection-select">Выберите коллекцию:</label>
                    <select id="collection-select" required>
                        <option value="">Выберите коллекцию</option>
                        ${collections.map(c => `<option value="${c.collection_id}">${c.name} ${c.is_favorite ? '❤️' : ''}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <button type="submit" class="btn btn-primary">Добавить</button>
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Отмена</button>
                </div>
            </form>
        `;
        
        document.getElementById('modal-title').textContent = 'Добавить трек в коллекцию';
        document.getElementById('add-to-collection-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const collectionId = document.getElementById('collection-select').value;
            if (collectionId) {
                await addTrackToCollection(parseInt(collectionId), trackId);
            }
        });
        
        showModal();
    } catch (error) {
        console.error('Show add track to collection modal error:', error);
        alert('Ошибка при загрузке коллекций');
    }
}

// Добавление трека в коллекцию
async function addTrackToCollection(collectionId, trackId) {
    try {
        const result = await apiRequest(`/collections/${collectionId}/tracks`, {
            method: 'POST',
            body: JSON.stringify({ track_id: trackId })
        });
        
        if (result) {
            alert('Трек успешно добавлен в коллекцию!');
            closeModal();
            // Обновить список коллекций, чтобы обновить счетчики
            await loadUserCollections();
        }
    } catch (error) {
        console.error('Add track to collection error:', error);
        const errorMsg = error.message || 'Ошибка при добавлении трека в коллекцию';
        alert(`Ошибка: ${errorMsg}`);
    }
}

// Удаление трека из коллекции
async function removeTrackFromCollection(collectionId, trackId) {
    if (!confirm('Удалить трек из коллекции?')) return;

    try {
        const result = await apiRequest(`/collections/${collectionId}/tracks/${trackId}`, {
            method: 'DELETE'
        });
        
        if (result) {
            alert('Трек удален из коллекции');
            // Обновить список треков в коллекции, если он открыт
            const tracksList = document.getElementById(`tracks-list-${collectionId}`);
            if (tracksList && tracksList.style.display !== 'none') {
                // Перезагрузить треки
                await toggleCollectionTracks(collectionId); // Скрыть
                await toggleCollectionTracks(collectionId); // Показать снова (загрузит заново)
            }
            // Обновить счетчик
            await loadUserCollections();
        }
    } catch (error) {
        console.error('Remove track from collection error:', error);
        alert('Ошибка при удалении трека из коллекции');
    }
}

// Переключение вкладок админ-панели
function switchAdminTab(tabName) {
    // Снять активный класс со всех кнопок
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Добавить активный класс к нажатой кнопке
    event.target.classList.add('active');
    
    const adminContent = document.querySelector('.admin-content');
    
    switch(tabName) {
        case 'users':
            loadAdminUsers();
            break;
        case 'tracks':
            loadAdminTracks();
            break;
        case 'audit':
            loadAdminAudit();
            break;
    }
}

// Загрузка пользователей для админ-панели
async function loadAdminUsers() {
    if (!isAdmin) return;
    
    try {
        const users = await apiRequest('/admin/users');
        if (users) {
            const adminContent = document.querySelector('.admin-content');
            let html = '<h3>Список пользователей</h3><table class="admin-table"><thead><tr><th>ID</th><th>Логин</th><th>Имя</th><th>Фамилия</th><th>Email</th><th>Админ</th><th>Активен</th><th>Дата создания</th></tr></thead><tbody>';
            
            users.forEach(user => {
                html += `<tr>
                    <td>${user.user_id}</td>
                    <td>${user.login}</td>
                    <td>${user.first_name || 'N/A'}</td>
                    <td>${user.last_name || 'N/A'}</td>
                    <td>${user.email || 'N/A'}</td>
                    <td>${user.is_admin ? 'Да' : 'Нет'}</td>
                    <td>${user.is_active ? 'Да' : 'Нет'}</td>
                    <td>${user.created_at ? new Date(user.created_at).toLocaleDateString('ru-RU') : 'N/A'}</td>
                </tr>`;
            });
            
            html += '</tbody></table>';
            adminContent.innerHTML = html;
        }
    } catch (error) {
        console.error('Load admin users error:', error);
    }
}

// Загрузка всех треков для админ-панели
async function loadAdminTracks() {
    if (!isAdmin) return;
    
    try {
        const tracks = await apiRequest('/admin/tracks');
        if (tracks) {
            const adminContent = document.querySelector('.admin-content');
            let html = '<h3>Все треки</h3><table class="admin-table"><thead><tr><th>ID</th><th>Название</th><th>Исполнитель</th><th>Жанр</th><th>BPM</th><th>Длительность</th><th>Пользователь</th><th>Дата создания</th></tr></thead><tbody>';
            
            tracks.forEach(track => {
                html += `<tr>
                    <td>${track.track_id}</td>
                    <td>${track.title}</td>
                    <td>${track.artist_name}</td>
                    <td>${track.genre_name}</td>
                    <td>${track.bpm || 'N/A'}</td>
                    <td>${formatDuration(track.duration_sec)}</td>
                    <td>${track.user_login || 'N/A'}</td>
                    <td>${track.created_at ? new Date(track.created_at).toLocaleDateString('ru-RU') : 'N/A'}</td>
                </tr>`;
            });
            
            html += '</tbody></table>';
            adminContent.innerHTML = html;
        }
    } catch (error) {
        console.error('Load admin tracks error:', error);
    }
}

// Загрузка журнала аудита
async function loadAdminAudit() {
    if (!isAdmin) return;
    
    try {
        const auditLog = await apiRequest('/admin/audit');
        if (auditLog) {
            const adminContent = document.querySelector('.admin-content');
            let html = '<h3>Журнал операций</h3><table class="admin-table"><thead><tr><th>ID</th><th>Пользователь</th><th>Тип операции</th><th>Таблица</th><th>ID записи</th><th>Время</th><th>Детали</th></tr></thead><tbody>';
            
            auditLog.forEach(entry => {
                html += `<tr>
                    <td>${entry.log_id}</td>
                    <td>${entry.user_login || 'N/A'}</td>
                    <td>${entry.operation_type}</td>
                    <td>${entry.table_name}</td>
                    <td>${entry.record_id || 'N/A'}</td>
                    <td>${entry.operation_time ? new Date(entry.operation_time).toLocaleString('ru-RU') : 'N/A'}</td>
                    <td>${entry.details ? JSON.stringify(entry.details) : 'N/A'}</td>
                </tr>`;
            });
            
            html += '</tbody></table>';
            adminContent.innerHTML = html;
        }
    } catch (error) {
        console.error('Load admin audit error:', error);
    }
}

// Показать модальное окно
function showModal() {
    document.getElementById('modal-overlay').style.display = 'flex';
}

// Закрыть модальное окно
function closeModal() {
    document.getElementById('modal-overlay').style.display = 'none';
}
