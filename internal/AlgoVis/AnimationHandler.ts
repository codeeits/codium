class AnimationHandler {
    private animations: Array<[(t: number) => boolean, start_frame: number, duration: number]>;
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
        console.log("Current frame count is" + this.frameCount)
        console.log(this.animations)
        this.animations = this.animations.filter(([animation, start_frame, duration]) => {
            if (this.frameCount >= start_frame && this.frameCount < start_frame + duration) {
                const isComplete = this.RunAnimation(animation, duration, this.frameCount - start_frame);
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
     * @constructor
     */
    ScheduleAnimation(animation: (t: number) => boolean, frame: number, duration: number): void {
        this.animations.push([animation, frame, duration]);
        if (frame >= this.lastFrame) {
            this.lastFrame = frame + duration;
        }
    }

    ScheduleAnimationInSeconds(animation: () => boolean, frame: number, duration: number): void {
        this.animations.push([animation, frame, Math.floor(duration / 16)]);
        if (frame > this.lastFrame) {
            this.lastFrame = frame + Math.floor(duration / 16);
        }
    }

    ScheduleAnimationAfterPrevious(animation: () => boolean, duration: number): void {
        console.log("Received schedule request for animation after previous")
        console.log([this.lastFrame, duration]);
        this.animations.push([animation, this.lastFrame, duration]);
        this.lastFrame += duration;
    }

    ScheduleAnimationAfterPreviousInSeconds(animation: () => boolean, duration: number): void {
        this.animations.push([animation, this.lastFrame, Math.floor(duration / 16)]);
        this.lastFrame += Math.floor(duration / 16);
    }

    ScheduleAnimationAfterPreviousWithDelay(animation: () => boolean, delay: number, duration: number): void {
        this.animations.push([animation, this.lastFrame + delay, duration]);
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