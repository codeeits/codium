// A class helper for providing modal presets (e. g. edit profile, delete confirmation, etc.) and handling common modal logic.

export class ModalHelpers {
    
    static EditProfile = {
        
        validateForm: (data) => {
            /* data syntax example: 
                data = {
                    email: 'john@example.com',
                    username: 'john_doe',
                    oldPassword: 'old_password',
                    newPassword: 'new_password'
                }
            */
            const { email, username, oldPassword, newPassword } = data;
            
            // Email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (email && !emailRegex.test(email)) return { valid: false, error: 'Invalid email format' };

            // Username validation
            if (username && (username.length < 3 || username.length > 20)) return { valid: false, error: 'Username must be between 3 and 20 characters long' };

            // Password validation
            if (oldPassword || newPassword) {
                if (!oldPassword) return { valid: false, error: 'Please enter your current password to set a new one' };
                if (!newPassword || newPassword.length < 6) return { valid: false, error: 'New password must be at least 6 characters long' };
                if (oldPassword === newPassword) return { valid: false, error: 'New password must be different from old password' };
            }

            return { 
                valid: true, 
                // data: { email, username, oldPassword, newPassword } 
            };
        },

        updateProfileData: async (data) => {

            const validation = ModalHelpers.EditProfile.validateForm(data);

            if (!validation.valid) {
                throw new Error(validation.error);
            }

            if (data.profilePicture) {
                const uploadResult = await window.apiService.uploadFile(data.profilePicture);
                await window.apiService.updateProfilePicture(uploadResult.file_id);
            }
            
            if (data.email) await window.apiService.updateEmail(data.email);
            if (data.username) await window.apiService.updateUsername(data.username);
            
            if (data.newPassword && data.oldPassword) {
                await window.apiService.updatePassword(data.oldPassword, data.newPassword);
            }

            // everything succeededed yay!!!
            return { success: true };
        }
    };
}

/* USAGE: 
*/