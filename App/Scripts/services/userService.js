/*
 __  __  ___  ____  ____  ___  ____  ____  _  _  ____  ___  ____     ____  ___ 
(  )(  )/ __)( ___)(  _ \/ __)( ___)(  _ \( \/ )(_  _)/ __)( ___)   (_  _)/ __)
 )(__)( \__ \ )__)  )   /\__ \ )__)  )   / \  /  _)(_( (__  )__)   .-_)(  \__ \
(______)(___/(____)(_)\_)(___/(____)(_)\_)  \/  (____)\___)(____)()\____) (___/

Part 1.
Handle all user related API calls here, such as login, registration, profile updates, etc.

*/

import { ApiError } from '../core/apiError.js';

export class UserService {
    constructor(apiClient) {
        this.api = apiClient;
    }

    async login(email, password) {
        let response;
        try {
            response = await this.api.post('/api/login', {
                email: email.trim(),
                password: password
            });
        } catch (error) {
            if (error instanceof ApiError && error.status === 418) {
                let payload = null;
                try {
                    payload = JSON.parse(error.message || '{}');
                } catch {
                    payload = null;
                }

                if (payload?.validationToken || payload?.ValidationToken) {
                    return {
                        requiresTotp: true,
                        message: payload.message || payload.Message || 'TOTP verification required',
                        validationToken: payload.validationToken || payload.ValidationToken
                    };
                }
            }
            throw error;
        }

        if (typeof response === 'string') response = JSON.parse(response);

        if (response.user) {
            this.api.setAuthenticatedUser(response.user);
            localStorage.setItem('codium_session_active', 'true');
        }
        return response;
    }

    async signup(userData) {
        return this.api.post('/api/create_user', userData);
    }

    async logout(confirmMessage = false, redirect = true) {
        if (confirmMessage ? confirm('Are you sure you want to log out?') : true) {
            try {
                await this.api.post('/api/users/logout', {});
            } catch (error) {
                if (!(error instanceof ApiError && (error.status === 401 || error.status === 403))) {
                    throw error;
                }
            } finally {
                this.api.clearTokens();
                localStorage.removeItem('codium_session_active');

                if (redirect) {
                    window.location.href = '/app/login.html?redirect=' + encodeURIComponent(window.location.href);
                }

                // Trigger auth button update if available
                if (window.refreshAuthButton) {
                    window.refreshAuthButton();
                }
            }
        }
    }

    async getCurrentUser() {
        let user = this.api.getCachedCurrentUser();
        if (user) return user;

        const isAuth = await this.api.checkAuthentication();
        if (isAuth) {
            return this.api.getCachedCurrentUser();
        }
        
        return null;
    }

    async getCurrentUserID() {
        const currentUser = await this.getCurrentUser();
        if (!currentUser) {
            return null;
        }
        const userData = typeof currentUser === 'string' ? JSON.parse(currentUser) : currentUser;
        return userData.ID;
    }

    async isCurrentAdmin() {
        const currentUser = await this.getCurrentUser();
        if (!currentUser) {
            return false;
        }
        const userData = typeof currentUser === 'string' ? JSON.parse(currentUser) : currentUser;
        return userData.Permissions === 61;
    }

    async getUserById(userId) {
        return this.api.get(`/api/users/${userId}`, true);
    }

    async getAllUsers() {
        return this.api.get('/api/users', true);
    }

    async getCurrentUserUsername() {
        const user = await this.getCurrentUser();
        if (!user) {
            throw new Error('No user currently authenticated');
        }
        return user.Username;
    }

    async updateUserField(field, value, pic = false) {
        const user = this.api.getCachedCurrentUser();
        if (user) {
            const fieldMap = {
                'username': 'Username',
                'email': 'Email',
                'image_id': 'ProfilePicID'
            };

            const userProperty = fieldMap[field];
            if (userProperty) {
                user[userProperty] = value; 
            }
        }

        const data = {};
        data[field] = value;
        return this.api.put(`/api/users?target_field=${pic ? 'pfp' : field}`, data);
    }

    async updatePassword(oldPassword, newPassword) {
        const data = {
            old_password: oldPassword,
            new_password: newPassword
        };
        return this.api.put(`/api/users?target_field=password`, data);
    }

    async updateEmail(newEmail) {
        return this.updateUserField('email', newEmail);
    }

    async updateUsername(newUsername) {    
        return this.updateUserField('username', newUsername);
    }

    async updateProfilePicture(fileId) {
        return this.updateUserField('image_id', fileId, true);
    }

    async getUserDataGDPR() {
        if (localStorage.getItem('codium_session_active') !== 'true') {
            throw new Error('User is not authenticated');
        }
        return this.api.get('/api/users/gdpr', true);
    }

    // totp management

    async initiateTOTPSetup() {
        return this.api.post('/api/users/totp', {}, true);
    }

    async validateTOTPToken(otp) {
        return this.api.post('/api/users/totp/validate', { otp }, true);
    }

    async authenticateWithTOTP(token, otp) {
        let response = await this.api.post('/api/users/totp/authenticate', {
            validation_token: token,
            otp
         }, false);

        if (typeof response === 'string') response = JSON.parse(response);

        if (response.user) {
            this.api.setAuthenticatedUser(response.user);
            localStorage.setItem('codium_session_active', 'true');
        }

        return response;
    }

    async disableTOTP(otp) {
        return this.api.makeRequest('/api/users/totp', {
            method: 'DELETE',
            headers: this.api.getAuthHeaders(),
            body: JSON.stringify({ otp }),
            requiresAuth: true
        });
    }

    // permissions management (admin only)

    async updateUserPermissions(userId, title) {
        const approvedTitles = ['admin', 'basic', 'teacher', 'moderator'];
        if (!approvedTitles.includes(title)) {
            throw new Error(`Invalid title. Approved titles are: ${approvedTitles.join(', ')}`);
        }
        return this.api.post('/admin/users/account_status', { userID: userId, title }, true);
    }

    // danger area

    async deleteAccount(userId = null) {
        try {
            if (userId == null) {
                const currentUser = await this.getCurrentUser();
                
                if (!currentUser) {
                    throw new Error("No current user found to delete.");
                }

                let userData = currentUser;
                if (typeof currentUser === 'string') {
                    userData = JSON.parse(currentUser);
                }
                
                userId = userData?.ID;
                
                if (!userId) {
                    throw new Error("User object does not contain a valid ID.");
                }
            }
            
            return await this.api.delete(`/api/users/${userId}`, true);
            
        } catch (error) {
            console.error("Failed to delete account:", error);
            throw error; 
        }
    }
}