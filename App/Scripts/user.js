/*
 __  __  ___  ____  ____     ____  ___ 
(  )(  )/ __)( ___)(  _ \   (_  _)/ __)
 )(__)( \__ \ )__)  )   /  .-_)(  \__ \
(______)(___/(____)(_)\_)()\____) (___/

Handles user profile management, including viewing and editing profile details,
avatar upload (soon), and logout functionality.

*/

document.addEventListener('DOMContentLoaded', function() {

    // Check authentication
    const authToken = localStorage.getItem('authToken');
    if (!authToken) {
        window.location.href = 'login.html';
        return;
    }

    // DOM elements
    const userName = document.getElementById('userName');
    const userEmail = document.getElementById('userEmail');
    const userBadge = document.getElementById('userBadge');
    const editProfileBtn = document.getElementById('editProfile');
    const logoutBtn = document.getElementById('logoutBtn');
    const editProfileModal = document.getElementById('editProfileModal');
    const closeModalBtn = document.getElementById('closeModal');
    const cancelEditBtn = document.getElementById('cancelEdit');
    const editProfileForm = document.getElementById('editProfileForm');
    const avatarUploadBtn = document.getElementById('avatarUpload');
    const loading = document.getElementById('loading');
    const errorAlert = document.getElementById('error-alert');
    const successAlert = document.getElementById('success-alert');

    // Initialize page
    loadUserProfile();
    initializeProgressBars();

    // Event listeners
    editProfileBtn.addEventListener('click', openEditModal);
    logoutBtn.addEventListener('click', handleLogout);
    closeModalBtn.addEventListener('click', closeEditModal);
    cancelEditBtn.addEventListener('click', closeEditModal);
    editProfileForm.addEventListener('submit', handleProfileUpdate);
    avatarUploadBtn.addEventListener('click', handleAvatarUpload);

    // Close modal when clicking outside
    editProfileModal.addEventListener('click', function(e) {
        if (e.target === editProfileModal) {
            closeEditModal();
        }
    });

    // Load user profile data
    async function loadUserProfile() {
        try {
            showLoading(true);
            
            // Get current user ID from stored data or decode from token
            const userId = localStorage.getItem('userID');
            if (!userId) {
                // Try to get user data from login response or redirect to login
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

            // Fetch current user data from API
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
            
            // Fallback to localStorage data
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
            showLoading(false);
        }
    }

    // Display user data in the UI
    function displayUserData(userData) {
        userName.textContent = userData.Username || userData.username;
        userEmail.textContent = userData.Email || userData.email;
        userBadge.textContent = (userData.IsAdmin || userData.isAdmin) ? 'Admin' : 'Student';
        
        if (userData.IsAdmin || userData.isAdmin) {
            userBadge.style.background = 'linear-gradient(135deg, #ff6b6b, #ff8e8e)';
        }

        // Load profile picture if available
        if (userData.ProfilePicID || userData.profilePicID) {
            loadProfilePicture(userData.ProfilePicID || userData.profilePicID);
        }
    }

    // Load profile picture
    async function loadProfilePicture(profilePicID) {
        try {
            const avatarContainer = document.querySelector('.user-avatar');
            const avatarIcon = avatarContainer.querySelector('i');
            
            // Create image element
            const img = document.createElement('img');
            img.src = `/api/images/${profilePicID}`;
            img.alt = 'Profile Picture';
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.borderRadius = '50%';
            img.style.objectFit = 'cover';
            
            img.onload = function() {
                avatarIcon.style.display = 'none';
                avatarContainer.insertBefore(img, avatarIcon);
            };
            
            img.onerror = function() {
                console.error('Failed to load profile picture');
            };
            
        } catch (error) {
            console.error('Error loading profile picture:', error);
        }
    }

    // Initialize progress bars animation
    function initializeProgressBars() {
        const progressBars = document.querySelectorAll('.progress-fill');
        
        // Animate progress bars on load
        setTimeout(() => {
            progressBars.forEach(bar => {
                const progress = bar.getAttribute('data-progress');
                bar.style.width = progress + '%';
            });
        }, 500);
    }

    // Open edit profile modal
    function openEditModal() {
        document.getElementById('editUsername').value = userName.textContent;
        document.getElementById('editEmail').value = userEmail.textContent;
        document.getElementById('editPassword').value = '';
        document.getElementById('editConfirmPassword').value = '';
        
        editProfileModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    // Close edit profile modal
    function closeEditModal() {
        editProfileModal.classList.add('hidden');
        document.body.style.overflow = 'auto';
        clearFormErrors();
    }

    // Handle profile update
    async function handleProfileUpdate(e) {
        e.preventDefault();
        
        const formData = {
            username: document.getElementById('editUsername').value.trim(),
            email: document.getElementById('editEmail').value.trim(),
            password: document.getElementById('editPassword').value,
            confirmPassword: document.getElementById('editConfirmPassword').value
        };

        // Validate form
        if (!validateProfileForm(formData)) {
            return;
        }

        try {
            showLoading(true);
            
            const userId = localStorage.getItem('userID');
            if (!userId) {
                showAlert('error', 'User ID not found. Please log in again.');
                return;
            }

            // Update username if changed
            if (formData.username !== userName.textContent) {
                const usernameResponse = await fetch(`/api/users?id=${userId}&target_field=username`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({ username: formData.username })
                });

                if (!usernameResponse.ok) {
                    throw new Error('Failed to update username');
                }
            }

            // Update email if changed
            if (formData.email !== userEmail.textContent) {
                const emailResponse = await fetch(`/api/users?id=${userId}&target_field=email`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({ email: formData.email })
                });

                if (!emailResponse.ok) {
                    throw new Error('Failed to update email');
                }
            }

            // Update password if provided
            if (formData.password) {
                const passwordResponse = await fetch(`/api/users?id=${userId}&target_field=password`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({ password: formData.password })
                });

                if (!passwordResponse.ok) {
                    throw new Error('Failed to update password');
                }
            }

            // Update localStorage
            localStorage.setItem('username', formData.username);
            localStorage.setItem('userEmail', formData.email);
            
            // Update UI
            userName.textContent = formData.username;
            userEmail.textContent = formData.email;
            
            // Refresh auth button if available
            if (window.refreshAuthButton) {
                window.refreshAuthButton();
            }
            
            closeEditModal();
            showAlert('success', 'Profile updated successfully!');

        } catch (error) {
            console.error('Error updating profile:', error);
            
            // Check if the update endpoints are not implemented yet
            if (error.message.includes('Failed to update')) {
                showAlert('error', 'Profile update feature is not yet implemented on the server.');
            } else {
                showAlert('error', 'Network error. Please try again.');
            }
        } finally {
            showLoading(false);
        }
    }

    // Validate profile form
    function validateProfileForm(data) {
        clearFormErrors();
        let isValid = true;

        // Username validation
        if (data.username.length < 3) {
            showFieldError('editUsername', 'Username must be at least 3 characters');
            isValid = false;
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(data.email)) {
            showFieldError('editEmail', 'Please enter a valid email address');
            isValid = false;
        }

        // Password validation (only if provided)
        if (data.password && data.password.length < 6) {
            showFieldError('editPassword', 'Password must be at least 6 characters');
            isValid = false;
        }

        // Confirm password validation
        if (data.password && data.password !== data.confirmPassword) {
            showFieldError('editConfirmPassword', 'Passwords do not match');
            isValid = false;
        }

        return isValid;
    }

    // Show field error
    function showFieldError(fieldId, message) {
        const field = document.getElementById(fieldId);
        field.style.borderColor = '#ff6b6b';
        
        // Create or update error message
        let errorSpan = field.parentNode.querySelector('.field-error');
        if (!errorSpan) {
            errorSpan = document.createElement('span');
            errorSpan.className = 'field-error';
            errorSpan.style.color = '#ff6b6b';
            errorSpan.style.fontSize = '0.8rem';
            errorSpan.style.marginTop = '4px';
            field.parentNode.appendChild(errorSpan);
        }
        errorSpan.textContent = message;
    }

    // Clear form errors
    function clearFormErrors() {
        const inputs = editProfileForm.querySelectorAll('input');
        inputs.forEach(input => {
            input.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        });
        
        const errorSpans = editProfileForm.querySelectorAll('.field-error');
        errorSpans.forEach(span => span.remove());
    }

    // Handle avatar upload
    async function handleAvatarUpload() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        
        input.onchange = async function(e) {
            const file = e.target.files[0];
            if (file) {
                try {
                    showLoading(true);
                    
                    // Create FormData for file upload
                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('location', 'profile_pictures');
                    
                    const response = await fetch('/api/upload', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${authToken}`
                        },
                        body: formData
                    });
                    
                    if (response.ok) {
                        const result = await response.json();
                        
                        // Update the user's profile picture ID
                        const userId = localStorage.getItem('userID');
                        if (userId && result.fileID) {
                            // Update profile picture ID in user profile
                            const updateResponse = await fetch(`/api/users?id=${userId}&target_field=profile_pic`, {
                                method: 'PUT',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${authToken}`
                                },
                                body: JSON.stringify({ profilePicID: result.fileID })
                            });
                            
                            if (updateResponse.ok) {
                                localStorage.setItem('profilePicID', result.fileID);
                                loadProfilePicture(result.fileID);
                                showAlert('success', 'Profile picture updated successfully!');
                            } else {
                                showAlert('error', 'Failed to update profile picture in user profile');
                            }
                        } else {
                            showAlert('error', 'Upload successful but failed to link to profile');
                        }
                    } else {
                        const errorText = await response.text();
                        showAlert('error', `Upload failed: ${errorText}`);
                    }
                } catch (error) {
                    console.error('Avatar upload error:', error);
                    showAlert('error', 'Failed to upload avatar. Please try again.');
                } finally {
                    showLoading(false);
                }
            }
        };
        
        input.click();
    }

    // Handle logout
    function handleLogout() {
        if (confirm('Are you sure you want to logout?')) {
            // Clear stored data
            localStorage.removeItem('authToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('username');
            localStorage.removeItem('userEmail');
            localStorage.removeItem('isAdmin');
            
            // Redirect to login
            window.location.href = 'login.html';
        }
    }

    // Show/hide loading state
    function showLoading(show) {
        if (show) {
            loading.classList.remove('hidden');
        } else {
            loading.classList.add('hidden');
        }
    }

    // Show alert
    function showAlert(type, message) {
        hideAlerts();
        
        const alert = type === 'error' ? errorAlert : successAlert;
        const messageElement = document.getElementById(type === 'error' ? 'error-message' : 'success-message');
        
        messageElement.textContent = message;
        alert.classList.remove('hidden');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            alert.classList.add('hidden');
        }, 5000);
    }

    // Hide all alerts
    function hideAlerts() {
        errorAlert.classList.add('hidden');
        successAlert.classList.add('hidden');
    }

    // Add click handlers for bookmark cards
    document.querySelectorAll('.bookmark-card .btn-outline').forEach(btn => {
        btn.addEventListener('click', function() {
            const card = this.closest('.bookmark-card');
            const lessonTitle = card.querySelector('h4').textContent;
            showAlert('success', `Continuing "${lessonTitle}"...`);
            // Here you would navigate to the lesson
        });
    });

    // Add click handlers for bookmark toggles
    document.querySelectorAll('.bookmark-card .btn-icon').forEach(btn => {
        btn.addEventListener('click', function() {
            const icon = this.querySelector('i');
            if (icon.classList.contains('fas')) {
                icon.classList.remove('fas');
                icon.classList.add('far');
                showAlert('success', 'Removed from bookmarks');
            } else {
                icon.classList.remove('far');
                icon.classList.add('fas');
                showAlert('success', 'Added to bookmarks');
            }
        });
    });
});