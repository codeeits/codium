document.addEventListener('DOMContentLoaded', () => {

    // --- DOM ELEMENTS ---
    const bookmarksGridContainer = document.getElementById('bookmarks-container');
    const bookmarkTemplate = document.getElementById('bookmarkTemplate');
    const noBookmarksMessage = document.getElementById('noBookmarksAv');

    const filters = {
        all: document.getElementById('all-bookmarks'),
        problem: document.getElementById('problem-bookmarks'),
        lesson: document.getElementById('lesson-bookmarks')
    };

    // --- STATE ---
    let userId = null;
    let bookmarksData = [];
    let currentFilter = 'all';

    // --- FETCH DATA ---
    async function fetchBookmarks() {
        try {
            const response = await window.apiService.getBookmarks(userId);
            if (response) {
                if (response.length === 0) {
                    console.log('No bookmarks found for user:', userId);
                    noBookmarksMessage.classList.remove('hidden');
                } else {
                    console.log('Bookmarks for user:', userId, response);
                    noBookmarksMessage.classList.add('hidden');
                    bookmarksData = response;
                    renderBookmarks();
                }
            }
        } catch (error) {
            console.error('Error fetching bookmarks:', error);
        }
    }

    // --- RENDER BOOKMARKS ---
    async function renderBookmarks() {
        bookmarksGridContainer.innerHTML = '';

        const processedData = bookmarksData; 

        if (processedData.length === 0) {
            noBookmarksMessage.classList.remove('hidden');
            bookmarksGridContainer.appendChild(noBookmarksMessage);
            return;
        } else {
            noBookmarksMessage.classList.add('hidden');
        }

        for (const bookmarkElement of processedData) {
            const bookmarkCard = bookmarkTemplate.cloneNode(true);
            bookmarkCard.id = `bookmark-${bookmarkElement.ID}`;
            bookmarkCard.classList.remove('hidden');

            try {
                const bookmarkedElementData = await window.apiService.getLessonById(bookmarkElement.LessonID);
                console.log('Bookmarked element data:', bookmarkedElementData);

                const title = bookmarkCard.querySelector('.content-card-title');
                if (title) title.textContent = bookmarkedElementData.lesson.Title;

                const badge = bookmarkCard.querySelector('.bookmarks-class-badge');
                if (badge) badge.textContent = `${bookmarkedElementData.flag_translation.class} / nada de momento`; 

                const icon = bookmarkCard.querySelector('.bookmark-icon');
                if (icon) icon.addEventListener('click', (event) => handleBookmarkClick(event, bookmarkedElementData.lesson.ID));
                if (icon) icon.style.cursor = 'pointer';

                bookmarkCard.addEventListener('click', () => {
                    window.location.href = `/app/lectii/lessonindiv.html?id=${bookmarkedElementData.lesson.ID}`;
                });

                bookmarksGridContainer.appendChild(bookmarkCard);
            } catch (err) {
                console.error(`Error fetching details for bookmark ${bookmarkElement.ID}`, err);
            }
        }
    }

    // --- ACTIONS ---
    async function handleBookmarkClick(event, lessonId) {

        event.preventDefault();
        event.stopPropagation();
        
        const card = event.currentTarget.closest('.content-card');
        const bookmarkId = card.id.replace('bookmark-', '');
        
        console.log('Bookmark clicked:', bookmarkId);
        
        try {
            const rawId = lessonId;
            
            await window.apiService.modifyBookmark(rawId);
            document.getElementById(card.id).remove();
            if (bookmarksGridContainer.children.length === 0) {
                noBookmarksMessage.classList.remove('hidden');
                bookmarksGridContainer.appendChild(noBookmarksMessage);
            }
        } catch (error) {
            console.error('Error removing bookmark:', error);
        }
    }

    // --- FILTER BUTTONS LOGIC ---
    function initFilters() {
        const filterButtons = [filters.all, filters.problem, filters.lesson];

        filterButtons.forEach(btn => {
            if(!btn) return;
            
            btn.addEventListener('click', (e) => {
                // Update State
                if (btn === filters.all) currentFilter = 'all';
                else if (btn === filters.problem) currentFilter = 'problem';
                else if (btn === filters.lesson) currentFilter = 'lesson';

                // Update UI Styles
                filterButtons.forEach(b => {
                    if (b) {
                        b.classList.remove('primary', 'active');
                        b.classList.add('secondary');
                    }
                });
                btn.classList.remove('secondary');
                btn.classList.add('primary', 'active');

                // Re-render
                renderBookmarks();
            });
        });
    }

    // --- INITIALIZATION ---
    async function initApp() {
        // 1. Auth Check
        window.apiService.isAuthenticated(true);
        
        try {
            const currentUser = await window.apiService.getCurrentUser();
            const userData = typeof currentUser === 'string' ? JSON.parse(currentUser) : currentUser;
            userId = userData.ID;
            
            // 2. Init UI & Data
            initFilters();
            await fetchBookmarks();

        } catch (err) {
            console.error('Failed to get current user:', err);
            window.apiService.logout(false);
        }
    }

    initApp();
});