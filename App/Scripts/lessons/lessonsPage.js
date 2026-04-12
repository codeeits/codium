document.addEventListener('DOMContentLoaded', () => {

    const debugMode = true;

    // --- DOM ELEMENTS ---
    const filters = {
        class: document.getElementById('class-filters'),
        sortDropdown: document.getElementById('sort-dropdown'),
    };
    const lessonsContainer = document.getElementById('lessons-container');
    const templateCard = document.getElementById('template-card');

    // --- STATE ---
    let lessonsData = [];
    let currentFilters = {
        class: 'all',
        sortBy: 'Alfabetic'
    };

    // --- FETCH DATA ---
    async function fetchLessons(classFilter = null) {
        try {
            const response = await window.apiService.lessons.getLessonsByFlags(classFilter);
            if (response) {
                lessonsData = response;
            }
        } catch (error) {
            console.error('Error fetching lessons:', error);
            if (debugMode) {
                lessonsData = [
                    { id: 1, lesson: { ID: 101, Title: "Intro C++", Description: { String: "Basics" }, imageUrl: "" }, flag_translation: { class: "9" }, difficulty: "Easy" },
                    { id: 2, lesson: { ID: 102, Title: "Arrays", Description: { String: "Lists" }, imageUrl: "" }, flag_translation: { class: "10" }, difficulty: "Medium" },
                    { id: 3, lesson: { ID: 103, Title: "Z-Index Guide", Description: { String: "CSS Styles" }, imageUrl: "" }, flag_translation: { class: "10" }, difficulty: "Hard" }
                ];
            }
        }
    }

    // --- RENDER LESSONS ---
    function renderLessons() {
        // Clear current items
        const cards = lessonsContainer.querySelectorAll('.content-card:not(#template-card)');
        cards.forEach(card => card.remove());

        // 1. FILTER
        let processedData = lessonsData.filter(item => {
            if (currentFilters.class === 'all') return true;
            const itemClass = String(item.flag_translation?.class ?? '');
            return itemClass === String(currentFilters.class);
        });

        // 2. SORT
        processedData.sort((a, b) => {
            // Safety check in case Title is missing
            const titleA = a.lesson?.Title || "";
            const titleB = b.lesson?.Title || "";

            switch (currentFilters.sortBy) {
                case 'Alfabetic':
                    return titleA.localeCompare(titleB);
                
                case 'Cele mai noi':
                    return new Date(b.lesson.CreatedAt.Time) - new Date(a.lesson.CreatedAt.Time); 

                case 'Cele mai vechi':
                    return new Date(a.lesson.CreatedAt.Time) - new Date(b.lesson.CreatedAt.Time);

                case 'Dificultate':
                    // chestia asta nu face nimic momentan, dar daca o sa avem dificultate in baza de date putem sorta dupa ea
                    const map = { 'Easy': 1, 'Medium': 2, 'Hard': 3 };
                    const valA = map[a.difficulty] || 0;
                    const valB = map[b.difficulty] || 0;
                    return valA - valB;

                default:
                    return 0;
            }
        });

        if (processedData.length === 0) return;

        // 3. RENDER
        processedData.forEach(lesson => {
            const card = templateCard.cloneNode(true);
            card.id = `lesson-${lesson.lesson.ID}`;
            card.classList.remove('hidden');
            
            const img = card.querySelector('.content-card-image');
            const seed = encodeURIComponent(lesson.lesson.ID || 'codium');

            const patternUrl = window.apiService.getPatternUrl(seed, "shapes"); // "Glass" is just a pattern type, can be changed to others if needed

            if (img) img.src = patternUrl;

            const badge = card.querySelector('.lesson-class-badge');
            if (badge){
                badge.textContent = `Clasa ${lesson.flag_translation.class}`;
                badge.dataset.i18n = `classe.${lesson.flag_translation.class}`;
            }
            
            const title = card.querySelector('.content-card-title');
            if (title) title.textContent = lesson.lesson.Title;
            
            const desc = card.querySelector('.content-card-description');
            if (desc) desc.textContent = lesson.lesson.Description.String;

            // Optional difficulty text update
            const diffText = card.querySelector('.difficulty-text');
            if(diffText && lesson.difficulty){
                diffText.textContent = lesson.difficulty;
                diffText.dataset.i18n = `difficulty.${lesson.difficulty.toLowerCase()}`;
            }

            card.addEventListener('click', () => {
                window.location.href = `/app/Lectii/lessonindiv.html?id=${lesson.lesson.ID}`;
            });

            lessonsContainer.appendChild(card);
        });
    }

    // --- HELPER: GET CLASSES ---
    function getAvailableClasses() {
        const classes = new Set();
        lessonsData.forEach(lesson => {
            if (lesson.flag_translation && lesson.flag_translation.class) {
                classes.add(String(lesson.flag_translation.class));
            }
        });
        return Array.from(classes).sort((a, b) => parseInt(a) - parseInt(b));
    }

    // --- FILTER BUTTONS LOGIC ---
    function populateClassFilters() {
        const templateBtn = filters.class.querySelector('.template');
        if (!templateBtn) return;

        // Clear container
        filters.class.innerHTML = '';

        const classes = getAvailableClasses();

        // 1. Create "TOATE" Button
        const allBtn = templateBtn.cloneNode(true);
        allBtn.classList.remove('template', 'hidden');
        allBtn.id = ""; // Remove ID to avoid duplicates
        allBtn.textContent = "Toate";
        allBtn.dataset.class = "all";
        
        applyBtnStyle(allBtn, currentFilters.class === 'all');
        
        allBtn.addEventListener('click', () => {
            currentFilters.class = 'all';
            updateAllButtonStyles();
            renderLessons();
        });
        filters.class.appendChild(allBtn);

        // 2. Create CLASS Buttons
        classes.forEach(cls => {
            const btn = templateBtn.cloneNode(true);
            btn.classList.remove('template', 'hidden');
            btn.id = ""; 
            btn.textContent = `Clasa a ${cls}`;
            if (parseInt(cls) == 67) {
                btn.dataset.i18n = 'classe.67';
            } else if (parseInt(cls) > 12) {
                btn.dataset.i18n = ''; // no set
                btn.textContent = `Clasa ${cls}`;
            } else {
                btn.dataset.i18n = `classe.${cls}`; // For translation
            }
            btn.dataset.class = String(cls);
            
            applyBtnStyle(btn, currentFilters.class === cls);

            btn.addEventListener('click', () => {
                currentFilters.class = cls;
                updateAllButtonStyles();
                renderLessons();
            });
            filters.class.appendChild(btn);
        });
    }

    // Helper to style a single button
    function applyBtnStyle(btn, isActive) {
        if (isActive) {
            btn.classList.add('primary', 'active');
            btn.classList.remove('secondary');
        } else {
            btn.classList.add('secondary');
            btn.classList.remove('primary', 'active');
        }
    }

    function updateAllButtonStyles() {
        const buttons = filters.class.querySelectorAll('button');
        buttons.forEach(btn => {
            const isTarget = btn.dataset.class === currentFilters.class;
            applyBtnStyle(btn, isTarget);
        });
    }

    // --- DROPDOWN LOGIC ---
    function initDropdown() {
        const dropdown = filters.sortDropdown;
        if (!dropdown) return;

        const toggleBtn = dropdown.querySelector('.dropdown-toggle');
        const items = dropdown.querySelectorAll('.dropdown-item');

        toggleBtn.onclick = null;

        // Toggle Open/Close
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            dropdown.classList.toggle('open');
        });

        items.forEach(item => {
            item.addEventListener('click', () => {
                const selectedText = item.textContent.trim();
                currentFilters.sortBy = selectedText;

                toggleBtn.innerHTML = `${selectedText} <i class="fa-solid fa-chevron-down"></i>`;

                items.forEach(i => i.classList.remove('active'));
                item.classList.add('active');

                dropdown.classList.remove('open');
                renderLessons();
            });
        });

        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove('open');
            }
        });
    }

    // --- INITIALIZATION ---
    async function initApp() {
        initDropdown(); 
        await fetchLessons();
        populateClassFilters();
        renderLessons();
    }

    initApp();
});