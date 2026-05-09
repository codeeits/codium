/**
 * Confetti Animation using Canvas
 * Uses CSS variables from elements2.css for colors and timings
 * 
 * Usage:
 * import { triggerConfetti } from './animations/confetti.js';
 * triggerConfetti(); // Uses CSS variable colors and timings
 * triggerConfetti({ duration: 2000, particleCount: 100, colors: [...] })
 */

import { getColorPalette, getAnimationTimings } from './animationUtils.js';

/**
 * Extract CSS color value 
 */
function cssColorToHex(cssColor) {
    if (!cssColor || cssColor.trim() === '') return null; // Reject empty strings
    if (cssColor.startsWith('#')) return cssColor;
    
    const match = cssColor.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
        const r = parseInt(match[1]).toString(16).padStart(2, '0');
        const g = parseInt(match[2]).toString(16).padStart(2, '0');
        const b = parseInt(match[3]).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
    }

    try {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        
        const ctx = canvas.getContext('2d', { willReadFrequently: true }); 
        
        // Clear canvas so the pixel is transparent (alpha = 0)
        ctx.clearRect(0, 0, 1, 1);
        
        ctx.fillStyle = cssColor;
        ctx.fillRect(0, 0, 1, 1);
        
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
        
        // If alpha is 0, the Canvas rejected the color string and drew nothing.
        if (a === 0) return null; 
        
        const toHex = (v) => v.toString(16).padStart(2, '0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    } catch (e) {
        return null;
    }
}

class ConfettiAnimation {
    constructor(options = {}) {
        const timings = getAnimationTimings();
        const parsedDuration = parseInt(timings.normal) || 500;
        
        this.duration = options.duration || parsedDuration + 2000; 
        this.particleCount = options.particleCount || 100;
        
        const fallbackPalette = ['#9B59BB', '#B380CB', '#8E44AD', '#3498DB', '#F1C40F', '#E74C3C'];
        
        if (options.colors) {
            this.colors = options.colors;
        } else {
            const rawPalette = getColorPalette();
            
            const parsedColors = rawPalette
                .map(color => cssColorToHex(color))
                .filter(color => color !== null);
            
            this.colors = parsedColors.length > 0 ? parsedColors : fallbackPalette;
            
            console.log('Final Confetti Colors:', this.colors);
        }
        
        this.particles = [];
        this.animationId = null;
        this.canvas = null;
        this.ctx = null;
        this.startTime = null;
        this.isRunning = false;
    }

    init() {
        // Create and style canvas
        this.canvas = document.createElement('canvas');
        this.canvas.style.position = 'fixed';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.zIndex = '9999';
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        document.body.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');

        // Create particles
        this.createParticles();
        this.isRunning = true;
        this.startTime = Date.now();
    }

    createParticles() {
        for (let i = 0; i < this.particleCount; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height - this.canvas.height,
                vx: (Math.random() - 0.5) * 8,
                vy: Math.random() * 6 + 4,
                size: Math.random() * 8 + 4,
                color: this.colors[Math.floor(Math.random() * this.colors.length)],
                rotation: Math.random() * 360,
                rotationSpeed: (Math.random() - 0.5) * 20,
                opacity: 1,
            });
        }
    }

    update(deltaTime) {
        const progress = deltaTime / this.duration;

        this.particles.forEach(particle => {
            // Physics
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.vy += 0.15; // gravity
            particle.vx *= 0.98; // air resistance
            particle.rotation += particle.rotationSpeed;

            // Fade out
            particle.opacity = Math.max(0, 1 - progress);
        });
    }


    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.particles.forEach(particle => {
            this.ctx.save();
            this.ctx.globalAlpha = particle.opacity;
            this.ctx.translate(particle.x, particle.y);
            this.ctx.rotate((particle.rotation * Math.PI) / 180);
            
            this.ctx.fillStyle = particle.color;
            this.ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
            
            this.ctx.restore();
        });
    }

    animate() {
        if (!this.isRunning) return;

        const deltaTime = Date.now() - this.startTime;
        const isComplete = deltaTime >= this.duration;

        this.update(deltaTime);
        this.draw();

        if (isComplete) {
            this.stop();
        } else {
            this.animationId = requestAnimationFrame(() => this.animate());
        }
    }

    start() {
        this.init();
        this.animate();
    }

    stop() {
        this.isRunning = false;

        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }

        this.particles = [];
        this.ctx = null;
        this.canvas = null;
    }

    handleResize() {
        if (this.canvas) {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
        }
    }
}

/**
 * Trigger confetti animation
 * @param {Object} options - Configuration options
 * @param {number} options.duration - Animation duration in ms (default: 2500)
 * @param {number} options.particleCount - Number of particles (default: 100)
 * @param {string[]} options.colors - Array of particle colors (default: vibrant palette)
 * @returns {ConfettiAnimation} The animation instance
 */

export function triggerConfetti(options = {}) {
    const confetti = new ConfettiAnimation(options);
    confetti.start();

    const resizeHandler = () => confetti.handleResize();
    window.addEventListener('resize', resizeHandler);

    const checkInterval = setInterval(() => {
        if (!confetti.isRunning) {
            clearInterval(checkInterval);
            window.removeEventListener('resize', resizeHandler);
        }
    }, 100);

    return confetti;
}

export { ConfettiAnimation };
