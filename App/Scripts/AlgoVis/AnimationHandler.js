export class AnimationHandler {
    Update() {
        if (!this.running) {
            return;
        }
        this.frameCount++;
        this.renderAnimations();
        if (this.animations.length === 0) {
            this.Stop();
        }
    }
    renderAnimations() {
        this.animations = this.animations.filter(([animation, start_frame, duration, callback]) => {
            if (this.frameCount >= start_frame && this.frameCount <= start_frame + duration) {
                const isComplete = this.RunAnimation(animation, duration, this.frameCount - start_frame);
                if (isComplete) {
                    callback();
                }
                return !isComplete;
            }
            return this.frameCount < start_frame + duration;
        });
    }
    constructor() {
        //Capping the animation at 60 FPS
        this.timerId = null;
        this.frameCount = 0;
        this.running = false;
        this.lastFrame = 0;
        this.animations = [];
        this.lastFrame = 0;
    }
    /**
     * Schedules an animation to be run at a specific frame for a specific duration.
     * @param animation - a lerp function that takes in a parameter t
     * @param frame
     * @param duration - duration in frames at 60 FPS
     * @param callback
     * @constructor
     */
    ScheduleAnimation(animation, frame, duration, callback) {
        this.animations.push([animation, frame, duration, callback]);
        if (frame >= this.lastFrame) {
            this.lastFrame = frame + duration;
        }
    }
    ScheduleAnimationInSeconds(animation, frame, duration, callback) {
        this.animations.push([animation, frame, Math.floor(duration / 16), callback]);
        if (frame > this.lastFrame) {
            this.lastFrame = frame + Math.floor(duration / 16);
        }
    }
    ScheduleAnimationAfterPrevious(animation, duration, callback) {
        this.animations.push([animation, this.lastFrame, duration, callback]);
        this.lastFrame += duration;
    }
    ScheduleAnimationAfterPreviousInSeconds(animation, duration, callback) {
        this.animations.push([animation, this.lastFrame, Math.floor(duration / 16), callback]);
        this.lastFrame += Math.floor(duration / 16);
    }
    ScheduleAnimationAfterPreviousWithDelay(animation, delay, duration, callback) {
        this.animations.push([animation, this.lastFrame + delay, duration, callback]);
        this.lastFrame += delay + duration;
    }
    ScheduleAnimationWithPrevious(animation, duration, callback) {
        this.animations.push([animation, this.lastFrame - duration, duration, callback]);
    }
    Start() {
        this.running = true;
        this.timerId = window.setInterval(() => this.Update(), 16);
        this.frameCount = 0;
    }
    Pause() {
        if (!this.running) {
            this.Start();
        }
        this.running = false;
    }
    Step() {
        this.frameCount++;
        this.renderAnimations();
    }
    Stop() {
        this.running = false;
        if (this.timerId !== null) {
            window.clearInterval(this.timerId);
            this.timerId = null;
        }
        this.animations = [];
        this.lastFrame = 0;
    }
    /**
     * Runs the provided animation function.
     * Can be used to immediately run an animation without messing with the timer and whatnot.
     * @param animation
     * @param duration
     * @param progress
     * @constructor
     */
    RunAnimation(animation, duration, progress) {
        return animation(progress / duration);
    }
}
export const COMMON_ANIMATION_EASING_FUNCTIONS = {
    Linear: (t) => {
        return t;
    },
    EaseInOutQuad: (t) => {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    },
    EaseInOutCubic: (t) => {
        return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
    },
    EaseInCubic: (t) => {
        return t * t * t;
    },
    EaseOutCubic: (t) => {
        return (--t) * t * t + 1;
    }
};
export const COMMON_ANIMATIONS = {
    FadeIn: (element, easingFunction) => {
        return (t) => {
            const easedT = easingFunction(t);
            element.style.opacity = easedT.toString();
            return t >= 1;
        };
    },
    FadeOut: (element, easingFunction) => {
        return (t) => {
            const easedT = easingFunction(t);
            element.style.opacity = (1 - easedT).toString();
            return t >= 1;
        };
    },
    LinearMove: (element, startX, startY, endX, endY) => {
        return (t) => {
            const currentX = startX + (endX - startX) * t;
            const currentY = startY + (endY - startY) * t;
            element.style.transform = `translate(${currentX}px, ${currentY}px)`;
            return t >= 1;
        };
    },
    LinearSwap: (elementA, elementB) => {
        const rectA = elementA.getBoundingClientRect();
        const rectB = elementB.getBoundingClientRect();
        const deltaX = rectB.left - rectA.left;
        const deltaY = rectB.top - rectA.top;
        return (t) => {
            const currentXA = deltaX * t;
            const currentYA = deltaY * t;
            const currentXB = -deltaX * t;
            const currentYB = -deltaY * t;
            elementA.style.transform = `translate(${currentXA}px, ${currentYA}px)`;
            elementB.style.transform = `translate(${currentXB}px, ${currentYB}px)`;
            if (t >= 1) {
                // Reset transforms after swap
                elementA.style.transform = '';
                elementB.style.transform = '';
                return true;
            }
            return false;
        };
    },
    // A generic linear interpolation function that can be used for any numeric property.
    // Returns a function that takes in a parameter for time and calls the callback with the interpolated value.
    // The function returns true when the animation is complete.
    LinearInterpolation: (startValue, endValue, callback) => {
        return (t) => {
            const currentValue = startValue + (endValue - startValue) * t;
            callback(currentValue);
            return Math.abs(t - 1) < 0.0001;
        };
    }
};
