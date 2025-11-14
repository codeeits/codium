/*
 __    ____  ___  ___  _____  _  _  ___  ____  _  _  ____  ____  ____  ____  __    ___  ____     ____  ___ 
(  )  ( ___)/ __)/ __)(  _  )( \( )/ __)(_  _)( \( )(_  _)( ___)(  _ \( ___)/__\  / __)( ___)   (_  _)/ __)
 )(__  )__) \__ \\__ \ )(_)(  )  ( \__ \ _)(_  )  (   )(   )__)  )   / )__)/(__)\( (__  )__)   .-_)(  \__ \
(____)(____)(___/(___/(_____)(_)\_)(___/(____)(_)\_) (__) (____)(_)\_)(__)(__)(__)\___)(____)()\____) (___/

Pentru randarea lectiilor cu marked.js. 
Pentru highlight, highlight.js; MathJax pentru formule matematice iar Mermaid pentru diagrame.
*/


document.addEventListener("DOMContentLoaded", async function() {
    const baseurl = window.location.href;

    const titleElement = document.getElementById("lesson-title");
    const lessonContainer = document.getElementById("lesson-body");
    const authElement = document.getElementById("lesson-auth");
    const classElement = document.getElementById("lesson-class");
    const sectionElement = document.getElementById("lesson-section");
    const moduleElement = document.getElementById("lesson-module");

    // -- top menu variables (not working yet >.<) --

    const topMenuNumber = document.getElementById("lesson-topmenu-number");
    const topMenuTopic = document.getElementById("lesson-topmenu-topic");

    // Add this check:

    let lessonId = baseurl.split("?id=")[1];
    let contentRaw = '';

    console.log("Lesson ID from URL:", lessonId);

    if (lessonId) {
        lessonId = lessonId.trim();
        contentRaw = JSON.parse(await window.apiService.getLessonById(lessonId));

        contentTitle = contentRaw.lesson.Title || `Lesson ${lessonId}`;
        console.log(contentRaw);

        contentAuthor = await window.apiService.getUserById(contentRaw.lesson.AuthorID).then(userData => {
            userData = JSON.parse(userData);
            return userData.Username || "Unknown author";
        }).catch(error => {
            console.error("Failed to fetch author data:", error);
            return "Unknown author";
        });

        contentUserID = contentRaw.lesson.AuthorID || null;
        contentClass = contentRaw.flag_translation.class || "Unknown class";
        contentSection = contentRaw.flag_translation.section || "Unknown section";
        contentModule = contentRaw.flag_translation.module || "Unknown module";

        contentRaw = contentRaw.lesson.ContentID;
        contentRaw = await window.apiService.getFile(contentRaw);
        console.log("Fetched lesson content:", contentRaw);
    }
    renderLesson(contentRaw);
    function renderLesson(markdown) {
        
        titleElement.textContent = contentTitle;
        authElement.textContent = `${contentAuthor}`;
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

});