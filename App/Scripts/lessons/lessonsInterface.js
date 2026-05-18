/*
 __    ____  ___  ___  _____  _  _  ___  ____  _  _  ____  ____  ____  ____  __    ___  ____     ____  ___ 
(  )  ( ___)/ __)/ __)(  _  )( \( )/ __)(_  _)( \( )(_  _)( ___)(  _ \( ___)/__\  / __)( ___)   (_  _)/ __)
 )(__  )__) \__ \\__ \ )(_)(  )  ( \__ \ _)(_  )  (   )(   )__)  )   / )__)/(__)\( (__  )__)   .-_)(  \__ \
(____)(____)(___/(___/(_____)(_)\_)(___/(____)(_)\_) (__) (____)(_)\_)(__)(__)(__)\___)(____)()\____) (___/

Pentru randarea lectiilor cu marked.js. 
Pentru highlight, highlight.js; MathJax pentru formule matematice iar Mermaid pentru diagrame.

Phoenix - Mugur de Fluier
*/
import { renderExternalLibraries, tomarkdown } from '../markdownRenderer.js';
import { triggerConfetti } from '/app/Scripts/animations/confetti.js';
import { 
    applyStaggeredAnimation, 
    cascadeEntrance,
    getCSSVar,
    prefersReducedMotion
} from '/app/Scripts/animations/animationUtils.js';
import * as AlgoVis from '/app/Scripts/AlgoVis/'

function toRoman(n) {
    if (n === 0) return "All";
    if (n >= 67) return "N/A"; // Neclasificat
    
    const values = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
    const symbols = ["M", "CM", "D", "CD", "C", "XC", "L", "XL", "X", "IX", "V", "IV", "I"];
    
    let result = "";
    for (let i = 0; i < values.length; i++) {
        while (n >= values[i]) {
            result += symbols[i];
            n -= values[i];
        }
    }
    return result;
}

// 2 down 1 up
document.addEventListener("DOMContentLoaded", async () => {

    const debugMode = false; // SET THIS TO ENABLE LOGS!
    const baseurl = window.location.href;
    let isAuthenticated = false;

    document.body.classList.add('is-loading');

    // --- DOM ELEMENTS ---
    const elements = {
        progressBar: document.getElementById('reading-progress-bar'),
        title: document.getElementById("lesson-title"),
        container: document.getElementById("lesson-body"),
        auth: document.getElementById("author-name"),
        date: document.getElementById("lesson-date"),
        favoritesCount: document.getElementById("lesson-likes"),
        classInfo: document.getElementById("lesson-class"),
        sectionInfo: document.getElementById("lesson-section"),
        moduleInfo: document.getElementById("lesson-module"),
        sidebar: document.getElementById("lesson-sidebar") || document.getElementById("lectii-sectiune"),
        sidebarTitle: document.getElementById("lesson-sidebar_title") || document.getElementById("lectii-sesiune-clasa"),
        cuprinsCard: document.getElementById("cuprins-card"),
        keypointsCard: document.getElementById("keypoints-card"),
        // Header Buttons
        headerIconsContainer: document.querySelector(".header-icons"),
        bookmarkBtn: document.getElementById("bookmarkButton"),
        favoriteBtn: document.getElementById("favoriteButton"),
        shareBtn: document.getElementById("shareButton"),
        prevBtn: document.getElementById("prev-lesson-btn"),
        nextBtn: document.getElementById("next-lesson-btn"),
        // Top Menu
        topMenuTopic: document.getElementById("lesson-topmenu-topic"),
        topMenuNumber: document.getElementById("lesson-topmenu-number"),
    };

    // --- STATE ---
    const state = {
        lessonId: baseurl.split("?id=")[1]?.trim(),
        contentRaw: null, // Full API response
        markdownContent: null, // The file content
        h2Array: [], // For Table of Contents
        meta: {
            title: '',
            author: 'Unknown author',
            userId: null,
            date: '',
            class: 'Unknown class',
            section: 'Unknown section',
            module: 'Unknown module',
            nextLessonId: null,
            prevLessonId: null
        }
    };

    // --- HELPERS & UTILS ---

    function updateProgressBar() {
        const progressBar = elements.progressBar;
        if (!progressBar) return;

        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
        
        progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
    }

    function setupTopMenuObserver() {
        const applyTopMenu = () => {
            if (elements.topMenuTopic && elements.topMenuNumber) {
                elements.topMenuTopic.textContent = state.meta.title || `Lesson ${state.lessonId}`;
                elements.topMenuNumber.textContent = `${toRoman(state.meta.class)}.${state.meta.module}.${state.meta.section}`;
                return true;
            }
            return false;
        };

        if (!applyTopMenu()) {
            const mo = new MutationObserver((_, obs) => {
                if (applyTopMenu()) obs.disconnect();
            });
            mo.observe(document.body, { childList: true, subtree: true });
            // Optional fallback timeout to stop observing after N seconds
            setTimeout(() => mo.disconnect(), 10000);
        }
    }

    // --- FETCH DATA ---

    async function fetchLessonData() {
        if (debugMode) console.log("[DEBUG] Lesson ID from URL:", state.lessonId);

        if (!state.lessonId) return;

        try {
            // 1. Get Lesson Metadata
            const rawData = await window.apiService.lessons.getLessonById(state.lessonId);
            state.contentRaw = rawData;

            // Start lesson tracking
            if (isAuthenticated) {
                window.apiService.lessons.startLesson(state.lessonId).catch(error => {
                    if (debugMode) console.error("Failed to mark lesson as started:", error);
                });
            }

            // 2. Process Metadata
            state.meta.title = rawData.lesson.Title || `Lesson ${state.lessonId}`;
            state.meta.userId = rawData.lesson.AuthorID || null;
            state.meta.class = rawData.flag_translation.class || "Unknown class";
            state.meta.section = rawData.flag_translation.section || "Unknown section";
            state.meta.module = rawData.flag_translation.module || "Unknown module";
            state.meta.nextLessonId = rawData.lesson.NextLessonID;
            state.meta.prevLessonId = rawData.lesson.PrevLessonID;
            
            // Date formatting
            let d = new Date(rawData.lesson.CreatedAt.Time);
            state.meta.date = d.toLocaleString('ro-RO', { year: 'numeric', month: 'long', day: 'numeric' });

            document.title = `${state.meta.title} - Codium`;
            if (debugMode) console.log("[DEBUG] Lesson content raw data:", rawData);
            if (debugMode) console.log("[DEBUG] Document title set to:", document.title);

            // 3. Get Author
            try {
                const userData = await window.apiService.users.getUserById(state.meta.userId);
                state.meta.author = userData.Username || "Unknown author";
            } catch (error) {
                if (debugMode) console.error("[DEBUG] Failed to fetch author data:", error);
            }

            // 4. Get Favorites Count
            window.apiService.lessons.getFavoritesNumber(state.lessonId).then(count => {
                if (elements.favoritesCount) elements.favoritesCount.textContent = count.num_favorites;
            }).catch(error => {
                if (debugMode) console.error("[DEBUG] Failed to fetch favorites count:", error);
                if (elements.favoritesCount) elements.favoritesCount.textContent = "N/A";
            });

            // 5. Get File Content
            const fileId = rawData.lesson.ContentID;
            state.markdownContent = await window.apiService.fileManager.getFile(fileId);
            if (debugMode) console.log("[DEBUG] Fetched lesson content successfully.");

        } catch (error) {
            if (debugMode) console.error("[DEBUG] Critical error fetching lesson:", error);
        }
    }

    // --- RENDERERS ---

    async function renderLessonContent() {
        if (!elements.container) {
            if (debugMode) console.error("[DEBUG] Lesson container not found!");
            return;
        }

        // Ignore editor metadata comments like: <!-- {"fold":true} -->
        state.markdownContent = (state.markdownContent || '').replace(/<!--\s*\{\s*"fold"\s*:\s*(?:true|false)\s*\}\s*-->/g, '');

        // Update UI info
        elements.title.textContent = state.meta.title;
        if (elements.auth) {
            elements.auth.textContent = state.meta.author;
            elements.auth.href = `user.html?id=${state.meta.userId}`;
        }
        if (elements.date) elements.date.textContent = state.meta.date;

        if (elements.classInfo){ 
            if (elements.classInfo.parentElement.classList.contains("bread")) {
                elements.classInfo.dataset.i18n = `classe.${state.meta.class}`;
            } else {
                elements.classInfo.textContent = `Class: ${state.meta.class}`;
            }
        }

        if (elements.sectionInfo){
            if (elements.sectionInfo.parentElement.classList.contains("bread")) {
                elements.sectionInfo.textContent = `${state.meta.section}`;
            } else {
                elements.sectionInfo.textContent = `Section: ${state.meta.section}`;
            }
        }

        if (elements.moduleInfo){
            if (elements.moduleInfo.parentElement.classList.contains("bread")) {
                elements.moduleInfo.dataset.i18n = `modules.${state.meta.module}`;
            } else {
                elements.moduleInfo.textContent = `Module: ${state.meta.module}`;
            }
        }

        // Parse and render through the shared markdown renderer.
        elements.container.innerHTML = tomarkdown(state.markdownContent || '', state);
        hljs.highlightAll();

        if (elements.keypointsCard) {
            const keyPointsArray = state.keyPoints || [];
            if (keyPointsArray.length > 0) {
                elements.keypointsCard.style.display = "";
                const ul = elements.keypointsCard.querySelector("ul") || document.createElement("ul");
                ul.innerHTML = '';
                keyPointsArray.forEach(point => {
                    const li = document.createElement("li");
                    li.textContent = point;
                    ul.appendChild(li);
                });
                if (!ul.parentElement) {
                    elements.keypointsCard.appendChild(ul);
                }
            } else {
                elements.keypointsCard.style.display = "none";
            }
        }

        if(state.AlgoVis) {

        }

        await renderExternalLibraries(elements.container);
    }

    function renderCuprinsSidebar() {
        if (!elements.cuprinsCard) {
            if (debugMode) console.warn("[DEBUG] Cuprins card element not found, skipping cuprins rendering");
            return;
        }

        if (state.h2Array.length === 0) {
            elements.cuprinsCard.style.display = "none";
            if (debugMode) console.log("[DEBUG] No h2 headings found, hiding cuprins card");
            return;
        }

        // Clear existing content
        [...elements.cuprinsCard.children].forEach(child => {
            if (child.tagName.toLowerCase() === "a") {
                elements.cuprinsCard.removeChild(child);
            }
        });

        state.h2Array.forEach(item => {
            const link = document.createElement("a");
            link.href = `#${item.slug}`;
            link.textContent = '#' + item.text.trim();
            elements.cuprinsCard.appendChild(link);
        });

    }

    function setupHeaderAnimations() {
        if (!prefersReducedMotion() && elements.headerIconsContainer) {
            const buttons = elements.headerIconsContainer.querySelectorAll('button');
            buttons.forEach((btn, index) => {
                btn.style.setProperty('--button-index', index);
            });
        }
    }

    async function renderSidebar() {
        if (!elements.sidebar || !elements.sidebarTitle) {
            if (debugMode) console.warn("[DEBUG] Sidebar elements not found, skipping sidebar rendering");
            return;
        }

        if (debugMode) console.log("[DEBUG] Starting sidebar rendering...");
        
        const classKey = `classe.${state.meta.class}`;
        const getVal = (key) => key.split('.').reduce((obj, part) => obj?.[part], window.currentTranslations || {});
        
        if (getVal(classKey)) {
            elements.sidebarTitle.dataset.i18n = classKey;
            elements.sidebarTitle.textContent = getVal(classKey);
        } else {
            delete elements.sidebarTitle.dataset.i18n;
            elements.sidebarTitle.textContent = `{{classe.ned_}}${state.meta.class}`;
        }
        
        window.applyTranslations(elements.sidebarTitle);

        try {
            const sectionArray = await window.apiService.lessons.getSectionsForClass(state.meta.class);
            if (debugMode) console.log("[DEBUG] Sections array:", sectionArray);
            
            if (elements.sidebar.id === "lectii-sectiune") {
                if (debugMode) console.log("[DEBUG] Detected section container, rendering only current section:", state.meta.section);
                await renderSidebarSection(state.meta.section, false); // isLegacyUI = false -> no section headers, only links
                return;
            }

            for (const sectionNumber of sectionArray) {
                await renderSidebarSection(sectionNumber);
            }
        } catch (error) {
            if (debugMode) console.error("[DEBUG] Failed to render sidebar:", error);
        }
    }


    async function getSidebarEntriesForSection(sectionNumber) {
        try {
            if (debugMode) console.log(`[DEBUG] Calling getLessonsSortedByPrevNext with:`, {
                class: state.meta.class,
                section: sectionNumber, 
                module: state.meta.module
            });

            const lessonsListResult = await window.apiService.lessons.getLessonsSortedByPrevNext(state.meta.class, sectionNumber, state.meta.module, debugMode);
            if (debugMode) console.log(`[DEBUG] Lessons for section ${sectionNumber}:`, lessonsListResult);
            
            // Also debug the raw lessons data for this section
            const rawLessons = await window.apiService.lessons.getLessonsByFlags(state.meta.class, sectionNumber, state.meta.module);
            if (debugMode) console.log(`[DEBUG] Raw lessons for section ${sectionNumber}:`, rawLessons);

            return lessonsListResult || [];
        } catch (error) {
            if (debugMode) console.error(`[DEBUG] Failed to fetch lessons for section ${sectionNumber}:`, error);
            return [];
        }
    }

    async function renderSidebarSection(sectionNumber, isLegacyUI = true) {
        try {

            const lessonsListResult = await getSidebarEntriesForSection(sectionNumber);

            if (!lessonsListResult || lessonsListResult.length === 0) {
                if (debugMode) console.log(`[DEBUG] Skipping empty section ${sectionNumber}`);
                return;
            }

            // Create Section UI (for legacy sidebar, we render all sections. For new section container, we only render the current section without header)
            
            if (isLegacyUI) {
                const sidebarSection = document.createElement("div");
                sidebarSection.classList.add("lesson-sidebar_section");
                
                const sectionHeader = document.createElement("h3");
                sectionHeader.classList.add("lesson-sidebar_section-title");
                sectionHeader.textContent = `Sectiunea ${sectionNumber}`;
                sidebarSection.appendChild(sectionHeader);

                const lessonsList = document.createElement("ol");
                lessonsList.classList.add("lesson-sidebar_list");

                for (const lessonData of lessonsListResult) {
                    const lessonItem = document.createElement("li");
                    lessonItem.classList.add("lesson-sidebar_item");
                    
                    const lessonLink = document.createElement("a");
                    lessonLink.classList.add("lesson-sidebar_link");
                    lessonLink.href = `lesson.html?id=${lessonData.lesson.ID}`;
                    lessonLink.textContent = lessonData.lesson.Title || "Untitled Lesson";

                    if (String(lessonData.lesson.ID) === String(state.lessonId)) {
                        lessonItem.classList.add("lesson-sidebar_item--active");
                    }

                    lessonItem.appendChild(lessonLink);
                    lessonsList.appendChild(lessonItem);
                }
                sidebarSection.appendChild(lessonsList);
                elements.sidebar.appendChild(sidebarSection);

            } else {

                //Header section for new UI is "Sectiunea X"
                const sectionHeader = document.getElementById("lectii-sesiune");
                if (sectionHeader) {
                    sectionHeader.innerHTML = `<span data-i18n="flags.section" class="no-style"></span> ${sectionNumber}`;
                }
                // For new section container, we only render the current section without header
                [...elements.sidebar.children].forEach((child, index) => {
                    if (index > 0) elements.sidebar.removeChild(child);
                });
                let arrivedToCurrentLesson = false;
                for (const lessonData of lessonsListResult) {
                    const lessonLink = document.createElement("a");
                    if (String(lessonData.lesson.ID) === String(state.lessonId)) {
                        lessonLink.classList.add("active");
                        arrivedToCurrentLesson = true;
                    }else if(!arrivedToCurrentLesson) {
                        lessonLink.classList.add("visited");
                    } else if (arrivedToCurrentLesson) {
                        lessonLink.classList.add("disabled");   
                    }
                    lessonLink.href = `lessonindiv.html?id=${lessonData.lesson.ID}`;
                    lessonLink.textContent = lessonData.lesson.Title || "Untitled Lesson";

                    elements.sidebar.appendChild(lessonLink);
                }

            }

        } catch (sectionError) {
            if (debugMode) console.error(`[DEBUG] Failed to render section ${sectionNumber}:`, sectionError);
        }
    }

    // --- HANDLERS ---

    function setupNavigationButtons() {
        // Next Button
        if (elements.nextBtn) {
            if (elements.sidebar.id === "lectii-sectiune") {
                elements.nextBtn.addEventListener("click", () => nextButtonHandler(state.meta.nextLessonId, false)); // isLegacyUI = false -> new section container
            } else {
                elements.nextBtn.addEventListener("click", () => nextButtonHandler(state.meta.nextLessonId));
            }
            
            if (!state.meta.nextLessonId) {
                // clone next button and disable
                const finishedBtn = elements.nextBtn.cloneNode();
                finishedBtn.id = "finished-lesson-btn";
                finishedBtn.innerHTML = "<i class='fas fa-check'></i> Finish section";
                if (isAuthenticated) {
                    if (elements.sidebar.id === "lectii-sectiune") {
                        finishedBtn.addEventListener("click", () => finishButtonHandler(finishedBtn, false)); // isLegacyUI = false -> new section container
                    } else {
                        finishedBtn.addEventListener("click", () => finishButtonHandler(finishedBtn));
                    }
                    finishedBtn.disabled = false;
                } else {
                    finishedBtn.disabled = true;
                    finishedBtn.title = "Log in to finish the section";
                    finishedBtn.innerHTML = "<i class='fas fa-lock'></i> Log in to mark section as finished";
                    finishedBtn.style.cursor = "not-allowed";
                    finishedBtn.style.opacity = "0.5";
                }
                elements.nextBtn.parentNode.replaceChild(finishedBtn, elements.nextBtn);
            }
        }

        // Prev Button
        if (elements.prevBtn) {
            elements.prevBtn.addEventListener("click", () => prevButtonHandler(state.meta.prevLessonId));
            if (!state.meta.prevLessonId) {
                elements.prevBtn.disabled = true;
                elements.prevBtn.style.opacity = "0.5";
                elements.prevBtn.title = "No previous lesson available";
            }
        }
    }

    function setupInteractionButtons() {
        if (!isAuthenticated) {
            if (elements.favoriteBtn) elements.favoriteBtn.parentElement.style.display = "none";
            return;
        }

        if (elements.favoriteBtn) {
            elements.favoriteBtn.parentElement.style.display = "flex";
            elements.favoriteBtn.addEventListener("click", favoriteToggle);
            // Initial check
            window.apiService.lessons.getFavoriteStatus(state.lessonId).then(isFavorited => {
                elements.favoriteBtn.innerHTML = isFavorited 
                    ? "<i class='fas fa-heart'></i>" 
                    : "<i class='fas fa-heart'></i>";
            }).catch(error => {
                if (debugMode) console.error("[DEBUG] Failed to get favorite status:", error);
                elements.favoriteBtn.innerHTML = "<i class='fas fa-heart'></i> Favorite";
            });
        }

        if (elements.bookmarkBtn) {
            elements.bookmarkBtn.addEventListener("click", bookmarkToggle);
            // Initial check
            window.apiService.lessons.getBookmarkStatus(state.lessonId).then(isBookmarked => {
                if (isBookmarked) {
                    elements.bookmarkBtn.classList.remove("secondary");
                    elements.bookmarkBtn.classList.add("primary");
                    elements.bookmarkBtn.innerHTML = "<i class='fas fa-bookmark'></i>";
                    //toastsLoader.showToast("{{server_events.toasts.lesson_}}{{server_events.toasts._bookmarked}}", "confirm");
                } else {
                    elements.bookmarkBtn.classList.remove("primary");
                    elements.bookmarkBtn.classList.add("secondary");
                    elements.bookmarkBtn.innerHTML = "<i class='fas fa-bookmark'></i>";
                    //toastsLoader.showToast("{{server_events.toasts.lesson_}}{{server_events.toasts._unbookmarked}}", "info");
                }
            }).catch(error => {
                if (debugMode) console.error("[DEBUG] Bookmark toggle failed:", error);
                toastsLoader.showToast("{{server_events.toasts.bookmark-failed}}", "danger");
            });
        }
    }

    // Button Actions
    function bookmarkToggle() {
        if (!elements.bookmarkBtn) return;
        window.apiService.lessons.modifyBookmark(state.lessonId).then(() => {
            // Re-run handler logic to update UI (recursively simple)
            window.apiService.lessons.getBookmarkStatus(state.lessonId).then(isBookmarked => {
                if (isBookmarked) {
                    elements.bookmarkBtn.classList.remove("secondary");
                    elements.bookmarkBtn.classList.add("primary");
                    elements.bookmarkBtn.innerHTML = "<i class='fas fa-bookmark'></i>";
                    toastsLoader.showToast("{{server_events.toasts.lesson_}}{{server_events.toasts._bookmarked}}", "confirm");
                } else {
                    elements.bookmarkBtn.classList.remove("primary");
                    elements.bookmarkBtn.classList.add("secondary");
                    elements.bookmarkBtn.innerHTML = "<i class='fas fa-bookmark'></i>";
                    toastsLoader.showToast("{{server_events.toasts.lesson_}}{{server_events.toasts._unbookmarked}}", "info");
                }
            });
        }).catch(error => {
            if (debugMode) console.error("[DEBUG] Bookmark toggle failed:", error);
            toastsLoader.showToast("{{server_events.toasts.bookmark-failed}}", "danger");
        });
    }

    function favoriteToggle() {
        window.apiService.lessons.modifyFavorite(state.lessonId).then(result => {
            if (debugMode) console.log("[DEBUG]", result);
            const isFavorited = result.Favorited;
            
            if (isFavorited) {
                toastsLoader.showToast("{{server_events.toasts.lesson_}}{{server_events.toasts._favorited}}", "confirm");
                elements.favoriteBtn.classList.remove("secondary");
                elements.favoriteBtn.classList.add("primary");
                elements.favoriteBtn.innerHTML = "<i class='fas fa-heart'></i>";
            } else {
                toastsLoader.showToast("{{server_events.toasts.lesson_}}{{server_events.toasts._unfavorited}}", "info");
                elements.favoriteBtn.classList.remove("primary");
                elements.favoriteBtn.classList.add("secondary");
                elements.favoriteBtn.innerHTML = "<i class='fas fa-heart'></i>";
            }

            // Update favorites count
            window.apiService.lessons.getFavoritesNumber(state.lessonId).then(count => {
                elements.favoritesCount.textContent = count.num_favorites;
            }).catch(error => {
                if (debugMode) console.error("[DEBUG] Failed to update favorites count:", error);
            });
        }).catch(error => {
            if (debugMode) console.error("[DEBUG] Favorite toggle failed:", error);
            toastsLoader.showToast("{{server_events.toasts.favorite-failed}}", "danger");
        });
    }

    async function nextButtonHandler(nextLessonId, isLegacyUI = true) {
        if (!elements.nextBtn) {
            if (debugMode) console.warn("Next lesson button not found");
            return;
        }

        if (isAuthenticated) {
            await window.apiService.lessons.finishLesson(state.lessonId).catch(error => {
                if (debugMode) console.error("Failed to mark lesson as finished:", error);
            });
            const d = await window.apiService.lessons.getCompletionTime(state.lessonId);
            if (debugMode) console.log("Completion time:", d);
            // toastsLoader.showToast(`{{server_events.toasts.lesson_}}{{server_events.toasts._completed-in}}${d}`, "confirm");
            
            // FOLLOWING IS FOR DEBUG! SHOULD BE REMOVED LATER!
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
        if (isLegacyUI) {
            window.location.href = `lesson.html?id=${nextLessonId}`;
        } else {
            window.location.href = `lessonindiv.html?id=${nextLessonId}`;
        }
    }

    async function prevButtonHandler(prevLessonId, isLegacyUI = true) {
        if (!elements.prevBtn) {
            if (debugMode) console.warn("Previous lesson button not found");
            return;
        }
        if (isLegacyUI) {
            window.location.href = `lesson.html?id=${prevLessonId}`;
        } else {
            window.location.href = `lessonindiv.html?id=${prevLessonId}`;
        }
    }

    async function finishButtonHandler(finishedBtn, isLegacyUI = true) {
        if (!finishedBtn) {
            if (debugMode) console.warn("Finish lesson button not found");
            return;
        }

        if (isAuthenticated) {
            await window.apiService.lessons.finishLesson(state.lessonId).catch(error => {
                if (debugMode) console.error("Failed to mark lesson as finished:", error);
            });
            const d = await window.apiService.lessons.getCompletionTime(state.lessonId);
            if (debugMode) console.log("Completion time:", d);
            
            triggerConfetti({ particleCount: 120, duration: 3000 });
            
            toastsLoader.showToast(`{{server_events.toasts.lesson_}}{{server_events.toasts._completed-in}}${d}. {{server_events.toasts._finished-section}}`, "confirm");
            
            // Wait for confetti to finish before navigating
            await new Promise(resolve => setTimeout(resolve, 3300));
        }

        
        window.location.href = `lessons.html`;
    }

    function setupShareButton() {
        if (!elements.shareBtn) return;

        elements.shareBtn.addEventListener("click", () => {
            const shareData = {
                title: state.meta.title,
                text: `Check out this lesson: ${state.meta.title}`,
                url: window.location.href
            };

            if (navigator.share) {
                navigator.share(shareData).catch(error => {
                    if (debugMode) console.error("Share failed:", error);
                    // we can get false negatives from navigator.share,
                    // so we won't show a toast in this case
                    // toastsLoader.showToast("Failed to share the lesson", "danger");
                });
            } else {
                // Fallback: copy URL to clipboard
                navigator.clipboard.writeText(window.location.href).then(() => {
                    toastsLoader.showToast("{{server_events.toasts.url_}}{{server_events.toasts._lesson_}}{{server_events.toasts._copied-to-clipboard}}", "confirm");
                }).catch(error => {
                    if (debugMode) console.error("Clipboard copy failed:", error);
                    toastsLoader.showToast("{{server_events.toasts.copy-failed}}", "danger");
                });
            }
        });
    }

    function playAllAnimations() {
        if (prefersReducedMotion()) return;

        if (elements.container) {
            const contentBlocks = elements.container.querySelectorAll('h2, h3, h4, p, pre, ul, ol, blockquote, img, table');
            cascadeEntrance(contentBlocks, 'fade', { staggerDelay: 60, baseDelay: 200 });
        }

        if (elements.cuprinsCard && elements.cuprinsCard.style.display !== "none") {
            const links = elements.cuprinsCard.querySelectorAll('a');
            applyStaggeredAnimation(links, 'fadeInUp', { staggerDelay: 30, baseDelay: 400 });
        }

        if (elements.sidebar) {
            if (elements.sidebar.id === "lectii-sectiune") {
                const links = elements.sidebar.querySelectorAll('a');
                applyStaggeredAnimation(links, 'slideInFromRight', { staggerDelay: 35, baseDelay: 350 });
            }
        }
    }

    // --- INITIALIZATION ---

    async function initApp() {
        try {
            isAuthenticated = await window.apiService.checkAuthentication(false).catch(err => {
                if (debugMode) console.error("[DEBUG] Authentication check failed:", err);
                return false;
            });
            // Event Listeners
            window.addEventListener('scroll', updateProgressBar);
            window.addEventListener('resize', updateProgressBar);
            updateProgressBar(); // Initial call

            await fetchLessonData();
            
            if (state.markdownContent !== null) {
                await renderLessonContent();
                
                renderCuprinsSidebar();
                setupTopMenuObserver();
                setupNavigationButtons();
                setupInteractionButtons();
                setupShareButton();
                await renderSidebar();

                window.applyTranslations(document.body); 
                
                document.body.classList.remove('is-loading');
                
                await new Promise(resolve => setTimeout(resolve, 110));
                setupHeaderAnimations();
                playAllAnimations();

            } else {
                if (debugMode) console.error("[DEBUG] No markdown content to render");
                document.body.classList.remove('is-loading');
                elements.container.innerHTML = "<p>Failed to load lesson content. Please try again later.</p>";
            }
        } catch (error) {
            if (debugMode) console.error("[DEBUG] Critical error during initialization:", error);
            if (elements.container) {
                elements.container.innerHTML = "<p>Failed to load lesson content. Please try again later.</p>";
            }
        } finally {
            document.body.classList.remove('is-loading');
        }
    }

    initApp();
});