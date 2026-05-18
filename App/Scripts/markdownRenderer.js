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

    text = text.replace(/^([ \t]*)[–—](\s)/gm, '$1-$2');
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

    // --- CUSTOM EXTENSIONS (SUB/SUPERSCRIPT) ---
    const legacySubscript = {
        name: 'legacySubscript',
        level: 'inline',
        start(src) { 
            const match = /`?\w+``\w+/.exec(src);
            return match ? match.index : undefined; 
        },
        tokenizer(src) {
            // Captures: 
            // 1: Optional starting backtick
            // 2: Base (e.g., 'b')
            // 3: Subscript (e.g., 'i1', '3i')
            const match = /^(`?)(\w+)``(\w+)\1/.exec(src);
            
            if (match) {
                return { 
                    type: 'legacySubscript', 
                    raw: match[0],
                    hasBackticks: !!match[1], // True if it was wrapped in single backticks
                    base: match[2],
                    sub: match[3]
                };
            }
            
            // Fallback just in case there's an opening backtick but no closing one
            const fallback = /^(\w+)``(\w+)/.exec(src);
            if (fallback) {
                return {
                    type: 'legacySubscript',
                    raw: fallback[0],
                    hasBackticks: false,
                    base: fallback[1],
                    sub: fallback[2]
                };
            }
        },
        renderer(token) { 
            // Build the HTML using the captured base and subscript
            const content = `${token.base}<sub>${token.sub}</sub>`;
            
            // If the user wrapped it in single backticks, preserve the code styling
            return token.hasBackticks ? `<code>${content}</code>` : content;
        }
    };

    const superscript = {
        name: 'superscript',
        level: 'inline',
        start(src) { 
            const idx = src.indexOf('^');
            return idx !== -1 ? idx : undefined; 
        },
        tokenizer(src) {
            const match = /^\^([^\^]+)\^/.exec(src);
            if (match) {
                return { type: 'superscript', raw: match[0], text: match[1] };
            }
        },
        renderer(token) { return `<sup>${token.text}</sup>`; }
    };

    const subscript = {
        name: 'subscript',
        level: 'inline',
        start(src) { 
            const idx = src.indexOf('~');
            return idx !== -1 ? idx : undefined; 
        },
        tokenizer(src) {
            const match = /^~([^~]+)~/.exec(src);
            if (match) {
                return { type: 'subscript', raw: match[0], text: match[1] };
            }
        },
        renderer(token) { return `<sub>${token.text}</sub>`; }
    };

    // --- DATA EXTRACTION ---
    const inputData = extractCustomBlock(text, 'input');
    text = inputData.cleanedText;

    const outputData = extractCustomBlock(text, 'output');
    text = outputData.cleanedText;

    const shortDescriptionData = extractCustomBlock(text, 'short-desc');
    text = shortDescriptionData.cleanedText;

    const keyPointsData = extractCustomBlock(text, 'key');
    text = keyPointsData.cleanedText;
    if (state) {
        state.keyPoints = keyPointsData.match
            ? keyPointsData.match.split('\n').map(line => line.trim()).filter(Boolean)
            : [];
    }

    const AlgoVisData = extractCustomBlock(text, 'algovis');
    text = AlgoVisData.cleanedText;
    if (state) {
        state.AlgoVis = AlgoVisData.match ? AlgoVisData.match.trim() : null;
    }

    // --- VIRTUAL ui construction ---
    let ioHtml = '';
    if (inputData.match || outputData.match) {
        ioHtml += `<div class="example-block" id="io-container">`;
        if (inputData.match) {
            ioHtml += `<div class="example-input"><p>{{misc.code_example.input}}</p><pre><code>${inputData.match}</code></pre></div>`;
        }
        if (outputData.match) {
            ioHtml += `<div class="example-output"><p>{{misc.code_example.output}}</p><pre><code>${outputData.match}</code></pre></div>`;
        }
        ioHtml += `</div>`;
    }

    marked.use({ 
        renderer,
        extensions: [legacySubscript, superscript, subscript]
    });
    
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
