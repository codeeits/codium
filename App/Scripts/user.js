/*
 __  __  ___  ____  ____     ____  ___ 
(  )(  )/ __)( ___)(  _ \   (_  _)/ __)
 )(__)( \__ \ )__)  )   /  .-_)(  \__ \
(______)(___/(____)(_)\_)()\____) (___/

Handles user profile management, including viewing and editing profile details,
avatar upload (soon), and logout functionality.

*/

document.addEventListener('DOMContentLoaded', function() {

    const authToken = localStorage.getItem('authToken');
    if (!authToken) {
        window.location.href = 'login.html';
        return;
    }

    // DOM elements
    const userName = document.getElementById('userName');
    const userEmail = document.getElementById('userEmail');
    const userBadge = document.getElementById('userBadge');
    const logoutBtn = document.getElementById('logoutBtn');

    // Initialize page
    loadUserProfile();
    initializeProgressBars();

    });

    async function loadUserProfile() {
        try {
            
            const userId = localStorage.getItem('userId');
            if (!userId) {
                const userData = {
                    username: localStorage.getItem('username') || 'Unknown User',
                    email: localStorage.getItem('userEmail') || 'unknown@example.com',
                    isAdmin: localStorage.getItem('isAdmin') === 'true',
                    id: localStorage.getItem('userID'),
                    profilePicID: localStorage.getItem('profilePicID')
                };
                
                displayUserData(userData);
                return;
            }

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
                if (userData.ProfilePicID) {
                    localStorage.setItem('profilePicID', userData.ProfilePicID);
                }
            } else {
                throw new Error('Failed to fetch user data');
            }

        } catch (error) {
            console.error('Error loading user profile:', error);
            
            const userData = {
                username: localStorage.getItem('username') || 'Unknown User',
                email: localStorage.getItem('userEmail') || 'unknown@example.com',
                isAdmin: localStorage.getItem('isAdmin') === 'true',
                id: localStorage.getItem('userID'),
                profilePicID: localStorage.getItem('profilePicID')
            };
            
            displayUserData(userData);
            showAlert('error', 'Failed to load fresh user profile data');
        } finally {
        }
    }

    function displayUserData(userData) {
        userName.textContent = userData.Username || userData.username;
        userEmail.textContent = userData.Email || userData.email;
        userBadge.textContent = (userData.IsAdmin || userData.isAdmin) ? 'Admin' : 'Student';
        
        if (userData.IsAdmin || userData.isAdmin) {
            userBadge.style.background = 'linear-gradient(135deg, #ff6b6b, #ff8e8e)';
        }

        if (userData.ProfilePicID || userData.profilePicID) {
            loadProfilePicture(userData.ProfilePicID || userData.profilePicID);
        }
    }