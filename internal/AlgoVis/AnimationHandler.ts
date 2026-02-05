class AnimationHandler {
    private animations: Array<[(t: number) => boolean, start_frame: number, duration: number, callback: (() => boolean)]>;
    //Capping the animation at 60 FPS
    private timerId: number | null = null;
    private frameCount: number = 0;
    public running: boolean = false;
    private lastFrame: number = 0;

    private Update(): void {
        if (!this.running) {
            return;
        }
        this.frameCount++;
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
        if (this.animations.length === 0) {
            this.Stop();
        }
    }

    constructor() {
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
    ScheduleAnimation(animation: (t: number) => boolean, frame: number, duration: number, callback: () => boolean): void {
        this.animations.push([animation, frame, duration, callback]);
        if (frame >= this.lastFrame) {
            this.lastFrame = frame + duration;
        }
    }

    ScheduleAnimationInSeconds(animation: (t: number) => boolean, frame: number, duration: number, callback: () => boolean): void {
        this.animations.push([animation, frame, Math.floor(duration / 16), callback]);
        if (frame > this.lastFrame) {
            this.lastFrame = frame + Math.floor(duration / 16);
        }
    }

    ScheduleAnimationAfterPrevious(animation: (t: number) => boolean, duration: number, callback: () => boolean): void {
        this.animations.push([animation, this.lastFrame, duration, callback]);
        this.lastFrame += duration;
    }

    ScheduleAnimationAfterPreviousInSeconds(animation: (t: number) => boolean, duration: number, callback: () => boolean): void {
        this.animations.push([animation, this.lastFrame, Math.floor(duration / 16), callback]);
        this.lastFrame += Math.floor(duration / 16);
    }

    ScheduleAnimationAfterPreviousWithDelay(animation: (t: number) => boolean, delay: number, duration: number, callback: () => boolean): void {
        this.animations.push([animation, this.lastFrame + delay, duration, callback]);
        this.lastFrame += delay + duration;
    }

    Start(): void {
        this.running = true;
        this.timerId = window.setInterval(() => this.Update(), 16);
        this.frameCount = 0;
    }

    Stop(): void {
        this.running = false;
        if (this.timerId !== null) {
            window.clearInterval(this.timerId);
            this.timerId = null;
        }
    }

    /**
     * Runs the provided animation function.
     * Can be used to immediately run an animation without messing with the timer and whatnot.
     * @param animation
     * @param duration
     * @param progress
     * @constructor
     */
    RunAnimation(animation: (t: number) => boolean, duration: number, progress: number) : boolean {
        return animation(progress / duration);
    }
}

const COMMON_ANIMATION_EASING_FUNCTIONS = {
    Linear: (t: number): number => {
        return t;
    },
    EaseInOutQuad: (t: number): number => {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    },
    EaseInOutCubic: (t: number): number => {
        return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
    }
}

const COMMON_ANIMATIONS = {
    FadeIn: (element: HTMLElement, easingFunction: (t: number) => number) => {
        return (t: number): boolean => {
            const easedT = easingFunction(t);
            element.style.opacity = easedT.toString();
            return t >= 1;
        }
    },
    FadeOut: (element: HTMLElement, easingFunction: (t: number) => number) => {
        return (t: number): boolean => {
            const easedT = easingFunction(t);
            element.style.opacity = (1 - easedT).toString();
            return t >= 1;
        }
    },
    LinearMove: (element: HTMLElement, startX: number, startY: number, endX: number, endY: number) => {
        return (t: number): boolean => {
            const currentX = startX + (endX - startX) * t;
            const currentY = startY + (endY - startY) * t;
            element.style.transform = `translate(${currentX}px, ${currentY}px)`;
            return t >= 1;
        }
    },
    LinearSwap: (elementA: HTMLElement, elementB: HTMLElement) => {
        const rectA = elementA.getBoundingClientRect();
        const rectB = elementB.getBoundingClientRect();
        const deltaX = rectB.left - rectA.left;
        const deltaY = rectB.top - rectA.top;

        return (t: number): boolean => {
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
        }
    },
    LinearInterpolation: (startValue: number, endValue: number, callback: (value: number) => void) => {
        return (t: number): boolean => {
            const currentValue = startValue + (endValue - startValue) * t;
            callback(currentValue);
            return Math.abs(t - 1) < 0.0001;
        }
    }
}