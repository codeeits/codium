var AnimationHandler = /** @class */ (function () {
    function AnimationHandler() {
        //Capping the animation at 60 FPS
        this.timerId = null;
        this.frameCount = 0;
        this.running = false;
        this.lastFrame = 0;
        this.animations = [];
        this.lastFrame = 0;
    }
    AnimationHandler.prototype.Update = function () {
        var _this = this;
        if (!this.running) {
            return;
        }
        this.frameCount++;
        this.animations = this.animations.filter(function (_a) {
            var animation = _a[0], start_frame = _a[1], duration = _a[2], callback = _a[3];
            if (_this.frameCount >= start_frame && _this.frameCount <= start_frame + duration) {
                var isComplete = _this.RunAnimation(animation, duration, _this.frameCount - start_frame);
                if (isComplete) {
                    callback();
                }
                return !isComplete;
            }
            return _this.frameCount < start_frame + duration;
        });
        if (this.animations.length === 0) {
            this.Stop();
        }
    };
    /**
     * Schedules an animation to be run at a specific frame for a specific duration.
     * @param animation - a lerp function that takes in a parameter t
     * @param frame
     * @param duration - duration in frames at 60 FPS
     * @param callback
     * @constructor
     */
    AnimationHandler.prototype.ScheduleAnimation = function (animation, frame, duration, callback) {
        this.animations.push([animation, frame, duration, callback]);
        if (frame >= this.lastFrame) {
            this.lastFrame = frame + duration;
        }
    };
    AnimationHandler.prototype.ScheduleAnimationInSeconds = function (animation, frame, duration, callback) {
        this.animations.push([animation, frame, Math.floor(duration / 16), callback]);
        if (frame > this.lastFrame) {
            this.lastFrame = frame + Math.floor(duration / 16);
        }
    };
    AnimationHandler.prototype.ScheduleAnimationAfterPrevious = function (animation, duration, callback) {
        this.animations.push([animation, this.lastFrame, duration, callback]);
        this.lastFrame += duration;
    };
    AnimationHandler.prototype.ScheduleAnimationAfterPreviousInSeconds = function (animation, duration, callback) {
        this.animations.push([animation, this.lastFrame, Math.floor(duration / 16), callback]);
        this.lastFrame += Math.floor(duration / 16);
    };
    AnimationHandler.prototype.ScheduleAnimationAfterPreviousWithDelay = function (animation, delay, duration, callback) {
        this.animations.push([animation, this.lastFrame + delay, duration, callback]);
        this.lastFrame += delay + duration;
    };
    AnimationHandler.prototype.ScheduleAnimationWithPrevious = function (animation, duration, callback) {
        this.animations.push([animation, this.lastFrame - duration, duration, callback]);
    };
    AnimationHandler.prototype.Start = function () {
        var _this = this;
        this.running = true;
        this.timerId = window.setInterval(function () { return _this.Update(); }, 16);
        this.frameCount = 0;
    };
    AnimationHandler.prototype.Stop = function () {
        this.running = false;
        if (this.timerId !== null) {
            window.clearInterval(this.timerId);
            this.timerId = null;
        }
    };
    /**
     * Runs the provided animation function.
     * Can be used to immediately run an animation without messing with the timer and whatnot.
     * @param animation
     * @param duration
     * @param progress
     * @constructor
     */
    AnimationHandler.prototype.RunAnimation = function (animation, duration, progress) {
        return animation(progress / duration);
    };
    return AnimationHandler;
}());
var COMMON_ANIMATION_EASING_FUNCTIONS = {
    Linear: function (t) {
        return t;
    },
    EaseInOutQuad: function (t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    },
    EaseInOutCubic: function (t) {
        return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
    },
    EaseInCubic: function (t) {
        return t * t * t;
    },
    EaseOutCubic: function (t) {
        return (--t) * t * t + 1;
    }
};
var COMMON_ANIMATIONS = {
    FadeIn: function (element, easingFunction) {
        return function (t) {
            var easedT = easingFunction(t);
            element.style.opacity = easedT.toString();
            return t >= 1;
        };
    },
    FadeOut: function (element, easingFunction) {
        return function (t) {
            var easedT = easingFunction(t);
            element.style.opacity = (1 - easedT).toString();
            return t >= 1;
        };
    },
    LinearMove: function (element, startX, startY, endX, endY) {
        return function (t) {
            var currentX = startX + (endX - startX) * t;
            var currentY = startY + (endY - startY) * t;
            element.style.transform = "translate(".concat(currentX, "px, ").concat(currentY, "px)");
            return t >= 1;
        };
    },
    LinearSwap: function (elementA, elementB) {
        var rectA = elementA.getBoundingClientRect();
        var rectB = elementB.getBoundingClientRect();
        var deltaX = rectB.left - rectA.left;
        var deltaY = rectB.top - rectA.top;
        return function (t) {
            var currentXA = deltaX * t;
            var currentYA = deltaY * t;
            var currentXB = -deltaX * t;
            var currentYB = -deltaY * t;
            elementA.style.transform = "translate(".concat(currentXA, "px, ").concat(currentYA, "px)");
            elementB.style.transform = "translate(".concat(currentXB, "px, ").concat(currentYB, "px)");
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
    LinearInterpolation: function (startValue, endValue, callback) {
        return function (t) {
            var currentValue = startValue + (endValue - startValue) * t;
            callback(currentValue);
            return Math.abs(t - 1) < 0.0001;
        };
    }
};
