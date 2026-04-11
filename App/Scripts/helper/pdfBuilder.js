/**
 * @param {string} body - The text content to convert to PDF format
 * @param {string} templateType - The type of template to use for the PDF (e.g., "default", "header")
 * @param {boolean} transformMarkdown - Whether to transform markdown syntax in the body (currently not implemented)
 * @param {} htmlSnippet - An optional HTML snippet to include in the PDF (e.g., for a header or footer)
 * @returns {string} - The generated PDF content as an HTML string
 *
 */

const templateFileUrl = new URL('./pdfTemplate.html', import.meta.url).href;
const templateCache = new Map();

async function getTemplateMarkup(templateType = 'default') {
    if (!templateCache.has('__doc__')) {
        const response = await fetch(templateFileUrl, { cache: 'no-cache' });
        if (!response.ok) {
            throw new Error(`Failed to load PDF template file: HTTP ${response.status}`);
        }

        const fileContent = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(fileContent, 'text/html');
        templateCache.set('__doc__', doc);
    }

    if (templateCache.has(templateType)) {
        return templateCache.get(templateType);
    }

    const doc = templateCache.get('__doc__');
    const templateEl =
        doc.querySelector(`template[data-template="${templateType}"]`) ||
        doc.querySelector('template[data-template="default"]');

    if (!templateEl) {
        throw new Error('No default template found in pdfTemplate.html');
    }

    const markup = templateEl.innerHTML.trim();
    templateCache.set(templateType, markup);
    return markup;
}

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

export async function textToPDF(body, templateType, transformMarkdown = false, footerHTML = "", logoPSnippet = "") {
    const translatedLogoP = translateHTMLSnippet(logoPSnippet);
    
    const translatedBody = translateHTMLSnippet(body);
    
    const translatedFooter = translateHTMLSnippet(footerHTML);

    let templateMarkup = '';
    try {
        templateMarkup = await getTemplateMarkup(templateType || 'default');
    } catch (error) {
        console.error('Using fallback PDF template because external template failed to load:', error);
        templateMarkup = `
            <html>
                <head></head>
                <body>
                    <div class="content">{{content}}</div>
                    <footer>{{footer}}</footer>
                </body>
            </html>`;
    }

    const templateHTML = templateMarkup
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