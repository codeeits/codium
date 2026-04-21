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

        const normalizeExcelText = (value) => {
            if (typeof value === 'string') {
                return value
                    .replace(/\\r\\n/g, '\n')
                    .replace(/\\n/g, '\n');
            }

            if (Array.isArray(value)) {
                return value.map(normalizeExcelText);
            }

            if (value && typeof value === 'object') {
                return Object.fromEntries(
                    Object.entries(value).map(([key, entryValue]) => [key, normalizeExcelText(entryValue)])
                );
            }

            return value;
        };

        workbook.SheetNames.forEach(sheetName => {
            payload[sheetName] = normalizeExcelText(XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]));
        });

        return payload;
        
    } catch (error) {
        throw new Error("Failed to parse Excel file: " + error.message);
    }
}

let qrJsReadyPromise = null;

export function ensureQrJsLoaded() {
    if (typeof window !== 'undefined' && typeof window.QRCode === 'function') {
        return Promise.resolve();
    }

    if (qrJsReadyPromise) {
        return qrJsReadyPromise;
    }

    qrJsReadyPromise = new Promise((resolve, reject) => {
        const existingScript = document.querySelector('script[data-qrjs="true"]');
        if (existingScript) {
            existingScript.addEventListener('load', () => resolve(), { once: true });
            existingScript.addEventListener('error', () => reject(new Error('Failed to load qrJS library.')), { once: true });
            return;
        }

        const script = document.createElement('script');
        script.src = '/app/Scripts/external/qrJS/main.js';
        script.async = true;
        script.dataset.qrjs = 'true';
        script.addEventListener('load', () => resolve(), { once: true });
        script.addEventListener('error', () => reject(new Error('Failed to load qrJS library.')), { once: true });
        document.head.appendChild(script);
    });

    return qrJsReadyPromise;
}

export async function buildQrSvgDataUri(text, options = {}) {
    await ensureQrJsLoaded();

    if (typeof window.QRCode !== 'function') {
        throw new Error('QRCode generator is unavailable after loading qrJS.');
    }

    const width = options.width ?? 200;
    const height = options.height ?? 200;
    const colorDark = options.colorDark ?? '#0f172a';
    const colorLight = options.colorLight ?? '#ffffff';
    const correctLevel = options.correctLevel ?? window.QRCode.CorrectLevel.M;

    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'fixed';
    tempContainer.style.left = '-9999px';
    tempContainer.style.top = '-9999px';
    document.body.appendChild(tempContainer);

    try {
        new window.QRCode(tempContainer, {
            text,
            width,
            height,
            colorDark,
            colorLight,
            correctLevel,
            useSVG: true
        });

        const generatedSvg = tempContainer.querySelector('svg');
        if (!generatedSvg) {
            throw new Error('qrJS did not generate an SVG element.');
        }

        const svgMarkup = new XMLSerializer().serializeToString(generatedSvg);
        return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgMarkup)}`;
    } finally {
        tempContainer.remove();
    }
}