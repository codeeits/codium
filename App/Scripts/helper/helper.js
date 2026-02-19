/** 
* @param {HTMLElement} targetElement - The DOM element to process
*/

export function getHashtagsFromContent(content, containerElement = null) {
    if (!containerElement) return;
    
    const sourceText = content;
    const parts = sourceText.split(",").map(part => part.trim());
    if (containerElement) {
        containerElement.innerHTML = "";
    }
    parts.forEach(part => {
        const a = document.createElement("a");
        a.textContent = part.startsWith("#") ? part : `#${part}`;
        a.href = `/app/Probleme/index.html?source=${part}`;
        a.className = "hashtag";
        containerElement.appendChild(a);
    });
}