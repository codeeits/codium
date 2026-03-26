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
                    * { box-sizing: border-box; }
                    
                    @page {
                        margin: 20mm;
                    }
                    
                    body {
                        font-family: 'Raleway', sans-serif;
                        margin: 0; 
                        padding: 0;
                        font-size: 11pt; 
                        line-height: 1.5;
                        color: #1B0524;
                        background-color: white; 
                    }

                    html, body {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    
                    .logo-h1 {
                        font-size: 24pt;
                        font-weight: 700;
                        color: #B07BC9;
                        margin: 0;
                    }

                    .privacy-minimization-notice {
                        font-size: 9pt;
                        font-style: italic;
                        color: #555;
                        margin-top: 5px;
                        border-left: 2pt solid #B07BC9;
                        padding-left: 5pt;
                    }

                    .security-warning {
                        font-size: 9pt;
                        font-style: italic;
                        color: #B00020;
                        margin-top: 5px;
                        border-left: 2pt solid #B00020;
                        padding-left: 5pt;
                    }

                    .logo-p {
                        font-size: 12pt;
                        font-weight: 400;
                        color: #333;
                        margin-top: -5px;
                    }
                    
                    .content h1 { font-size: 18pt; margin-top: 0; padding-top: 15px; }
                    .content h2 { font-size: 14pt; margin-top: 25px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
                    
                    .print-container {
                        width: 100%;
                        max-width: 100%;
                        border: none;
                        border-collapse: collapse;
                    }

                    thead { display: table-header-group; }
                    tfoot { display: table-footer-group; }
                    
                    .gdpr-table { 
                        width: 100%; 
                        font-size: 10pt; 
                        border-collapse: collapse;
                        margin-top: 15px;
                        table-layout: fixed;
                    }

                    .gdpr-table td, .gdpr-table th {
                        overflow-wrap: break-word;
                        word-wrap: break-word;
                        padding: 6px 4px;
                        text-align: left;
                        vertical-align: top;
                    }

                    .profile-table td:first-child,
                    .preferences-table td:first-child {
                        width: 35%; 
                        font-weight: bold;
                    }

                    .code-block {
                        font-family: 'Bitcount Grid Double', monospace;
                        background-color: #f5f5f5;
                        border: 1px solid #ddd;
                        border-radius: 4px;
                        padding: 10px;
                    }

                    h2 {
                        page-break-after: avoid !important;
                        break-after: avoid !important;
                    }

                    tr {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }

                    .submission-entry {
                        page-break-inside: auto !important;
                        break-inside: auto !important;
                    }

                    .submission-meta {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                        page-break-after: avoid !important; 
                        break-after: avoid !important;
                    }

                    .submission-code {
                        page-break-before: avoid !important;
                        break-before: avoid !important;
                        page-break-inside: auto !important;
                        break-inside: auto !important;      
                    }

                    .code-block {
                        page-break-inside: auto !important; 
                        break-inside: auto !important;      
                        margin-top: 5px;
                        white-space: pre-wrap;
                        overflow-wrap: anywhere;
                        word-break: break-word;
                    }
                    
                    .code-block code {
                        white-space: inherit;
                        font-family: monospace;
                    }

                    img {
                        max-width: 100%;
                        height: auto;
                    }

                    .footer-space {
                        height: 90px;
                    }

                    footer {
                        text-align: center;
                        font-size: 9pt;
                        line-height: 1.35;
                        position: fixed;
                        bottom: 0; 
                        left: 0;
                        right: 0;
                        width: 100%;
                        border-top: 1px solid #321E3A;
                        padding-top: 5px;
                        background-color: white; 
                        overflow-wrap: anywhere;
                        word-break: break-word;
                    }

                    .gdpr-footer {
                        width: 100%;
                        margin: 0 auto;
                    }

                    .gdpr-footer p,
                    .gdpr-footer i {
                        display: block;
                        margin: 4px 0;
                        white-space: normal;
                        overflow-wrap: anywhere;
                        word-break: break-word;
                    }
                </style>
            </head>
            <body>
                <table class="print-container">
                    <thead>
                        <tr>
                            <td>
                                <header class="logo">
                                    <h1 class="logo-h1">codium/</h1>
                                    {{logo-p-translated}}
                                </header>
                            </td>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>
                                <div class="content">{{content}}</div>
                            </td>
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr>
                            <td>
                                <div class="footer-space">&nbsp;</div>
                            </td>
                        </tr>
                    </tfoot>
                </table>
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
    if (!printWindow) {
        console.error('Unable to open print window. The popup may have been blocked.');
        return;
    }

    const waitForImages = () => {
        const images = Array.from(printWindow.document.images || []);
        if (images.length === 0) return Promise.resolve();

        return Promise.all(images.map((img) => {
            if (img.complete) return Promise.resolve();
            return new Promise((resolve) => {
                img.addEventListener('load', resolve, { once: true });
                img.addEventListener('error', resolve, { once: true });
            });
        }));
    };

    const triggerPrint = async () => {
        await waitForImages();

        if (printWindow.document.fonts?.ready) {
            try {
                await printWindow.document.fonts.ready;
            } catch (_) {
                // Continue even if font readiness check fails.
            }
        }

        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
        }, 50);
    };

    printWindow.document.open();
    printWindow.document.write(`<!doctype html>${htmlContent}`);
    printWindow.document.close();

    printWindow.onafterprint = () => {
        printWindow.close();
    };

    if (printWindow.document.readyState === 'complete') {
        triggerPrint();
    } else {
        printWindow.addEventListener('load', triggerPrint, { once: true });
    }
}