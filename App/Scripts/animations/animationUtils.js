/**
 * Animation Utilities Module
 * 
 * Provides reusable functions for managing animations on lesson pages
 * - Extract CSS variables for colors and timings
 * - Apply staggered animations to elements
 * - Handle animation completion
 * - Manage animation state
 */

/**
 * Get computed CSS variable value
 * @param {string} varName - CSS variable name (with or without --)
 * @returns {string} The computed value of the CSS variable
 */
export function getCSSVar(varName) {
    const cleanName = varName.startsWith('--') ? varName : `--${varName}`;
    return getComputedStyle(document.documentElement).getPropertyValue(cleanName).trim();
}

/**
 * Get color palette from CSS variables
 * @returns {string[]} Array of color values
 */
export function getColorPalette() {
    return [
        getCSSVar('--primary'),
        getCSSVar('--confirm'),
        getCSSVar('--warning'),
        getCSSVar('--danger'),
        getCSSVar('--text-cream'),
    ];
}

/**
 * Get animation timing from CSS variables
 * @returns {Object} Object with timing durations
 */
export function getAnimationTimings() {
    return {
        fast: getCSSVar('--anim-duration-fast'),
        normal: getCSSVar('--anim-duration-normal'),
        slow: getCSSVar('--anim-duration-slow'),
        veryslow: getCSSVar('--anim-duration-veryslow'),
    };
}

/**
 * Get easing functions from CSS variables
 * @returns {Object} Object with easing functions
 */
export function getAnimationEasings() {
    return {
        inOut: getCSSVar('--anim-ease-in-out'),
        out: getCSSVar('--anim-ease-out'),
        in: getCSSVar('--anim-ease-in'),
        outBounce: getCSSVar('--anim-ease-out-bounce'),
    };
}

/**
 * Apply staggered animation to multiple elements
 * @param {NodeList|Element[]} elements - Elements to animate
 * @param {string} animationName - Name of the animation (from CSS)
 * @param {Object} options - Animation options
 * @param {string} options.duration - Duration (e.g., 'var(--anim-duration-normal)')
 * @param {string} options.easing - Easing function
 * @param {number} options.staggerDelay - Delay between each element (ms)
 * @param {number} options.baseDelay - Initial delay for first element (ms)
 */
export function applyStaggeredAnimation(elements, animationName, options = {}) {
    const {
        duration = 'var(--anim-duration-normal)',
        easing = 'var(--anim-ease-out)',
        staggerDelay = 80,
        baseDelay = 0,
    } = options;

    Array.from(elements).forEach((element, index) => {
        const delay = baseDelay + index * staggerDelay;
        element.style.setProperty('--item-index', index);
        element.style.animation = `${animationName} ${duration} ${easing} ${delay}ms backwards`;
    });
}

/**
 * Apply animation with computed delay to element
 * @param {Element} element - Element to animate
 * @param {string} animationName - Animation name
 * @param {Object} options - Animation options
 */
export function applyAnimation(element, animationName, options = {}) {
    const {
        duration = 'var(--anim-duration-normal)',
        easing = 'var(--anim-ease-out)',
        delay = 0,
    } = options;

    element.style.animation = `${animationName} ${duration} ${easing} ${delay}ms`;
}

/**
 * Remove animation from element
 * @param {Element} element - Element to stop animating
 */
export function removeAnimation(element) {
    element.style.animation = 'none';
}

/**
 * Wait for animation to complete
 * @param {Element} element - Element being animated
 * @returns {Promise} Resolves when animation completes
 */
export function waitForAnimationComplete(element) {
    return new Promise((resolve) => {
        const onAnimationEnd = () => {
            element.removeEventListener('animationend', onAnimationEnd);
            resolve();
        };
        element.addEventListener('animationend', onAnimationEnd);
    });
}

/**
 * Trigger CSS transition on element
 * @param {Element} element - Element to transition
 * @param {Object} fromStyles - Starting styles
 * @param {Object} toStyles - Ending styles
 * @param {Object} options - Transition options
 */
export function transitionElement(element, fromStyles, toStyles, options = {}) {
    const {
        duration = 'var(--anim-duration-normal)',
        easing = 'var(--anim-ease-in-out)',
    } = options;

    // Apply starting styles
    Object.assign(element.style, fromStyles);

    // Force reflow to ensure transition applies
    element.offsetHeight;

    // Set transition
    element.style.transition = `all ${duration} ${easing}`;

    // Apply ending styles
    setTimeout(() => {
        Object.assign(element.style, toStyles);
    }, 10);

    return waitForTransitionComplete(element);
}

/**
 * Wait for transition to complete
 * @param {Element} element - Element being transitioned
 * @returns {Promise} Resolves when transition completes
 */
export function waitForTransitionComplete(element) {
    return new Promise((resolve) => {
        const onTransitionEnd = () => {
            element.removeEventListener('transitionend', onTransitionEnd);
            resolve();
        };
        element.addEventListener('transitionend', onTransitionEnd);
        
        // Fallback timeout in case transitionend doesn't fire
        setTimeout(resolve, 1000);
    });
}

/**
 * Set CSS variable on element or root
 * @param {string} varName - Variable name (with or without --)
 * @param {string} value - Value to set
 * @param {Element} element - Element to set variable on (default: root)
 */
export function setCSSVar(varName, value, element = null) {
    const cleanName = varName.startsWith('--') ? varName : `--${varName}`;
    const target = element || document.documentElement;
    target.style.setProperty(cleanName, value);
}

/**
 * Create progress animation on element (e.g., progress bar)
 * @param {Element} element - Element to animate
 * @param {number} fromPercent - Starting percentage (0-100)
 * @param {number} toPercent - Ending percentage (0-100)
 * @param {Object} options - Animation options
 */
export function animateProgress(element, fromPercent, toPercent, options = {}) {
    const {
        duration = 'var(--anim-duration-veryslow)',
        easing = 'var(--anim-ease-in-out)',
    } = options;

    element.style.setProperty('--progress-width', `${fromPercent}%`);
    
    // Force reflow
    element.offsetHeight;
    
    element.style.transition = `width ${duration} ${easing}`;
    element.style.setProperty('--progress-width', `${toPercent}%`);
}

/**
 * Bounce animation on element (e.g., notification badge)
 * @param {Element} element - Element to bounce
 * @param {Object} options - Animation options
 */
export function bouncElement(element, options = {}) {
    const {
        duration = 'var(--anim-duration-fast)',
        scale = 1.2,
    } = options;

    element.style.animation = `scaleInBounce ${duration}`;
}

/**
 * Pulse animation on element (e.g., loading state)
 * @param {Element} element - Element to pulse
 * @param {boolean} enable - Enable or disable
 */
export function togglePulseAnimation(element, enable = true) {
    if (enable) {
        element.classList.add('animate-pulse');
    } else {
        element.classList.remove('animate-pulse');
    }
}

/**
 * Apply loading spinner animation to element
 * @param {Element} element - Element to spin
 */
export function showLoadingSpinner(element) {
    element.classList.add('animate-spin');
}

/**
 * Remove loading spinner animation
 * @param {Element} element - Element to stop spinning
 */
export function hideLoadingSpinner(element) {
    element.classList.remove('animate-spin');
}

/**
 * Animate element entrance with cascade effect
 * @param {NodeList|Element[]} elements - Elements to animate
 * @param {string} animationType - Type of animation (fade, slide, scale)
 * @param {Object} options - Animation options
 */
export function cascadeEntrance(elements, animationType = 'fade', options = {}) {
    const animations = {
        fade: 'fadeInUp',
        slide: 'slideInFromLeft',
        scale: 'scaleIn',
    };

    const animationName = animations[animationType] || animations.fade;
    const { staggerDelay = 80, baseDelay = 0 } = options;

    applyStaggeredAnimation(elements, animationName, {
        duration: 'var(--anim-duration-normal)',
        easing: 'var(--anim-ease-out)',
        staggerDelay,
        baseDelay,
    });
}

/**
 * Create a shimmer loading effect on element
 * @param {Element} element - Element to shimmer
 * @param {boolean} enable - Enable or disable
 */
export function toggleShimmerEffect(element, enable = true) {
    if (enable) {
        const gradient = `linear-gradient(
            90deg,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.1) 50%,
            rgba(255, 255, 255, 0) 100%
        )`;

        element.style.backgroundImage = gradient;
        element.style.backgroundSize = '1000px 100%';
        element.style.animation = `shimmer 2s infinite`;
    } else {
        element.style.animation = 'none';
        element.style.backgroundImage = 'none';
    }
}

/**
 * Add glow effect to element on focus/hover
 * @param {Element} element - Element to add glow to
 * @param {boolean} enable - Enable or disable
 */
export function toggleGlowEffect(element, enable = true) {
    if (enable) {
        element.classList.add('animate-glow-pulse');
    } else {
        element.classList.remove('animate-glow-pulse');
    }
}

/**
 * Utility: Check if reduced motion is preferred
 * @returns {boolean}
 */
export function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Respect user motion preferences in animation configs
 * @param {Object} config - Animation configuration
 * @returns {Object} Modified configuration
 */
export function respectMotionPreferences(config = {}) {
    if (prefersReducedMotion()) {
        return {
            ...config,
            duration: 'var(--anim-duration-fast)',
            staggerDelay: 0,
            baseDelay: 0,
        };
    }
    return config;
}
