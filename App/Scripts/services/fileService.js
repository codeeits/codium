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
        const formData = new FormData();
        formData.append('file', file);

        const config = {
            method: 'POST',
            credentials: 'include',
            body: formData
        };

        let response = await fetch(`${this.api.baseURL}/api/upload?location=${location}`, config);

        if (response.status === 401) {
            await this.api.refreshAuthToken();
            response = await fetch(`${this.api.baseURL}/api/upload?location=${location}`, config);
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Upload failed (${response.status}): ${errorText || 'Unknown error'}`);
        }

        return await response.json();
    }

    async deleteFile(fileId) {
        const config = {
            method: 'DELETE',
            credentials: 'include'
        };

        let response = await fetch(`${this.api.baseURL}/api/files/${fileId}`, config);

        if (response.status === 401) {
            await this.api.refreshAuthToken();
            response = await fetch(`${this.api.baseURL}/api/files/${fileId}`, config);
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
        try {
            let userData = null;

            if (userId) {
                const user = await this.api.users.getUserById(userId);
                userData = typeof user === 'string' ? JSON.parse(user) : user;
            } else {
                userData = await this.api.users.getCurrentUser();
            }

            const remotePicId = userData?.ProfilePicID || null;
            return remotePicId ? this.getFileUrl(remotePicId) : null;
            
        } catch (error) {
            console.warn('Failed to resolve profile picture from API:', error);
            return null;
        }
    }
}