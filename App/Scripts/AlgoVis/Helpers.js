"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("./Container.js");
require("./AnimationHandler.js");
var ExtraHelpers = /** @class */ (function () {
    function ExtraHelpers() {
    }
    ExtraHelpers.SetAnimator = function (animationHandler) {
        ExtraHelpers.animator = animationHandler;
    };
    ExtraHelpers.NewBoxFromTemplate = function (template, parent, width, height, start_x, start_y) {
        var container = new Container(width, height, start_x, start_y, template);
        parent.addChild(container);
        return container;
    };
    ExtraHelpers.NewCircleFromTemplate = function (template, parent, width, start_x, start_y) {
        template.style.borderRadius = "50%";
        var container = new Container(width, width, start_x, start_y, template);
        parent.addChild(container);
        return container;
    };
    ExtraHelpers.NewVectorFromTemplateWithDifferentHeights = function (template, parent, width, height, start_x, start_y, n, spacing) {
        if (spacing === void 0) { spacing = 0; }
        var containers = [];
        var individualWidth = width / n;
        for (var i = 0; i < n; i++) {
            var container = new Container(individualWidth, height[i], start_x + (individualWidth + 2 * spacing) * i, start_y, template);
            parent.addChild(container);
            containers.push(container);
        }
        return containers;
    };
    ExtraHelpers.NewVectorFromTemplate = function (template, parent, width, height, start_x, start_y, n, spacing) {
        if (spacing === void 0) { spacing = 0; }
        var containers = [];
        var individualWidth = width / n;
        for (var i = 0; i < n; i++) {
            var container = new Container(individualWidth, height, (individualWidth + 2 * spacing) * i, start_y, template);
            parent.addChild(container);
            containers.push(container);
        }
        return containers;
    };
    /*
        * Swaps the positions of two containers with an animation.
        * container1 - the first container to swap
        * container2 - the second container to swap
        * hook_end - a callback function that is called after the animation is complete
        * frame_speed - the duration of the animation in frames (at 60 FPS)
        * renderer - a function that re-renders the scene after each frame of the animation
    */
    ExtraHelpers.SwapContainers = function (container1, container2, hook_end, frame_speed, renderer) {
        var startX1 = container1.rel_x;
        var startX2 = container2.rel_x;
        this.animator.ScheduleAnimationAfterPrevious(function (deltaTime) {
            COMMON_ANIMATIONS.LinearInterpolation(startX1, startX2, function (v) {
                container1.rel_x = v;
                renderer();
            })(COMMON_ANIMATION_EASING_FUNCTIONS.EaseInOutCubic(deltaTime));
            COMMON_ANIMATIONS.LinearInterpolation(startX2, startX1, function (v) {
                container2.rel_x = v;
                renderer();
            })(COMMON_ANIMATION_EASING_FUNCTIONS.EaseInOutCubic(deltaTime));
            return deltaTime >= 1.0;
        }, frame_speed, hook_end);
    };
    ExtraHelpers.ColorContainers = function (containers, color, hook_end, frame_speed, renderer) {
        ExtraHelpers.animator.ScheduleAnimationAfterPrevious(function (deltaTime) {
            containers.forEach(function (container) {
                container.element.style.backgroundColor = color;
            });
            renderer();
            return deltaTime >= 1.0;
        }, frame_speed, hook_end);
    };
    ExtraHelpers.HighlightContainers = function (containers, color, hook_end, frame_speed, renderer) {
        var colors = containers.map(function (container) { return container.template.style.borderColor; });
        var widths = containers.map(function (container) { return parseFloat(container.template.style.borderWidth); });
        ExtraHelpers.animator.ScheduleAnimationAfterPrevious(function (deltaTime) {
            containers.forEach(function (container) {
                container.template.style.borderColor = color;
                var currentWidth = parseFloat(container.template.style.borderWidth);
                COMMON_ANIMATIONS.LinearInterpolation(currentWidth, 1.5 * currentWidth, function (v) {
                    container.template.style.borderWidth = currentWidth.toString() + "px";
                    renderer();
                })(COMMON_ANIMATION_EASING_FUNCTIONS.EaseOutCubic(deltaTime));
            });
            renderer();
            return deltaTime >= 1.0;
        }, frame_speed, function () {
            containers.forEach(function (container) {
                container.template.style.borderColor = colors[containers.indexOf(container)];
                container.template.style.borderWidth = widths[containers.indexOf(container)].toString() + "px";
            });
            return hook_end();
        });
    };
    ExtraHelpers.animator = null;
    return ExtraHelpers;
}());
exports.default = ExtraHelpers;
