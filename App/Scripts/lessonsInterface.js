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
        authElement.textContent = `Author: ${contentAuthor}`;
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
        lessonContainer.innerHTML = marked.parse(markdown);
    }

});