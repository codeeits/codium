/*
 __    ____  ___  ___  _____  _  _  ___  ____  _  _  ____  ____  ____  ____  __    ___  ____     ____  ___ 
(  )  ( ___)/ __)/ __)(  _  )( \( )/ __)(_  _)( \( )(_  _)( ___)(  _ \( ___)/__\  / __)( ___)   (_  _)/ __)
 )(__  )__) \__ \\__ \ )(_)(  )  ( \__ \ _)(_  )  (   )(   )__)  )   / )__)/(__)\( (__  )__)   .-_)(  \__ \
(____)(____)(___/(___/(_____)(_)\_)(___/(____)(_)\_) (__) (____)(_)\_)(__)(__)(__)\___)(____)()\____) (___/

Pentru randarea lectiilor cu marked.js. 
Pentru highlight, highlight.js; MathJax pentru formule matematice iar Mermaid pentru diagrame.

Phoenix - Mugur de Fluier
*/

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
document.addEventListener("DOMContentLoaded", async function() {
    
    const baseurl = window.location.href;
    const isAuthenticated = window.apiService.isAuthenticated();

    //------------------------------

    const titleElement = document.getElementById("lesson-title");
    const lessonContainer = document.getElementById("lesson-body");
    const authElement = document.getElementById("lesson-auth");
    const dateElement = document.getElementById("lesson-date");
    const favoritesCountElement = document.getElementById("lesson-favorites-count");
    const classElement = document.getElementById("lesson-class");
    const sectionElement = document.getElementById("lesson-section");
    const moduleElement = document.getElementById("lesson-module");
    const bookmarkButton = document.getElementById("bookmarkButton");
    const favoriteButton = document.getElementById("favoriteButton");
    const prevLessonBtn = document.getElementById("prev-lesson-btn");
    const nextLessonBtn = document.getElementById("next-lesson-btn");

    // Add this check:

    let lessonId = baseurl.split("?id=")[1];
    let contentRaw = '';

    console.log("Lesson ID from URL:", lessonId);

    if (lessonId) {
        lessonId = lessonId.trim();
        contentRaw = await window.apiService.getLessonById(lessonId); 

        if(isAuthenticated) {
            window.apiService.startLesson(lessonId).catch(error => {
                console.error("Failed to mark lesson as started:", error);
            });
        }
        
        contentTitle = contentRaw.lesson.Title || `Lesson ${lessonId}`;
        document.title = `${contentTitle} - Codium`;
        console.log(contentRaw);
        console.log(document.title);

        contentAuthor = await window.apiService.getUserById(contentRaw.lesson.AuthorID).then(userData => {
            return userData.Username || "Unknown author";
        }).catch(error => {
            console.error("Failed to fetch author data:", error);
            return "Unknown author";
        });

        if(!isAuthenticated) {
            favoriteButton.parentElement.style.display = "none";
        } else {
            favoriteButton.parentElement.style.display = "inline-block";
        }

        contentUserID = contentRaw.lesson.AuthorID || null;
        contentDate = new Date(contentRaw.lesson.CreatedAt.Time);
        contentDate = contentDate.toLocaleString('ro-RO', { year: 'numeric', month: 'long', day: 'numeric' });
        contentClass = contentRaw.flag_translation.class || "Unknown class";
        contentSection = contentRaw.flag_translation.section || "Unknown section";
        contentModule = contentRaw.flag_translation.module || "Unknown module";

        window.apiService.getFavoritesNumber(lessonId).then(count => {
            favoritesCountElement.textContent = count.num_favorites;
        }).catch(error => {
            console.error("Failed to fetch favorites count:", error);
            favoritesCountElement.textContent = "N/A";
        });

        if (bookmarkButton) {
            bookmarkButton.addEventListener("click", bookmarkToggle);
        }

        if (favoriteButton) {
            favoriteButton.addEventListener("click", favoriteToggle);
        }

        if (nextLessonBtn) {
            let nextLessonId = contentRaw.lesson.NextLessonID;
            nextLessonBtn.addEventListener("click", () => nextButtonHandler(nextLessonId));
            if (!nextLessonId) {
                nextLessonBtn.disabled = true;
                nextLessonBtn.style.opacity = "0.5";
                nextLessonBtn.title = "No next lesson available";
            }
        }

        if (prevLessonBtn) {
            let prevLessonId = contentRaw.lesson.PrevLessonID;
            prevLessonBtn.addEventListener("click", () => prevButtonHandler(prevLessonId));
            if (!prevLessonId) {
                prevLessonBtn.disabled = true;
                prevLessonBtn.style.opacity = "0.5";
                prevLessonBtn.title = "No previous lesson available";
            }
        }

        const applyTopMenu = () => {
            const tTopic = document.getElementById("lesson-topmenu-topic");
            const tNumber = document.getElementById("lesson-topmenu-number");
            if (tTopic && tNumber) {
            tTopic.textContent = contentTitle || `Lesson ${lessonId}`;
            tNumber.textContent = `${toRoman(contentClass)}.${contentModule}.${contentSection}`;
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

        contentRaw = contentRaw.lesson.ContentID;
        contentRaw = await window.apiService.getFile(contentRaw);
        console.log("Fetched lesson content:", contentRaw);
    }

    renderLesson(contentRaw);

    function renderLesson(markdown) {
        
        titleElement.textContent = contentTitle;
        authElement.textContent = `${contentAuthor}`;
        dateElement.textContent = contentDate;
        authElement.href = `user.html?id=${contentUserID}`;
        classElement.textContent = `Class: ${contentClass}`;
        sectionElement.textContent = `Section: ${contentSection}`;
        moduleElement.textContent = `Module: ${contentModule}`;

        function toRoman(n) {
            return n.toString().split('').reduce((acc, _, i, arr) => {
            const val = [1000,100,10,1][arr.length-i-1]*1;
            const roman = [
                ["","M","MM","MMM"],
                ["","C","CC","CCC","CD","D","DC","DCC","DCCC","CM"],
                ["","X","XX","XXX","XL","L","LX","LXX","LXXX","XC"],
                ["","I","II","III","IV","V","VI","VII","VIII","IX"]
            ];
            return acc + roman[i][Math.floor(n/val)%10];
            }, '');
        }
        const romanClass = toRoman(parseInt(contentClass));

        if (!lessonContainer) {
            console.error("Lesson container not found!");
            return;
        }
        
        const renderer = {
            heading(token) {
                
                const plain = token.text || '';
                const level = token.depth || 1;
                const slug = plain
                .toLowerCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, '') // remove accents
                .replace(/[^\w]+/g, '-')
                .replace(/^-+|-+$/g, '');

                return `<h${level} id="${slug}">${plain}</h${level}>`;
            }
        };

        marked.use({ renderer });

        marked.setOptions({
            highlight: function(code, lang) {
                if (hljs.getLanguage(lang)) {
                    return hljs.highlight(code, { language: lang }).value;
                }
            }
        });

        lessonContainer.innerHTML = marked.parse(markdown);

        hljs.highlightAll();
        
        // Process MathJax after content is rendered (Safari-compatible)
        if (window.MathJax && window.MathJax.typesetPromise) {
            // Wait a bit for DOM to settle
            setTimeout(() => {
                MathJax.typesetPromise([lessonContainer]).then(() => {
                    console.log('MathJax processing complete');
                }).catch((err) => {
                    console.error('MathJax typeset failed:', err);
                });
            }, 100);
        } else if (window.MathJax && window.MathJax.Hub) {
            // Fallback for older MathJax versions
            setTimeout(() => {
                MathJax.Hub.Queue(["Typeset", MathJax.Hub, lessonContainer]);
            }, 100);
        }

        if (window.mermaid) {
            mermaid.initialize({
                startOnLoad: false,
                theme: 'dark',
                themeVariables: {
                    primaryColor: '#9B59BB',
                    primaryTextColor: '#FFFFFF',
                    primaryBorderColor: '#9B59BB',
                    lineColor: '#B380CB',
                    secondaryColor: '#B380CB',
                    tertiaryColor: '#8E44AD',
                }
            });

            setTimeout(() => {
                mermaid.run({
                    querySelector: '#lesson-body .language-mermaid, #lesson-body code[class*="mermaid"]'
                }).then(() => {
                    console.log('Mermaid diagrams rendered');
                }).catch((err) => {
                    console.error('Mermaid rendering failed:', err);
                });
            }, 200);
        }
    }

    renderSidebar();
    bookmarkHandler();
    if (window.apiService.isAuthenticated()) {
        favoriteHandler();
    }

    async function renderSidebar() {
        try {
            const sidebar = document.getElementById("lesson-sidebar");
            const sidebarTitle = document.getElementById("lesson-sidebar_title");

            if (!sidebar || !sidebarTitle) {
                console.warn("Sidebar elements not found, skipping sidebar rendering");
                return;
            }

            sidebarTitle.textContent = `Clasa a ${toRoman(contentClass)}-a`;

            const sectionArray = await window.apiService.getSectionsForClass(contentClass);
            console.log("Sections array:", sectionArray);

            for (const sectionNumber of sectionArray) {
                try {
                    console.log(`[DEBUG] Calling getLessonsSortedByPrevNext with:`, {
                        class: contentClass,
                        section: sectionNumber, 
                        module: contentModule
                    });
                    
                    const lessonsListResult = await window.apiService.getLessonsSortedByPrevNext(contentClass, sectionNumber, contentModule, true);
                    console.log(`Lessons for section ${sectionNumber}:`, lessonsListResult);
                    
                    // Also debug the raw lessons data for this section
                    const rawLessons = await window.apiService.getLessonsByFlags(contentClass, sectionNumber, contentModule);
                    console.log(`[DEBUG] Raw lessons for section ${sectionNumber}:`, rawLessons);
                    
                    // Skip empty sections
                    if (!lessonsListResult || lessonsListResult.length === 0) {
                        console.log(`Skipping empty section ${sectionNumber}`);
                        continue;
                    } 
                    // set title
                    const sidebarSection = document.createElement("div");
                    sidebarSection.classList.add("lesson-sidebar_section");
                    const sectionHeader = document.createElement("h3");
                    sectionHeader.classList.add("lesson-sidebar_section-title");

                    sectionHeader.textContent = `Sectiunea ${sectionNumber}`;
                    sidebarSection.appendChild(sectionHeader);

                    // ul list
                    const lessonsList = document.createElement("ol");
                    lessonsList.classList.add("lesson-sidebar_list");

                    for (const lessonData of lessonsListResult) {
                        const lessonItem = document.createElement("li");
                        lessonItem.classList.add("lesson-sidebar_item");
                        const lessonLink = document.createElement("a");
                        lessonLink.classList.add("lesson-sidebar_link");
                        lessonLink.href = `lesson.html?id=${lessonData.lesson.ID}`;
                        lessonLink.textContent = lessonData.lesson.Title || "Untitled Lesson";

                        if (lessonData.lesson.ID === lessonId) {
                            lessonItem.classList.add("lesson-sidebar_item--active");
                        }

                        lessonItem.appendChild(lessonLink);
                        lessonsList.appendChild(lessonItem);
                    }
                    sidebarSection.appendChild(lessonsList);
                    sidebar.appendChild(sidebarSection);
                } catch (sectionError) {
                    console.error(`Failed to render section ${sectionNumber}:`, sectionError);
                    // Continue with next section
                }
            }
        } catch (error) {
            console.error("Failed to render sidebar:", error);
        }
    }

    function bookmarkHandler() {

        if (!bookmarkButton || bookmarkButton.parentElement.style.display === "none") {
            console.warn("User not authenticated or bookmark button not found in DOM");
            return;
        }
        
        window.apiService.getBookmarkStatus(lessonId).then(isBookmarked => {
            if (isBookmarked) {
                bookmarkButton.innerHTML = "<i class='fas fa-bookmark'></i> Remove Bookmark";
                toastsLoader.showToast("Lesson bookmarked", "confirm");
            } else {
                bookmarkButton.innerHTML = "<i class='fas fa-bookmark'></i> Bookmark";
                toastsLoader.showToast("Bookmark removed", "info");
            }
        }).catch(error => {
            console.error("Bookmark toggle failed:", error);
            toastsLoader.showToast("Failed to toggle bookmark", "danger");
        });
    }

    function favoriteHandler() {
        if (!favoriteButton || favoriteButton.parentElement.style.display === "none") {
            console.warn("User not authenticated or favorite button not found in DOM");
            return;
        }
        
        window.apiService.getFavoriteStatus(lessonId).then(isFavorited => {
            if (isFavorited) {
                favoriteButton.innerHTML = "<i class='fas fa-heart'></i> Unfavorite";
            } else {
                favoriteButton.innerHTML = "<i class='fas fa-heart'></i> Favorite";
            }
        }).catch(error => {
            console.error("Failed to get favorite status:", error);
            favoriteButton.innerHTML = "<i class='fas fa-heart'></i> Favorite";
        });
    }

    function bookmarkToggle() {
        window.apiService.modifyBookmark(lessonId).then(() => {
            bookmarkHandler();
        }).catch(error => {
            console.error("Bookmark toggle failed:", error);
            toastsLoader.showToast("Failed to toggle bookmark", "danger");
        });
    }

    function favoriteToggle() {
        window.apiService.modifyFavorite(lessonId).then(result => {
            console.log("[DEBUG]", result);
            const isFavorited = result.Favorited;
            if (isFavorited) {
                toastsLoader.showToast("Lesson added to favorites", "confirm");
            } else {
                toastsLoader.showToast("Removed from favorites", "info");
            }
            favoriteHandler();

            // Update favorites count

            window.apiService.getFavoritesNumber(lessonId).then(count => {
                favoritesCountElement.textContent = count.num_favorites;
            }).catch(error => {
                console.error("Failed to update favorites count:", error);
            });
        }).catch(error => {
            console.error("Favorite toggle failed:", error);
            toastsLoader.showToast("Failed to toggle favorite", "danger");
        });
    }

    async function nextButtonHandler(nextLessonId) {

        if (!nextLessonBtn) {
            console.warn("Next lesson button not found");
            return;
        }

        if(isAuthenticated) {
            window.apiService.finishLesson(lessonId).catch(error => {
                console.error("Failed to mark lesson as finished:", error);
            });
            const d = await window.apiService.getCompletionTime(lessonId);
            console.log("Completion time:", d);
            toastsLoader.showToast(`Lesson completed in ${d}`, "confirm");
            
            // FOLLOWING IS FOR DEBUG! SHOULD BE REMOVED LATER!
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
        window.location.href = `lesson.html?id=${nextLessonId}`;

    }

    async function prevButtonHandler(prevLessonId) {

        if (!prevLessonBtn) {
            console.warn("Previous lesson button not found");
            return;
        }

        window.location.href = `lesson.html?id=${prevLessonId}`;

    }
});