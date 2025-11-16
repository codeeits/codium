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

document.addEventListener("DOMContentLoaded", async function() {
    const baseurl = window.location.href;

    const titleElement = document.getElementById("lesson-title");
    const lessonContainer = document.getElementById("lesson-body");
    const authElement = document.getElementById("lesson-auth");
    const dateElement = document.getElementById("lesson-date");
    const classElement = document.getElementById("lesson-class");
    const sectionElement = document.getElementById("lesson-section");
    const moduleElement = document.getElementById("lesson-module");

    // Add this check:

    let lessonId = baseurl.split("?id=")[1];
    let contentRaw = '';

    console.log("Lesson ID from URL:", lessonId);

    if (lessonId) {
        lessonId = lessonId.trim();
        contentRaw = JSON.parse(await window.apiService.getLessonById(lessonId));    

        contentTitle = contentRaw.lesson.Title || `Lesson ${lessonId}`;
        document.title = `${contentTitle} - Codium`;
        console.log(contentRaw);
        console.log(document.title);

        contentAuthor = await window.apiService.getUserById(contentRaw.lesson.AuthorID).then(userData => {
            userData = JSON.parse(userData);
            return userData.Username || "Unknown author";
        }).catch(error => {
            console.error("Failed to fetch author data:", error);
            return "Unknown author";
        });

        contentUserID = contentRaw.lesson.AuthorID || null;
        contentDate = new Date(contentRaw.lesson.CreatedAt.Time);
        contentDate = contentDate.toLocaleString('ro-RO', { year: 'numeric', month: 'long', day: 'numeric' });
        contentClass = contentRaw.flag_translation.class || "Unknown class";
        contentSection = contentRaw.flag_translation.section || "Unknown section";
        contentModule = contentRaw.flag_translation.module || "Unknown module";

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

    async function renderSidebar() {
        const sidebar = document.getElementById("lesson-sidebar");
        const sidebarTitle = document.getElementById("lesson-sidebar_title");

        sidebarTitle.textContent = `Clasa a ${toRoman(contentClass)}-a`;

        try {
            const sectionArray = await window.apiService.getSectionsForClass(contentClass);
            console.log("Sections array:", sectionArray);

            for (const sectionNumber of sectionArray) {
                const lessonsListResult = await window.apiService.getLessonsSortedByPrevNext(contentClass, sectionNumber, contentModule);
                console.log(`Lessons for section ${sectionNumber}:`, lessonsListResult); 
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
            }
        } catch (error) {
            console.error("Failed to render sidebar:", error);
        }
    }
});