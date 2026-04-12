/*
 ____  ____  __    ____  ___  ____  ____  _  _  ____  ___  ____     ____  ___ 
( ___)(_  _)(  )  ( ___)/ __)( ___)(  _ \( \/ )(_  _)/ __)( ___)   (_  _)/ __)
 )__)  _)(_  )(__  )__) \__ \ )__)  )   / \  /  _)(_( (__  )__)   .-_)(  \__ \
(__)  (____)(____)(____)(___/(____)(_)\_)  \/  (____)\___)(____)()\____) (___/

Part 5.
Handle all file stuff

*/

export class FileService {
    constructor(apiClient) {
        this.api = apiClient;
    }

    async uploadFile(file, location = 'images') {

        if (!this.api.authToken) {
            throw new Error('Authentication required for file upload');
        }

        const formData = new FormData();
        formData.append('file', file);

        let response = await fetch(`${this.api.baseURL}/api/upload?location=${location}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.api.authToken}`
            },
            body: formData
        });

        if (response.status === 401) {
            await this.api.refreshAuthToken();
            response = await fetch(`${this.api.baseURL}/api/upload?location=${location}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.api.authToken}`
                },
                body: formData
            });
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Upload failed (${response.status}): ${errorText || 'Unknown error'}`);
        }

        return await response.json();
    }

    async deleteFile(fileId) {
        if (!this.api.authToken) {
            throw new Error('Authentication required for file deletion');
        }

        let response = await fetch(`${this.api.baseURL}/api/files/${fileId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${this.api.authToken}`
            }
        });

        if (response.status === 401) {
            await this.api.refreshAuthToken();
            response = await fetch(`${this.api.baseURL}/api/files/${fileId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.api.authToken}`
                }
            });
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Deletion failed (${response.status}): ${errorText || 'Unknown error'}`);
        }

        return await response.json();
    }

    async getFile(fileId) {
        return this.api.get(`/api/files/${fileId}`, false);
    }

    getFileUrl(fileId) {
        return `${this.api.baseURL}/api/files/${fileId}`;
    }

    async getProfilePicture(userId = null) {
        // Cross-browser sync: rely on server truth first, then update local cache.
        try {
            let userData = null;

            if (userId) {
                const user = await this.api.users.getUserById(userId);
                userData = typeof user === 'string' ? JSON.parse(user) : user;
            } else {
                const currentUser = await this.api.users.getCurrentUser();
                userData = typeof currentUser === 'string' ? JSON.parse(currentUser) : currentUser;
            }

            const remotePicId = userData?.ProfilePicID || null;

            if (remotePicId) {
                if (!userId) {
                    localStorage.setItem('profilePicID', remotePicId);
                }
                return this.getFileUrl(remotePicId);
            }

            if (!userId) {
                localStorage.removeItem('profilePicID');
            }
            return null;
        } catch (error) {
            if (!userId) {
                const cachedPicId = localStorage.getItem('profilePicID');
                if (cachedPicId) {
                    return this.getFileUrl(cachedPicId);
                }
            }
            console.warn('Failed to resolve profile picture from API:', error);
            return null;
        }
    }
}