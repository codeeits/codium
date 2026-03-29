/*
 __    ____  ___  ___  _____  _  _  ___  ____  _  _  ____  ____  ____  ____  __    ___  ____     ____  ___ 
(  )  ( ___)/ __)/ __)(  _  )( \( )/ __)(_  _)( \( )(_  _)( ___)(  _ \( ___)/__\  / __)( ___)   (_  _)/ __)
 )(__  )__) \__ \\__ \ )(_)(  )  ( \__ \ _)(_  )  (   )(   )__)  )   / )__)/(__)\( (__  )__)   .-_)(  \__ \
(____)(____)(___/(___/(_____)(_)\_)(___/(____)(_)\_) (__) (____)(_)\_)(__)(__)(__)\_____(____)()\____) (___/

Markdown Renderer & External Libraries Processing
*/

const debugMode = true;

/**
 * Renders external libraries (MathJax, Mermaid) on a target element
 * @param {HTMLElement} targetElement - The DOM element to process
 */
export function renderExternalLibraries(targetElement) {
    if (!targetElement) return;

    // --- MATHJAX PROCESSING ---
    if (window.MathJax) {
        if (window.MathJax.typesetPromise) {
            
            if (window.MathJax.typesetClear) {
                window.MathJax.typesetClear([targetElement]);
            }

            window.MathJax.typesetPromise([targetElement]).then(() => {
                if (debugMode) console.log('[MATH] MathJax processing complete');
            }).catch((err) => {
                console.warn('[MATH] MathJax typeset failed:', err);
            });

        } else if (window.MathJax.Hub) {
            // Fallback for MathJax v2
            window.MathJax.Hub.Queue(["Typeset", MathJax.Hub, targetElement]);
        }
    }

    // --- MERMAID PROCESSING ---
    if (window.mermaid) {
        const mermaidBlocks = targetElement.querySelectorAll('.language-mermaid, code[class*="mermaid"]');
        if (mermaidBlocks.length > 0) {
            mermaid.run({
                nodes: mermaidBlocks
            }).catch(err => console.warn('[MERMAID] Render failed', err));
        }
    }
}

/**
 * Converts markdown text to HTML with custom processing
 * @param {string} text - The markdown text to convert
 * @param {Object} state - State object for storing metadata (e.g., h2Array for TOC)
 * @returns {string} Rendered HTML
 */

const regexCache = {};

function regex(tag) {
    if (!regexCache[tag]) {
        regexCache[tag] = new RegExp(`\\n?\\/\\/\\/\\/\\/${tag}\\s*([\\s\\S]*?)\\s*\\/\\/\\/\\/\\/\\n?`);
    }
    return regexCache[tag];
}

export function extractCustomBlock(content, tag, modifyContent = true) {

    if (!content) return { match: null, cleanedText: content };
    const regexPattern = regex(tag);
    const match = content.match(regexPattern);
    return {
        match: match ? match[1].trim() : null,
        cleanedText: modifyContent ? content.replace(regexPattern, '') : content
    };
}

export function tomarkdown(text, state = {}) {
    if (!text) return '';

    text = text.replace(/<!--\s*\{\s*"fold"\s*:\s*(?:true|false)\s*\}\s*-->/g, '');

    // --- RENDERER CONFIGURATION ---
    const renderer = {
        heading(token) {
            const plain = token.text || '';
            const level = token.depth;
            const slug = plain
                .toLowerCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, '')
                .replace(/[^\w]+/g, '-')
                .replace(/^-+|-+$/g, '');
            
            // Store h2 headings for TOC generation
            if (level === 2 && state && state.h2Array) {
                state.h2Array.push({ text: plain, slug });
            }
            return `<h${level} id="${slug}">${plain}</h${level}>`;
        },
    };

    // --- DATA EXTRACTION ---

    const inputData = extractCustomBlock(text, 'input');
    text = inputData.cleanedText;

    const outputData = extractCustomBlock(text, 'output');
    text = outputData.cleanedText;

    const shortDescriptionData = extractCustomBlock(text, 'short-desc');
    text = shortDescriptionData.cleanedText;

    // --- VIRTUAL ui construction ---
    let ioHtml = '';
    if (inputData.match || outputData.match) {
        ioHtml += `<div class="example-block" id="io-container">`;
        if (inputData.match) {
            ioHtml += `<div class="example-input"><p>Intrare:</p><pre><code>${inputData.match}</code></pre></div>`;
        }
        if (outputData.match) {
            ioHtml += `<div class="example-output"><p>Ieșire:</p><pre><code>${outputData.match}</code></pre></div>`;
        }
        ioHtml += `</div>`;
    }

    // --- MARKED CONFIGURATION ---
    marked.use({ renderer });
    marked.setOptions({
        highlight: (code, lang) => {
            if (lang && hljs.getLanguage(lang)) {
                return hljs.highlight(code, { language: lang }).value;
            }
            return hljs.highlightAuto(code).value;
        },
        breaks: true,
        gfm: true
    });

    // --- RETURN ---
    const parsedMarkdown = marked.parse(text);
    
    setTimeout(() => {
        hljs.highlightAll();
        renderExternalLibraries(document.getElementById("problem-description"));
    }, 0);

    return parsedMarkdown + ioHtml;
}
