/*
   __    ____  ____  _   _    __    _  _  ____  __    ____  ____  ___     ____  ___ 
  /__\  (  _ \(_  _)( )_( )  /__\  ( \( )(  _ \(  )  ( ___)(  _ \/ __)   (_  _)/ __)
 /(__)\  )___/ _)(_  ) _ (  /(__)\  )  (  )(_) ))(__  )__)  )   /\__ \  .-_)(  \__ \
(__)(__)(__)  (____)(_) (_)(__)(__)(_)\_)(____/(____)(____)(_)\_)(___/()\____) (___/

Pentru caching mai bun si gestionare mai eficientă.
(pentru my sanity mai tarziu)

Type O Negative - I Don't Wanna Be Me
*/

class ApiService {
    constructor() {
        this.baseURL = '';
        this.authToken = null;
        this.refreshToken = null;
        this.loadTokens();
    }

    // ===========================================
    // AUTH si tokens
    // ===========================================

    loadTokens() {
        this.authToken = localStorage.getItem('authToken');
        this.refreshToken = localStorage.getItem('refreshToken');
    }

    saveTokens(authToken, refreshToken) {
        this.authToken = authToken;
        this.refreshToken = refreshToken;
        localStorage.setItem('authToken', authToken);
        if (refreshToken) {
            localStorage.setItem('refreshToken', refreshToken);
        }
    }

    clearTokens() {
        this.authToken = null;
        this.refreshToken = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('username');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('isAdmin');
        localStorage.removeItem('userID');
        localStorage.removeItem('profilePicID');
    }

    getAuthHeaders() {
        if (!this.authToken) {
            throw new Error('No authentication token available');
        }
        return {
            'Authorization': `Bearer ${this.authToken}`,
            'Content-Type': 'application/json'
        };
    }

    isAuthenticated() {
        return !!this.authToken;
    }

    // ===========================================
    // Requests!
    // ===========================================

    async makeRequest(url, options = {}) {
        const config = {

            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }

        };

        try {

            const response = await fetch(`${this.baseURL}${url}`, config);
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new ApiError(response.status, errorText, url);
            }

            const contentLength = response.headers.get('Content-Length');
            const contentType = response.headers.get('Content-Type');
            
            if (contentLength === '0' || response.status === 204) {
                return null;
            }

            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }

            return await response.text();

        } catch (error) {

            if (error instanceof ApiError) {
                throw error;
            }

            throw new ApiError(0, `Network error: ${error.message}`, url);

        }
    }

    async get(url, requiresAuth = false) {
        const headers = requiresAuth ? this.getAuthHeaders() : {};
        return this.makeRequest(url, {
            method: 'GET',
            headers
        });
    }

    async post(url, data, requiresAuth = false) {
        const headers = requiresAuth ? this.getAuthHeaders() : { 'Content-Type': 'application/json' };
        return this.makeRequest(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(data)
        });
    }

    async put(url, data, requiresAuth = true) {
        return this.makeRequest(url, {
            method: 'PUT',
            headers: this.getAuthHeaders(),
            body: JSON.stringify(data)
        });
    }

    async delete(url, requiresAuth = true) {
        return this.makeRequest(url, {
            method: 'DELETE',
            headers: this.getAuthHeaders()
        });
    }

    // ===========================================
    // File Upload Methods
    // ===========================================

    async uploadFile(file, location = 'images') {

        if (!this.authToken) {
            throw new Error('Authentication required for file upload');
        }

        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${this.baseURL}/api/upload?location=${location}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.authToken}`
            },
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new ApiError(response.status, errorText, `/api/upload?location=${location}`);
        }

        return await response.json();
    }

    // ===========================================
    // auth endpoints
    // ===========================================

    async login(email, password) {
        let response = await this.post('/api/login', {
            email: email.trim(),
            password: password
        });

        // Parse JSON string if needed
        if (typeof response === 'string') {
            response = JSON.parse(response);
        }

        if (response.auth_token) {
            this.saveTokens(response.auth_token, response.refresh_token);
            
            if (response.user) {
                localStorage.setItem('username', response.user.Username);
                localStorage.setItem('userEmail', response.user.Email);
                localStorage.setItem('isAdmin', response.user.IsAdmin || false);
                localStorage.setItem('userID', response.user.ID);
                if (response.user.ProfilePicID) {
                    localStorage.setItem('profilePicID', response.user.ProfilePicID);
                }
            }
        }

        return response;
    }

    async signup(userData) {
        return this.post('/api/create_user', userData);
    }

    async logout(confirmMessage = false) {
        if (confirmMessage ? confirm('Are you sure you want to log out?') : true) {
            this.clearTokens();
            window.location.href = 'login.html';
            // Trigger auth button update if available
            if (window.refreshAuthButton) {
                window.refreshAuthButton();
            }
        }
    }

    // ===========================================
    // management user endpoints
    // ===========================================

    async getCurrentUser() {
        const userId = localStorage.getItem('userID');
        if (!userId) {
            throw new Error('No user ID found');
        }
        return this.get(`/api/users/${userId}`, true);
    }

    async getUserById(userId) {
        return this.get(`/api/users/${userId}`, true);
    }

    async getCurrentUserUsername() {
        const userID = localStorage.getItem('userID');
        if (!userID) {
            throw new Error('No user ID found');
        }
        let userData = await this.get(`/api/users/${userID}`, true);
        userData = JSON.parse(userData);
        return userData.Username;
    }

    async updateUserField(field, value, pic = false) {
        const data = {};
        data[field] = value;
        return this.put(`/api/users?target_field=${pic ? 'pfp' : field}`, data);
    }

    async updatePassword(oldPassword, newPassword) {
        const data = {
            old_password: oldPassword,
            new_password: newPassword
        };
        return this.put(`/api/users?target_field=password`, data);
    }

    async updateEmail(newEmail) {
        return this.updateUserField('email', newEmail);
    }

    async updateUsername(newUsername) {
        localStorage.setItem('username', newUsername);
        return this.updateUserField('username', newUsername);
    }

    async updateProfilePicture(fileId) {
        return this.updateUserField('image_id', fileId, true);
    }

    // ===========================================
    // Lesson Management Endpoints
    // ===========================================

    async createLesson(lessonData) {
        return this.post('/api/lessons', lessonData, true);
    }

    async getLessons(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `/api/lessons?${queryString}` : '/api/lessons';
        return this.get(url, false);
    }

    async getLessonById(lessonId) {
        return this.get(`/api/lessons?search_type=id&lesson_id=${lessonId}`, false);
    }

    async uploadLesson(lessonData, file) {
        // First upload the file
        const fileResponse = await this.uploadFile(file, 'lessons');
        
        const lessonPayload = {
            ...lessonData,
            content_id: fileResponse.file_id
        };
        
        return this.createLesson(lessonPayload);
    }

    // ===========================================
    // File Management Endpoints
    // ===========================================

    async getFile(fileId) {
        return this.get(`/api/files/${fileId}`, false);
    }

    getFileUrl(fileId) {
        return `${this.baseURL}/api/files/${fileId}`;
    }
}

// ===========================================
// Error Handling
// ===========================================

class ApiError extends Error {
    constructor(status, message, url) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.url = url;
    }

    isNetworkError() {
        return this.status === 0;
    }

    isServerError() {
        return this.status >= 500;
    }

    isClientError() {
        return this.status >= 400 && this.status < 500;
    }

    isUnauthorized() {
        return this.status === 401;
    }

    isForbidden() {
        return this.status === 403;
    }

    isNotFound() {
        return this.status === 404;
    }
}

// ===========================================
// Global Instance & Utilities
// ===========================================

window.apiService = new ApiService();

window.handleApiError = function(error, defaultMessage = 'An error occurred') {
    console.error('API Error:', error);
    
    if (error instanceof ApiError) {
        if (error.isUnauthorized()) {
            alert('Session expired. Please log in again.');
            window.apiService.logout();
            window.location.href = 'login.html';
            return;
        }
        
        if (error.isNetworkError()) {
            alert('Network error. Please check your connection and try again.');
            return;
        }
        
        if (error.isServerError()) {
            alert('Server error. Please try again later.');
            return;
        }
        
        // Show the actual error message for client errors
        alert(error.message || defaultMessage);
    } else {
        alert(defaultMessage);
    }
};

// Quick auth check utility
window.requireAuth = function(redirectTo = 'login.html') {
    if (!window.apiService.isAuthenticated()) {
        window.location.href = redirectTo;
        return false;
    }
    return true;
};

// Export for modules if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ApiService, ApiError };
}