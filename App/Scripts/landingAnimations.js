(function initBinaryHero() {
    const plainStream = document.getElementById('binary-stream-plain');
    const maskedStream = document.getElementById('binary-stream-masked');
    if (!plainStream || !maskedStream) {
        return;
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const rowA = '101000110011000011001100011100101011100100101101100011000111110111111110001010010100111010001010100000';
    const rowB = '101010010001101110010100010010110011011110011111101111010100100011011100101000100101100110111100111111';
    const rowHeight = window.innerWidth <= 900 ? 18 : 28;
    const rows = Math.max(40, Math.ceil(window.innerHeight / rowHeight) + 22);
    const lineRepeat = 6;
    const plainFragment = document.createDocumentFragment();
    const maskedFragment = document.createDocumentFragment();
    const plainLineElements = [];
    const maskedLineElements = [];
    const lineMatrices = [];

    function expandPattern(pattern) {
        return pattern.repeat(lineRepeat);
    }

    for (let i = 0; i < rows; i += 1) {
        const plainLine = document.createElement('p');
        const maskedLine = document.createElement('p');
        const expanded = expandPattern(i % 2 === 0 ? rowA : rowB);
        plainLine.className = 'binary-line';
        maskedLine.className = 'binary-line';
        plainLine.textContent = expanded;
        maskedLine.textContent = expanded;
        plainLineElements.push(plainLine);
        maskedLineElements.push(maskedLine);
        lineMatrices.push(expanded.split(''));
        plainFragment.appendChild(plainLine);
        maskedFragment.appendChild(maskedLine);
    }

    plainStream.appendChild(plainFragment);
    maskedStream.appendChild(maskedFragment);

    if (prefersReducedMotion) {
        return;
    }

    let shouldAnimate = !document.hidden;
    const tickIntervalMs = 140;
    const linesPerTick = 3;
    const flipsPerLine = 6;

    function mutateLineBits(lineIndex) {
        const bits = lineMatrices[lineIndex];
        const length = bits.length;

        for (let i = 0; i < flipsPerLine; i += 1) {
            const position = Math.floor(Math.random() * length);
            bits[position] = bits[position] === '1' ? '0' : '1';
        }
    }

    function applyTick() {
        if (!shouldAnimate) {
            return;
        }

        const touched = new Set();
        for (let i = 0; i < linesPerTick; i += 1) {
            const lineIndex = Math.floor(Math.random() * rows);
            mutateLineBits(lineIndex);
            touched.add(lineIndex);
        }

        touched.forEach((lineIndex) => {
            const content = lineMatrices[lineIndex].join('');
            plainLineElements[lineIndex].textContent = content;
            maskedLineElements[lineIndex].textContent = content;
        });
    }

    const ticker = window.setInterval(applyTick, tickIntervalMs);

    document.addEventListener('visibilitychange', () => {
        shouldAnimate = !document.hidden;
    });

    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            const [entry] = entries;
            shouldAnimate = !!entry && entry.isIntersecting && !document.hidden;
        }, { threshold: 0.05 });

        observer.observe(plainStream);

        window.addEventListener('beforeunload', () => {
            observer.disconnect();
            window.clearInterval(ticker);
        });

        return;
    }

    window.addEventListener('beforeunload', () => {
        window.clearInterval(ticker);
    });
}());

// Spotlight
(function initSpotlight() {
    const heroSection = document.querySelector('.landing-hero');
    if (!heroSection) return;

    let rafId = 0;
    let targetX = '50%';
    let targetY = '50%';

    function applySpotlight() {
        heroSection.style.setProperty('--spotlight-x', targetX);
        heroSection.style.setProperty('--spotlight-y', targetY);
        rafId = 0;
    }

    function scheduleUpdate() {
        if (rafId) {
            return;
        }
        rafId = window.requestAnimationFrame(applySpotlight);
    }

    heroSection.addEventListener('pointermove', (e) => {
        const rect = heroSection.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        targetX = `${x}px`;
        targetY = `${y}px`;
        scheduleUpdate();
    }, { passive: true });

    heroSection.addEventListener('pointerleave', () => {
        targetX = '50%';
        targetY = '50%';
        scheduleUpdate();
    });

    window.addEventListener('beforeunload', () => {
        if (rafId) {
            window.cancelAnimationFrame(rafId);
        }
    });
}());

// Sparkle particles
(function initHeroParticles() {
    const canvas = document.getElementById('particle-canvas');
    const heroSection = document.querySelector('.landing-hero');
    if (!canvas || !heroSection) {
        return;
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
        return;
    }

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) {
        return;
    }

    let particles = [];
    let width = 0;
    let height = 0;
    let dpr = 1;
    let rafId = 0;
    let running = !document.hidden;
    let inView = true;
    let lastTs = 0;

    function randomBetween(min, max) {
        return Math.random() * (max - min) + min;
    }

    function getPrimaryColor() {
        return getComputedStyle(document.body).getPropertyValue('--primary').trim() || '#B07BC9';
    }

    function createParticle() {
        return {
            x: randomBetween(0, width),
            y: randomBetween(0, height),
            vx: randomBetween(-0.015, 0.015),
            vy: randomBetween(-0.04, -0.01),
            size: randomBetween(0.8, 2.2),
            alpha: randomBetween(0.12, 0.45),
            twinkle: randomBetween(0.0015, 0.005),
            phase: randomBetween(0, Math.PI * 2)
        };
    }

    function resizeCanvas() {
        const prevWidth = width;
        const prevHeight = height;
        const rect = heroSection.getBoundingClientRect();
        width = Math.max(1, Math.floor(rect.width));
        height = Math.max(1, Math.floor(rect.height));
        dpr = Math.min(window.devicePixelRatio || 1, 2);

        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const targetCount = Math.min(Math.max(Math.floor(width / 40), 20), 56);
        if (particles.length === 0) {
            particles = Array.from({ length: targetCount }, createParticle);
            return;
        }

        const scaleX = prevWidth > 0 ? width / prevWidth : 1;
        const scaleY = prevHeight > 0 ? height / prevHeight : 1;

        for (let i = 0; i < particles.length; i += 1) {
            const p = particles[i];
            p.x = Math.min(width, Math.max(0, p.x * scaleX));
            p.y = Math.min(height, Math.max(0, p.y * scaleY));
        }

        if (particles.length < targetCount) {
            const toAdd = targetCount - particles.length;
            for (let i = 0; i < toAdd; i += 1) {
                particles.push(createParticle());
            }
        } else if (particles.length > targetCount) {
            particles.length = targetCount;
        }
    }

    function draw(ts) {
        if (!running || !inView) {
            rafId = 0;
            return;
        }

        const dt = Math.min(32, ts - (lastTs || ts));
        lastTs = ts;

        ctx.clearRect(0, 0, width, height);
        const primaryColor = getPrimaryColor();

        for (let i = 0; i < particles.length; i += 1) {
            const p = particles[i];

            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.phase += p.twinkle * dt;

            if (p.y < -6 || p.x < -8 || p.x > width + 8) {
                p.x = randomBetween(0, width);
                p.y = height + randomBetween(2, 20);
                p.vx = randomBetween(-0.015, 0.015);
                p.vy = randomBetween(-0.04, -0.01);
            }

            const a = Math.max(0.06, p.alpha + Math.sin(p.phase) * 0.15);
            ctx.fillStyle = primaryColor;
            ctx.globalAlpha = a;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = 1;
        rafId = window.requestAnimationFrame(draw);
    }

    function start() {
        if (rafId || !running || !inView) {
            return;
        }
        lastTs = 0;
        rafId = window.requestAnimationFrame(draw);
    }

    function stop() {
        if (!rafId) {
            return;
        }
        window.cancelAnimationFrame(rafId);
        rafId = 0;
    }

    resizeCanvas();
    start();

    const observer = new IntersectionObserver((entries) => {
        const [entry] = entries;
        inView = !!entry && entry.isIntersecting;
        if (inView) {
            start();
        } else {
            stop();
        }
    }, { threshold: 0.05 });

    observer.observe(heroSection);

    document.addEventListener('visibilitychange', () => {
        running = !document.hidden;
        if (running) {
            start();
        } else {
            stop();
        }
    });

    window.addEventListener('resize', () => {
        resizeCanvas();
        start();
    }, { passive: true });

    window.addEventListener('beforeunload', () => {
        observer.disconnect();
        stop();
    });
}());

// Secret landing title easter egg popup
(function initLandingSecretPopup() {
    const landingTitle = document.querySelector('.landing-title');
    if (!landingTitle) {
        return;
    }

    const triggerClicks = 5;
    const clickWindowMs = 2600;
    let clickCount = 0;
    let resetTimer = 0;

    const popup = document.createElement('div');
    popup.className = 'landing-secret-popup';
    popup.setAttribute('aria-hidden', 'true');
    popup.innerHTML = `
        <div class="landing-secret-popup__panel" role="dialog" aria-modal="true" aria-label="Security alert">
            <p class="landing-secret-popup__title">you have been hacked</p>
            <button type="button" class="btn danger landing-secret-popup__close">Close</button>
        </div>
    `;
    document.body.appendChild(popup);

    const closeBtn = popup.querySelector('.landing-secret-popup__close');

    function openPopup() {
        popup.classList.add('is-visible');
        popup.setAttribute('aria-hidden', 'false');
        document.body.classList.add('landing-secret-popup-open');
    }

    function closePopup() {
        popup.classList.remove('is-visible');
        popup.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('landing-secret-popup-open');
    }

    function registerClick() {
        clickCount += 1;
        window.clearTimeout(resetTimer);

        if (clickCount >= triggerClicks) {
            clickCount = 0;
            openPopup();
            return;
        }

        resetTimer = window.setTimeout(() => {
            clickCount = 0;
        }, clickWindowMs);
    }

    landingTitle.addEventListener('click', registerClick);

    closeBtn?.addEventListener('click', closePopup);

    popup.addEventListener('click', (event) => {
        if (event.target === popup) {
            closePopup();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && popup.classList.contains('is-visible')) {
            closePopup();
        }
    });
}());