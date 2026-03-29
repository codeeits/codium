/** 
* @param {HTMLElement} containerElement - The DOM element to process
* @returns {void}
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

export async function excelToJson(file) {
    try {
        const data = await file.arrayBuffer();
        
        const workbook = XLSX.read(data); 
        const payload = {};

        workbook.SheetNames.forEach(sheetName => {
            payload[sheetName] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        });

        return payload;
        
    } catch (error) {
        throw new Error("Failed to parse Excel file: " + error.message);
    }
}