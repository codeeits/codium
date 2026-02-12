document.addEventListener('DOMContentLoaded', () => {

    // --- DOM ELEMENTS ---
    const bookmarksGridContainer = document.getElementById('bookmarks-container');
    const bookmarkTemplate = document.getElementById('bookmarkTemplate');
    const noBookmarksMessage = document.getElementById('noBookmarksAv');

    const filters = {
        all: document.getElementById('all-bookmarks'),
        problem: document.getElementById('problem-bookmarks'),
        lesson: document.getElementById('lesson-bookmarks'),
        sortDropdown: document.getElementById('sort-dropdown'),
    };

    // --- STATE ---
    let userId = null;
    let bookmarksData = [];
    let currentFilter = 'all';
    let currentSort = 'default';

    // --- FETCH DATA ---
    async function fetchBookmarks() {
        try {
            const response = await window.apiService.getBookmarks(userId);
            
            if (!response || response.length === 0) {
                console.log('No bookmarks found for user:', userId);
                noBookmarksMessage.classList.remove('hidden');
                bookmarksData = [];
            } else {
                console.log('Raw Bookmarks:', response);
                noBookmarksMessage.classList.add('hidden');

                const hydratedDataPromises = response.map(async (bookmark) => {
                    try {
                        const fullData = await window.apiService.getLessonById(bookmark.LessonID);
                        return {
                            ...bookmark,
                            lesson: fullData.lesson,
                            flag_translation: fullData.flag_translation,
                            difficulty: fullData.difficulty || 'Unknown' 
                        };
                    } catch (err) {
                        console.error(`Failed to load lesson for bookmark ${bookmark.ID}`, err);
                        return null; 
                    }
                });

                const results = await Promise.all(hydratedDataPromises);
                bookmarksData = results.filter(item => item !== null);

                renderBookmarks();
            }
        } catch (error) {
            console.error('Error fetching bookmarks:', error);
        }
    }

    // --- RENDER BOOKMARKS ---
    function renderBookmarks() { // No longer needs to be async
        bookmarksGridContainer.innerHTML = '';

        let processedData = [...bookmarksData];

        // 2. SORT
        processedData.sort((a, b) => {
            // Safety check
            const titleA = a.lesson?.Title || "";
            const titleB = b.lesson?.Title || "";

            switch (currentSort) {
                case 'Alfabetic':
                    return titleA.localeCompare(titleB);
                
                case 'Cele mai noi':
                    return new Date(b.lesson.CreatedAt.Time) - new Date(a.lesson.CreatedAt.Time); 

                case 'Cele mai vechi':
                    return new Date(a.lesson.CreatedAt.Time) - new Date(b.lesson.CreatedAt.Time);

                case 'Dificultate':
                    const map = { 'Easy': 1, 'Medium': 2, 'Hard': 3 };
                    const valA = map[a.difficulty] || 0;
                    const valB = map[b.difficulty] || 0;
                    return valA - valB;

                default:
                    return 0;
            }
        });

        if (processedData.length === 0) {
            noBookmarksMessage.classList.remove('hidden');
            bookmarksGridContainer.appendChild(noBookmarksMessage);
            return;
        } else {
            noBookmarksMessage.classList.add('hidden');
        }

        processedData.forEach(bookmarkedElementData => {
            const bookmarkCard = bookmarkTemplate.cloneNode(true);
            bookmarkCard.id = `bookmark-${bookmarkedElementData.ID}`;
            bookmarkCard.classList.remove('hidden');

            const title = bookmarkCard.querySelector('.content-card-title');
            if (title) title.textContent = bookmarkedElementData.lesson.Title;

            const badge = bookmarkCard.querySelector('.bookmarks-class-badge');
            if (badge) badge.textContent = `${bookmarkedElementData.flag_translation?.class || '?'} / nada de momento`; 

            const icon = bookmarkCard.querySelector('.bookmark-icon');
            if (icon) {
                icon.style.cursor = 'pointer';
                icon.addEventListener('click', (event) => handleBookmarkClick(event, bookmarkedElementData.lesson.ID));
            }

            bookmarkCard.addEventListener('click', () => {
                window.location.href = `/app/lectii/lessonindiv.html?id=${bookmarkedElementData.lesson.ID}`;
            });

            bookmarksGridContainer.appendChild(bookmarkCard);
        });
    }

    // --- ACTIONS ---
    async function handleBookmarkClick(event, lessonId) {
        event.preventDefault();
        event.stopPropagation();

        const card = event.currentTarget.closest('.content-card');
        
        try {
            await window.apiService.modifyBookmark(lessonId);
            
            card.remove();
            
            bookmarksData = bookmarksData.filter(b => b.lesson.ID !== lessonId);

            if (bookmarksGridContainer.children.length === 0) {
                noBookmarksMessage.classList.remove('hidden');
                bookmarksGridContainer.appendChild(noBookmarksMessage);
            }
        } catch (error) {
            console.error('Error removing bookmark:', error);
        }
    }

    function initDropdown() {
        const dropdown = filters.sortDropdown;
        if (!dropdown) return;

        const toggleBtn = dropdown.querySelector('.dropdown-toggle');
        const items = dropdown.querySelectorAll('.dropdown-item');

        toggleBtn.onclick = null;

        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            dropdown.classList.toggle('open');
        });

        items.forEach(item => {
            item.addEventListener('click', () => {
                const selectedText = item.textContent.trim();
                
                currentSort = selectedText; 

                toggleBtn.innerHTML = `${selectedText} <i class="fa-solid fa-chevron-down"></i>`;

                items.forEach(i => i.classList.remove('active'));
                item.classList.add('active');

                dropdown.classList.remove('open');
                renderBookmarks();
            });
        });

        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove('open');
            }
        });
    }

    // --- INIT ---
    async function initApp() {
        window.apiService.isAuthenticated(true);
        try {
            const currentUser = await window.apiService.getCurrentUser();
            const userData = typeof currentUser === 'string' ? JSON.parse(currentUser) : currentUser;
            userId = userData.ID;
            
            initDropdown();
            await fetchBookmarks();

        } catch (err) {
            console.error('Failed to get current user:', err);
            window.apiService.logout(false);
        }
    }

    initApp();
});