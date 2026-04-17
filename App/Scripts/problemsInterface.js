/*
*/

document.addEventListener("DOMContentLoaded", async function() {

    // DOM elements
    const problemTemplate = document.getElementById('problemsTemplate');
    const problemContainer = document.getElementById('problems-list');

    const problemsToLoad = 5;
    let problemsList = {};

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

    problemsList = await window.apiService.problems.getProblems();
    //console.log(problemsList);

    problemsList.forEach(async element => {
        //console.log(element);
        const problemClone = problemTemplate.cloneNode(true);

        // Populate the clone with data
        problemClone.querySelector('.problem-title').textContent = element.problem.Title;
        problemClone.querySelector('.problem-difficulty .difficulty-dot').textContent = element.tag_translation.difficulty;
        problemClone.querySelector('.problem-description p').textContent = element.problem.Description;
        problemClone.querySelector('.problem-tag').textContent = `#${element.problem.Title.toLowerCase().replace(/\s+/g, '')}`;
        
        if (element.problem.ThumbnailFileID != null){
            const url = window.apiService.fileManager.getFileUrl(element.problem.ThumbnailFileID);
            problemClone.querySelector('.problem-image').src = url;
        } else {
            problemClone.querySelector('.problem-image').remove();
        }

        if (element.problem.AuthorID != null){
            const authorData = await window.apiService.fileManager.getUserById(element.problem.AuthorID);
            problemClone.querySelector('.problem-author-name').textContent = authorData.Username;
    
            if (authorData.ProfilePicID != null) {
                const avatarWrapper = problemClone.querySelector('.problem-avatar');
                avatarWrapper.innerHTML = ''; // Clear placeholder
                const img = document.createElement('img');
                img.classList.add('author-avatar-img');
                img.src = window.apiService.fileManager.getFileUrl(authorData.ProfilePicID);
                img.alt = "Author Avatar";
                avatarWrapper.appendChild(img);
            }
        } else {
            problemClone.querySelector('.problem-author-name').textContent = "Unknown Author";
        }

        const openProblem = function() {
            window.location.href = `/app/Probleme/problem.html?id=${element.problem.ID}`;
        };

        makeElementKeyboardActivatable(problemClone, openProblem, 'link');

        // Append
        problemClone.style.removeProperty('display');
        problemContainer.appendChild(problemClone);
    });

});