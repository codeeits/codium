/**
 * Confetti Animation using Canvas
 * Uses CSS variables from elements2.css for colors and timings
 * 
 * Usage:
 * import { triggerConfetti } from './animations/confetti.js';
 * triggerConfetti(); // Uses CSS variable colors and timings
 * triggerConfetti({ duration: 2000, particleCount: 100, colors: [...] })
 */

import { getCSSVar, getColorPalette, getAnimationTimings } from './animationUtils.js';

/**
 * Extract CSS color value from var format (e.g., "rgb(176, 123, 201)" -> hex)
 */
function cssColorToHex(cssColor) {
    // If already hex, return it
    if (cssColor.startsWith('#')) return cssColor;
    
    // Parse rgb/rgba format
    const match = cssColor.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
        const r = parseInt(match[1]).toString(16).padStart(2, '0');
        const g = parseInt(match[2]).toString(16).padStart(2, '0');
        const b = parseInt(match[3]).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
    }
    
    return cssColor;
}

class ConfettiAnimation {
    constructor(options = {}) {
        // Get timing from CSS variables, fall back to ms values
        const timings = getAnimationTimings();
        const parsedDuration = parseInt(timings.normal) || 500;
        
        this.duration = options.duration || parsedDuration + 2000; // Make it a bit longer than normal
        this.particleCount = options.particleCount || 100;
        
        // Use design system colors from CSS variables
        if (options.colors) {
            this.colors = options.colors;
        } else {
            const palette = getColorPalette();
            this.colors = palette.map(color => cssColorToHex(color));
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
