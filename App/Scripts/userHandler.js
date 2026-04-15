/*
 __  __  ___  ____  ____  _   _    __    _  _  ____  __    ____  ____     ____  ___ 
(  )(  )/ __)( ___)(  _ \( )_( )  /__\  ( \( )(  _ \(  )  ( ___)(  _ \   (_  _)/ __)
 )(__)( \__ \ )__)  )   / ) _ (  /(__)\  )  (  )(_) ))(__  )__)  )   /  .-_)(  \__ \
(______)(___/(____)(_)\_)(_) (_)(__)(__)(_)\_)(____/(____)(____)(_)\_)()\____) (___/

We aint talkin about user.js
*/

document.addEventListener('DOMContentLoaded', async function() {

    let userId = null;

    function makeElementKeyboardActivatable(element, onActivate, role = 'link') {
        if (!element || typeof onActivate !== 'function') {
            return;
        }

        element.setAttribute('tabindex', '0');
        element.setAttribute('role', role);
        element.style.cursor = 'pointer';

        element.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
                event.preventDefault();
                onActivate(event);
            }
        });

        element.addEventListener('click', onActivate);
    }

    // DOM elements

    const userName = document.getElementById('userName');
    const userEmail = document.getElementById('userEmail');
    const avatarImg = document.getElementById('userAvatar');
    const logoutBtn = document.getElementById('logoutBtn');
    const editBtn = document.getElementById('editProfileBtn');
    const addLessonBtn = document.getElementById('addLesson') || document.createElement('div'); // Fallback to avoid errors

    // ------------------------------
    // CHECK AUTHENTICATION
    // ------------------------------

    window.apiService.isAuthenticated(true);
    
    const currentUser = await window.apiService.getCurrentUser() .catch(err => {
        console.error('Failed to get current user:', err);
        window.apiService.logout(false);
    });
    const userData = typeof currentUser === 'string' ? JSON.parse(currentUser) : currentUser;
    userId = userData.ID;
    console.log('Current User ID:', userId);

    // ------------------------------
    // LOGOUT FUNCTIONALITY
    // ------------------------------

    logoutBtn.addEventListener('click', function() {
        window.apiService.logout(true);
    });

    // ------------------------------
    // ADD LESSON BUTTON
    // ------------------------------

    addLessonBtn.addEventListener('click', function() {
        window.apiService.getCurrentUser().then(userData => {
            if (userData.IsAdmin) {
                window.location.href = 'lesson-upload.html';
            } else {
                alert('Only admins can add lessons.');
            }
        }).catch(error => {
            console.error('Failed to get user data:', error);
            alert('An error occurred while checking permissions.');
        });
    });
    
    // ------------------------------
    // Randare USER ELEMENTS
    // ------------------------------

    async function loadUserProfile() {
        
        try {
            let userData = await window.apiService.getCurrentUser();
            console.log(userData);
            // display the data
            console.log(userData.Username);
            userName.textContent = userData.Username;
            userEmail.textContent = userData.Email;
            if (userData.ProfilePicID) {
                const imgUrl = await window.apiService.getFileUrl(userData.ProfilePicID);
                avatarImg.src = imgUrl;
            } else {
                avatarImg.style.display = 'none';
            }

        } catch (error) {
            console.warn('API call failed');
            window.handleApiError(error, 'Failed to load user profile.');
        }
    
    }

    loadUserProfile();

    // ------------------------------
    // EDIT MODAL
    // ------------------------------

    const modal = document.getElementById('editProfileModal');
    const submitButton = document.getElementById('saveEditBtn');

    modal.style.display = 'none';

    // handles modal show/hide stuff

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
        initializeForm();
        deleteTextContainer();
        
        cancelBtn.onclick = function() {
            closeModal();
        };

        modal.onclick = function(e) {
            if (e.target === modal) {
                closeModal();
            }
        };
    });

    // function to validate modal form

    const form = document.getElementById('editProfileForm');

    function initializeForm() {
        document.getElementById('editEmail').value = localStorage.getItem('userEmail') || '';
        document.getElementById('editUsername').value = localStorage.getItem('username') || '';
    }

    function deleteTextContainer() {
        document.querySelectorAll('.delete-text-btn').forEach(button => {
            button.addEventListener('click', function() {
                const inputField = this.parentElement.querySelector('input');
                if (inputField) {
                    inputField.value = '';
                }
            });
        });
    }

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
    // BOOKMARKS STUFF
    // ------------------------------

    const bookmarksContainer = document.getElementById('bookmarksContainer');
    const bookmarkTemplate = document.getElementById('bookmarkTemplate');

    let bookmarks = [];

    bookmarks = await window.apiService.getBookmarks(userId);

    if (bookmarks.length === 0) {
        bookmarksContainer.innerHTML = '<p>No bookmarks yet.</p>';
    } else {
        bookmarksContainer.innerHTML = '';
        for(const bookmarkEle of bookmarks) {
            const lessonData = await window.apiService.getLessonById(bookmarkEle.LessonID);
            const bookmarkClone = bookmarkTemplate.cloneNode(true);
            bookmarkClone.style.display = 'flex';
            bookmarkClone.id = `bookmark-${lessonData.lesson.ID}`;
            bookmarkClone.querySelector('h3').textContent = lessonData.lesson.Title;
            bookmarkClone.querySelector('.Module').textContent = ` ${lessonData.flag_translation.module}`;
            bookmarkClone.querySelector('.Class').textContent = ` ${lessonData.flag_translation.class}`;
            bookmarkClone.querySelector('.Section').textContent = ` ${lessonData.flag_translation.section}`;
            const openBookmarkLesson = function() {
                window.location.href = `/app/Lectii/lesson.html?id=${lessonData.lesson.ID}`;
            };
            makeElementKeyboardActivatable(bookmarkClone, openBookmarkLesson, 'link');
            bookmarksContainer.appendChild(bookmarkClone);
            console.log('Lesson data for bookmark:', lessonData);
        }
    }

    // ------------------------------
    // RECENT ACTIVITY
    // ------------------------------

    const recentContainer = document.getElementById('recentActivityContainer');
    const recentTemplate = document.getElementById('activityTemplate');

    let recentActivities = [];

    recentActivities = await window.apiService.getInteractions(userId, 6);

    if (recentActivities.length === 0) {
        recentContainer.innerHTML = '<p>No recent activity.</p>';
    } else {
        recentContainer.innerHTML = '';

        for(const activity of recentActivities) {

            const lessonData = await window.apiService.getLessonById(activity.LessonID);
            const activityClone = recentTemplate.cloneNode(true);
            activityClone.style.display = 'flex';
            activityClone.id = `activity-${activity.ID}`;

            console.log(activity.CompletedAt.Valid);
            if(activity.Favorited && activity.UpdatedAt.Time > activity.StartedAt.Time){
                // here for lessons that have been favorited (and obviously started aswell)
                activityClone.querySelector('.activity-type-of').setAttribute('data-i18n', 'activity.favourite');
                activityClone.querySelector('.activity-lesson').innerHTML = ` ${lessonData.lesson.Title}`;
                activityClone.querySelector('.activity-circle').classList.add('favorite');
                activityClone.querySelector('.fa-solid').classList.add('fa-heart');
            } else if (activity.CompletedAt.Valid) {
                // here for lessons that have StartedAt and CompletedAt
                activityClone.querySelector('.activity-type-of').setAttribute('data-i18n', 'activity.completed');
                activityClone.querySelector('.activity-lesson').innerHTML = ` ${lessonData.lesson.Title}`;
                activityClone.querySelector('.activity-circle').classList.add('positive');
                activityClone.querySelector('.fa-solid').classList.add('fa-check');
            } else {
                activityClone.querySelector('.activity-type-of').setAttribute('data-i18n', 'activity.started');
                activityClone.querySelector('.activity-lesson').innerHTML = ` ${lessonData.lesson.Title}`;
                activityClone.querySelector('.activity-circle').classList.add('warning');
                activityClone.querySelector('.fa-solid').classList.add('fa-hourglass-half');
            }

            const date = new Date(activity.UpdatedAt.Time);
            console.log('Activity date:', date);
            activityClone.querySelector('.clasaLectiei').innerHTML = ` ${lessonData.flag_translation.class}`;
            activityClone.querySelector('.completedAtTime').textContent = date.toLocaleString('ro-RO', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            const openRecentLesson = function() {
                window.location.href = `/app/Lectii/lesson.html?id=${lessonData.lesson.ID}`;
            };
            makeElementKeyboardActivatable(activityClone, openRecentLesson, 'link');
            recentContainer.appendChild(activityClone);
            applyTranslationsToElement(activityClone);

            console.log('Lesson data for recent activity:', lessonData);

        }

    }

});