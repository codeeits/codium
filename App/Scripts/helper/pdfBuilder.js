/**
 * @param {string} body - The text content to convert to PDF format
 * @param {string} templateType - The type of template to use for the PDF (e.g., "default", "header")
 * @param {boolean} transformMarkdown - Whether to transform markdown syntax in the body (currently not implemented)
 * @param {} htmlSnippet - An optional HTML snippet to include in the PDF (e.g., for a header or footer)
 * @returns {string} - The generated PDF content as an HTML string
 *
 */

const templateTypes = {
    "default": `
        <html>
            <head>
                <link href="https://fonts.googleapis.com/css2?family=Bitcount+Grid+Double:wght@100..900&family=Raleway:ital,wght@0,100..900;1,100..900&display=swap" rel="stylesheet">
                <style>
                    :root {
                        --base-font-size: 1.8vw;
                    }
                    * { box-sizing: border-box; }
                    body {
                        font-family: 'Raleway', sans-serif;
                        margin: 5vw;
                        font-size: var(--base-font-size);
                        line-height: 1.5;
                        color: #1B0524;
                    }
                    .logo-h1 {
                        font-size: 4vw;
                        font-weight: 700;
                        color: #B07BC9;
                        margin: 0;
                    }
                    .logo-p {
                        font-size: 1.8vw;
                        font-weight: 400;
                        color: #333;
                        margin-top: -1.5vw;
                    }
                    .content h1 { font-size: 3vw; margin-top: 2vw; }
                    .content h2 { font-size: 2.2vw; }
                    
                    table { 
                        width: 100%; 
                        font-size: 1.4vw; 
                        border-collapse: collapse;
                        margin-top: 2vw;
                    }
                    
                    footer {
                        text-align: center;
                        font-size: 1.2vw;
                        position: fixed;
                        bottom: 3vw;
                        left: 5vw;
                        right: 5vw;
                        border-top: 1px solid #321E3A;
                        padding-top: 1vw;
                    }
                </style>
            </head>
            <body>
                <header class="logo">
                    <h1 class="logo-h1">codium/</h1>
                    {{logo-p-translated}}
                </header>
                <div class="content">{{content}}</div>
                <footer>{{footer}}</footer>
            </body>
        </html>`
};

/**
 * Helper to translate a key using the global currentTranslations object
 */
function getTranslationValue(key) {
    if (!key) return "";
    return key.split('.').reduce((obj, part) => obj?.[part], currentTranslations) || key;
}

function translateHTMLSnippet(htmlSnippet) {
    if (!htmlSnippet) return "";
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlSnippet;
    
    applyTranslations(tempDiv);

    return tempDiv.innerHTML;
}

export function textToPDF(body, templateType, transformMarkdown = false, footerHTML = "", logoPSnippet = "") {
    const translatedLogoP = translateHTMLSnippet(logoPSnippet);
    
    const translatedBody = translateHTMLSnippet(body);
    
    const translatedFooter = translateHTMLSnippet(footerHTML);

    const templateHTML = (templateTypes[templateType] || templateTypes["default"])
        .replace("{{content}}", translatedBody)
        .replace("{{footer}}", translatedFooter)
        .replace("{{logo-p-translated}}", translatedLogoP);

    return HTMLToPDF(templateHTML);
}

function HTMLToPDF(htmlContent) {
    const printWindow = window.open('', '_blank');
    printWindow.document.writeln(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();    
    printWindow.close();
}