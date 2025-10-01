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
            
            // Mock user data for now - replace with actual API call
            const userData = {
                username: localStorage.getItem('username') || 'John Doe',
                email: localStorage.getItem('userEmail') || 'john.doe@example.com',
                isAdmin: localStorage.getItem('isAdmin') === 'true'
            };

            userName.textContent = userData.username;
            userEmail.textContent = userData.email;
            userBadge.textContent = userData.isAdmin ? 'Admin' : 'Student';
            
            if (userData.isAdmin) {
                userBadge.style.background = 'linear-gradient(135deg, #ff6b6b, #ff8e8e)';
            }

        } catch (error) {
            console.error('Error loading user profile:', error);
            showAlert('error', 'Failed to load user profile');
        } finally {
            showLoading(false);
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
            
            // Prepare update data (only include password if provided)
            const updateData = {
                username: formData.username,
                email: formData.email
            };
            
            if (formData.password) {
                updateData.password = formData.password;
            }

            // Mock API call - replace with actual endpoint
            const response = await fetch('/api/update_profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify(updateData)
            });

            if (response.ok) {
                // Update localStorage
                localStorage.setItem('username', formData.username);
                localStorage.setItem('userEmail', formData.email);
                
                // Update UI
                userName.textContent = formData.username;
                userEmail.textContent = formData.email;
                
                closeEditModal();
                showAlert('success', 'Profile updated successfully!');
            } else {
                const errorData = await response.json().catch(() => ({}));
                showAlert('error', errorData.message || 'Failed to update profile');
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            showAlert('error', 'Network error. Please try again.');
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
    function handleAvatarUpload() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        
        input.onchange = function(e) {
            const file = e.target.files[0];
            if (file) {
                // Here you would upload the file to your server
                showAlert('success', 'Avatar upload feature coming soon!');
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