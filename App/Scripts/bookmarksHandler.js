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
    let debugMode = true; // Set to true to enable console logs for debugging
    let bookmarksData = [];
    let currentFilter = 'all';
    let currentSort = 'default';

    // --- FETCH DATA ---
    async function fetchBookmarks() {
        try {
            const [lessonResult, problemResult] = await Promise.allSettled([
                window.apiService.getBookmarks(userId),
                window.apiService.getBookmarkedProblems(userId)
            ])

            const rawLessons = lessonResult.status === 'fulfilled' ? lessonResult.value : [];
            const rawProblems = problemResult.status === 'fulfilled' ? problemResult.value : [];

            if (debugMode) {
                console.log('Fetched Bookmarks - Lessons:', rawLessons);
                console.log('Fetched Bookmarks - Problems:', rawProblems);
            }

            const uniqueMap = new Map();

            [...rawLessons, ...rawProblems].forEach(bookmark => {
                if (bookmark.LessonID && bookmark.LessonID !== 0) {
                    uniqueMap.set(`lesson-${bookmark.LessonID}`, bookmark);
                } else if (bookmark.ProblemID && bookmark.ProblemID !== 0) {
                    uniqueMap.set(`problem-${bookmark.ProblemID}`, bookmark);
                }
            });

            const uniqueRaw = Array.from(uniqueMap.values());

            if(uniqueRaw.length === 0) {
                if (debugMode) console.log('No bookmarks found for user:', userId);
                bookmarksData = [];
                noBookmarksMessage.classList.remove('hidden');
                return;
            }

            noBookmarksMessage.classList.add('hidden');
            const promises = uniqueRaw.map(async (bookmark) => {
                try {
                    // case 1: lesson bookmark
                    if (bookmark.LessonID && bookmark.LessonID !== 0) {
                        const fullData = await window.apiService.getLessonById(bookmark.LessonID);
                        return {
                            ...bookmark,
                            lesson: fullData.lesson,
                            flag_translation: fullData.flag_translation,
                            difficulty: fullData.difficulty || 'Unknown',
                            type: 'lesson'
                        };
                    }

                    // case 2: problem bookmark
                    else if (bookmark.ProblemID && bookmark.ProblemID !== 0) {
                        const fullData = await window.apiService.getProblemById(bookmark.ProblemID);
                        return {
                            ...bookmark,
                            problem: fullData.problem,
                            flag_translation: fullData.tag_translation,
                            difficulty: fullData.difficulty || 'Unknown',
                            type: 'problem'
                        };
                    }
                    
                    return null;
                } catch (err) {
                    console.error(`Failed to load lesson for bookmark ${bookmark.ID}`, err);
                    return null; 
                }
            });

            const results = await Promise.all(promises);
            bookmarksData = results.filter(item => item !== null);
            renderBookmarks();

        } catch (error) {
            console.error('Error fetching bookmarks:', error);
        }
    }

    // --- RENDER BOOKMARKS ---
    function renderBookmarks() { // No longer needs to be async
        bookmarksGridContainer.innerHTML = '';

        let processedData = [...bookmarksData];

        // 1. FILTER
        if (currentFilter === 'problem') {
            processedData = processedData.filter(b => b.type === 'problem');
        } else if (currentFilter === 'lesson') {
            processedData = processedData.filter(b => b.type === 'lesson');
        }

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
            bookmarkCard.id = `bookmark-${bookmarkedElementData.ID}-${bookmarkedElementData.type}`;
            bookmarkCard.classList.remove('hidden');

            const title = bookmarkCard.querySelector('.content-card-title');
            if (title) title.textContent = bookmarkedElementData.lesson?.Title || bookmarkedElementData.problem?.Title || 'Untitled';

            const description = bookmarkCard.querySelector('.content-card-description');
            if (description) description.textContent = bookmarkedElementData.lesson?.Description.String || bookmarkedElementData.problem?.Description || 'No description available.';

            const badge = bookmarkCard.querySelector('.bookmarks-class-badge');
            if (badge) badge.textContent = `${bookmarkedElementData.flag_translation?.class || bookmarkedElementData.flag_translation?.verification_type || 'Unknown'} / nada de momento`; 

            const icon = bookmarkCard.querySelector('.bookmark-icon');
            if (icon) {
                icon.style.cursor = 'pointer';
                icon.addEventListener('click', (event) => handleBookmarkClick(event, bookmarkedElementData.lesson?.ID || bookmarkedElementData.problem?.ID, bookmarkedElementData.type));
            }

            bookmarkCard.addEventListener('click', () => {
                if (bookmarkedElementData.type === 'lesson') {
                    window.location.href = `/app/lectii/lessonindiv.html?id=${bookmarkedElementData.lesson.ID}`;
                } else if (bookmarkedElementData.type === 'problem') {
                    window.location.href = `/app/probleme/problem2.html?id=${bookmarkedElementData.problem.ID}`;
                }
            });

            bookmarksGridContainer.appendChild(bookmarkCard);
        });
    }

    // --- ACTIONS ---
    async function handleBookmarkClick(event, typeId, type = 'lesson') {
        event.preventDefault();
        event.stopPropagation();

        const card = event.currentTarget.closest('.content-card');
        
        try {
            
            if (type === 'lesson') {
                await window.apiService.modifyBookmark(typeId);
            } else if (type === 'problem') {
                await window.apiService.modifyBookmarkProblem(typeId);
            }
            
            card.remove();
            
            bookmarksData = bookmarksData.filter(b => b.lesson?.ID !== typeId && b.problem?.ID !== typeId);

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

    // --- FILTER BUTTONS LOGIC ---
    function initFilterButtons() {
        const filterKeys = ['all', 'problem', 'lesson'];

        filterKeys.forEach(key => {
            const element = filters[key];
            if (!element) return;

            const btn = element.tagName === 'BUTTON' ? element : element.querySelector('button');

            if (!btn) {
                console.warn(`No button found for filter: ${key}`);
                return;
            }

            btn.addEventListener('click', (e) => {
                e.preventDefault();
                currentFilter = key; 
                updateAllButtonStyles();
                renderBookmarks();
            });
        });

        updateAllButtonStyles();
    }

    function updateAllButtonStyles() {
        const filterKeys = ['all', 'problem', 'lesson'];

        filterKeys.forEach(key => {
            const element = filters[key];
            if (!element) return;

            const btn = element.tagName === 'BUTTON' ? element : element.querySelector('button');
            if (!btn) return;

            const isActive = (currentFilter === key);
            applyBtnStyle(btn, isActive);
        });
    }

    // Helper: Apply Button Styling
    function applyBtnStyle(btn, isActive) {
        if (isActive) {
            btn.classList.add('primary', 'active');
            btn.classList.remove('secondary');
        } else {
            btn.classList.add('secondary');
            btn.classList.remove('primary', 'active');
        }
    }

    // --- INIT ---
    async function initApp() {
        window.apiService.isAuthenticated(true);
        try {
            const currentUser = await window.apiService.getCurrentUser();
            const userData = typeof currentUser === 'string' ? JSON.parse(currentUser) : currentUser;
            userId = userData.ID;
            
            initDropdown();
            initFilterButtons();
            await fetchBookmarks();

        } catch (err) {
            console.error('Failed to get current user:', err);
            window.apiService.logout(false);
        }
    }

    initApp();
});