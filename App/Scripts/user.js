/*
 __  __  ___  ____  ____     ____  ___ 
(  )(  )/ __)( ___)(  _ \   (_  _)/ __)
 )(__)( \__ \ )__)  )   /  .-_)(  \__ \
(______)(___/(____)(_)\_)()\____) (___/

Handles user profile management, including viewing and editing profile details,
avatar upload, and logout functionality.
(some of the code that isn't present is contained in the html file itself)

*/

document.addEventListener('DOMContentLoaded', function() {

    const authToken = localStorage.getItem('authToken');
    const userId = localStorage.getItem('userID');

    /*if (!authToken) {
        window.location.href = 'login.html';
        return;
    }*/

    // DOM elements
    const userName = document.getElementById('userName');
    const userEmail = document.getElementById('userEmail');
    const avatarImg = document.getElementById('userAvatar');
    const logoutBtn = document.getElementById('logoutBtn');
    const editBtn = document.getElementById('editProfileBtn');

    const modal = document.getElementById('editProfileModal');

    modal.style.display = 'none';
    
    // Initialize page
    loadUserProfile();

    async function loadUserProfile() {
        let userData  = null;

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
            avatarImg.src = `/api/files/${userData.ProfilePicID || userData.profilePicID}`;
        }
    }
    // edit funct.

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

    // logout funct.

    logoutBtn.addEventListener('click', function() {
        handleLogout();
    });
});