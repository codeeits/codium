/*
 __  __  ___  ____  ____  _   _    __    _  _  ____  __    ____  ____     ____  ___ 
(  )(  )/ __)( ___)(  _ \( )_( )  /__\  ( \( )(  _ \(  )  ( ___)(  _ \   (_  _)/ __)
 )(__)( \__ \ )__)  )   / ) _ (  /(__)\  )  (  )(_) ))(__  )__)  )   /  .-_)(  \__ \
(______)(___/(____)(_)\_)(_) (_)(__)(__)(_)\_)(____/(____)(____)(_)\_)()\____) (___/

Handles user profile management, including viewing and editing profile details,
avatar upload, and logout functionality.
(some of the code that isn't present is contained in the html file itself)

*/

document.addEventListener('DOMContentLoaded', function() {

    // ------------------------------
    // AUTHENTICATION & INITIALIZATION
    // ------------------------------

    if (window.apiService.isAuthenticated() === false) {
        window.location.href = 'login.html';
        return;
    }

    // ------------------------------
    // DOM ELEMENTS
    // ------------------------------

    const userName = document.getElementById('userName');
    const userEmail = document.getElementById('userEmail');
    const avatarImg = document.getElementById('userAvatar');
    const logoutBtn = document.getElementById('logoutBtn');
    const editBtn = document.getElementById('editProfileBtn');

    const modal = document.getElementById('editProfileModal');
    const submitButton = document.getElementById('saveEditBtn');

    modal.style.display = 'none';

    // Initialize page
    loadUserProfile();

    // ------------------------------
    // USER PROFILE LOADING
    // ------------------------------

    async function loadUserProfile() {
        let userData = null;

        try {
            const response = await fetch(`/api/users/${userId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const userData = await response.json();
                displayUserData(userData);
                // Update localStorage with fresh data
                localStorage.setItem('username', userData.Username);
                localStorage.setItem('userEmail', userData.Email);
                localStorage.setItem('isAdmin', userData.IsAdmin.toString());
                localStorage.setItem('userID', userData.ID);
                console.log(userData.ProfilePicID);
                if (userData.ProfilePicID) {
                    localStorage.setItem('ProfilePicID', userData.ProfilePicID);
                }
                console.log('Works yay :v');
            } else {
                throw new Error('Failed to fetch user data');
            }

        } catch (error) {
            console.warn('API call failed');
            userData = {
                username: localStorage.getItem('username') || 'Unknown User',
                email: localStorage.getItem('userEmail') || 'unknown@example.com',
                isAdmin: localStorage.getItem('isAdmin') === 'true',
                id: localStorage.getItem('userID'),
                profilePicID: localStorage.getItem('profilePicID')
            };
            displayUserData(userData);
        }
    }

    function displayUserData(userData) {
        userName.textContent = userData.Username || userData.username;
        userEmail.textContent = userData.Email || userData.email;

        if (userData.ProfilePicID || userData.profilePicID) {
            avatarImg.style.display = 'block';
            avatarImg.src = `/api/files/${userData.ProfilePicID || userData.profilePicID}`;
        } else {
            avatarImg.style.display = 'none';
        }
    }

    // ------------------------------
    // EDIT MODAL FUNCTIONALITY
    // ------------------------------

    function closeModal() {
        modal.children[0].classList.add('closing');

        setTimeout(() => {
            modal.style.display = 'none';
            modal.children[0].classList.remove('closing');
        }, 700);
    }

    editBtn.addEventListener('click', function() {
        console.log('Edit button clicked');
        const cancelBtn = document.getElementById('cancelEditBtn');

        modal.style.display = 'flex';
        
        cancelBtn.onclick = function() {
            closeModal();
        };

        modal.onclick = function(e) {
            if (e.target === modal) {
                closeModal();
            }
        };
    });

    // ------------------------------
    // FORM VALIDATION & SUBMISSION
    // ------------------------------

    const form = document.getElementById('editProfileForm');

    function validateForm() {
        const email = document.getElementById('editEmail').value.trim();
        const username = document.getElementById('editUsername').value.trim();
        const oldPassword = document.getElementById('oldPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (email && !emailRegex.test(email)) {
            return { valid: false, error: 'Invalid email format' };
        }

        if (username && (username.length < 3 || username.length > 20)) {
            return { valid: false, error: 'Username must be between 3 and 20 characters long' };
        }

        if (oldPassword) {
            if (newPassword.length < 6) {
                return { valid: false, error: 'New password must be at least 6 characters long' };
            }
            if (oldPassword === newPassword) {
                return { valid: false, error: 'New password must be different from old password' };
            }
        }

        return { valid: true };
    }

    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        const validation = validateForm();
        if (!validation.valid) {
            alert(validation.error);
            return;
        }

        submitButton.disabled = true;
        submitButton.value = 'Saving...';
        form.style.opacity = '0.6';

        // api calls to update profile

        const formData = {
            email: document.getElementById('editEmail').value.trim() || null,
            username: document.getElementById('editUsername').value.trim() || null,
            oldPassword: document.getElementById('oldPassword').value || null,
            newPassword: document.getElementById('newPassword').value || null,
            profilePicture: document.getElementById('editProfilePicture').files[0] || null
        }

        let imgID = null;

        // image upload
        if (formData.profilePicture) {
            const uploadResult = await window.apiService.uploadFile(formData.profilePicture);
            imgID = uploadResult.file_id;
            console.log('Uploaded image ID:', imgID);
            await window.apiService.updateProfilePicture(imgID);
        }
        
        for (const key in formData) {
            if (formData[key]) {
                if (key === 'profilePicture') continue; // already handled
                
                if (key === 'email') {
                    await window.apiService.updateEmail(formData[key]);
                } else if (key === 'username') {
                    await window.apiService.updateUsername(formData[key]);
                } else if (key === 'newPassword' && formData.oldPassword) {
                    try {
                        await window.apiService.updatePassword(formData.oldPassword, formData.newPassword);
                        console.log('Password update successful');
                    } catch (error) {
                        console.error('Password update failed:', error);
                        alert('Password update failed: ' + error.message);
                    }
                }
            }
        }

        setTimeout(() => {
            location.reload();
        }, 100);
    });

    // ------------------------------
    // LOGOUT FUNCTIONALITY
    // ------------------------------

    logoutBtn.addEventListener('click', function() {
        window.apiService.logout(true);
    });

});