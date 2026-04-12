/*
 __  __  ___  ____  ____  ___  ____  ____  _  _  ____  ___  ____     ____  ___ 
(  )(  )/ __)( ___)(  _ \/ __)( ___)(  _ \( \/ )(_  _)/ __)( ___)   (_  _)/ __)
 )(__)( \__ \ )__)  )   /\__ \ )__)  )   / \  /  _)(_( (__  )__)   .-_)(  \__ \
(______)(___/(____)(_)\_)(___/(____)(_)\_)  \/  (____)\___)(____)()\____) (___/

Part 1.
Handle all user related API calls here, such as login, registration, profile updates, etc.

*/

export class UserService {
    constructor(apiClient) {
        this.api = apiClient;
    }

    async login(email, password) {
        let response = await this.api.post('/api/login', {
            email: email.trim(),
            password: password
        });

        if (typeof response === 'string') response = JSON.parse(response);

        if (response.auth_token) {
            this.api.saveTokens(response.auth_token, response.refresh_token);
            if (response.user) {
                localStorage.setItem('username', response.user.Username);
                localStorage.setItem('userEmail', response.user.Email);
                localStorage.setItem('isAdmin', response.user.Permissions === 61);
                localStorage.setItem('userID', response.user.ID);

                if (response.user.ProfilePicID) {
                    localStorage.setItem('profilePicID', response.user.ProfilePicID);
                }
            }
        }
        return response;
    }

    async signup(userData) {
        return this.api.post('/api/create_user', userData);
    }

    async logout(confirmMessage = false, redirect = true) {
        if (confirmMessage ? confirm('Are you sure you want to log out?') : true) {
            this.api.clearTokens();
            if (redirect) {
                window.location.href = '/app/login.html?redirect=' + encodeURIComponent(window.location.href);
            }
            // Trigger auth button update if available
            if (window.refreshAuthButton) {
                window.refreshAuthButton();
            }
        }
    }

    async getCurrentUser() {
        const userId = localStorage.getItem('userID');
        if (!userId) {
            return null;
        }
        return this.api.get(`/api/users/${userId}`, true);
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

    async getCurrentUserUsername() {
        const userID = localStorage.getItem('userID');
        if (!userID) {
            throw new Error('No user ID found');
        }
        let userData = await this.api.get(`/api/users/${userID}`, true);
        userData = typeof userData === 'string' ? JSON.parse(userData) : userData;
        return userData.Username;
    }

    async updateUserField(field, value, pic = false) {
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
        localStorage.setItem('username', newUsername);
        return this.updateUserField('username', newUsername);
    }

    async updateProfilePicture(fileId) {
        return this.updateUserField('image_id', fileId, true);
    }

    async getUserDataGDPR() {
        return this.api.get('/api/users/gdpr', true);
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