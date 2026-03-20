import { Container } from "./Container.js"
import { AnimationHandler, COMMON_ANIMATIONS, COMMON_ANIMATION_EASING_FUNCTIONS } from "./AnimationHandler.js"

export default class ExtraHelpers {
    static animator: AnimationHandler | null = null;
    static COMMON_ANIMATIONS = COMMON_ANIMATIONS;
    static COMMON_ANIMATION_EASING_FUNCTIONS = COMMON_ANIMATION_EASING_FUNCTIONS;

    static SetAnimator(animationHandler: AnimationHandler): void {
        ExtraHelpers.animator = animationHandler;
    }

    static NewBoxFromTemplate(template: HTMLElement, parent: Container, width: number, height: number, start_x:number, start_y:number): Container {
        let container = new Container(width, height, start_x, start_y, template);
        parent.addChild(container);
        return container;
    }

    static NewCircleFromTemplate(template: HTMLElement, parent: Container, width: number, start_x: number, start_y: number): Container {
        template.style.borderRadius = "50%";
        let container = new Container(width, width, start_x, start_y, template);
        parent.addChild(container);
        return container;
    }

    static NewVectorFromTemplateWithDifferentHeights(template: HTMLElement, parent: Container, width: number, height: number[], start_x: number, start_y: number, n: number, spacing: number = 0): Container[] {
        let containers: Container[] = [];
        let individualWidth = width / n;
        for (let i = 0; i < n; i++) {
            let container = new Container(individualWidth, height[i], start_x + (individualWidth + 2*spacing) * i, start_y, template);
            parent.addChild(container);
            containers.push(container);
        }

        return containers;
    }

    static NewVectorFromTemplate(template: HTMLElement, parent: Container, width: number, height: number, start_x: number, start_y: number, n: number, spacing: number = 0): Container[] {
        let containers: Container[] = [];
        let individualWidth = width / n;
        for (let i = 0; i < n; i++) {
            let container = new Container(individualWidth, height, start_x + (individualWidth + 2*spacing) * i, start_y, template);
            parent.addChild(container);
            containers.push(container);
        }

        return containers;
    }

    /*
        * Swaps the positions of two containers with an animation.
        * container1 - the first container to swap
        * container2 - the second container to swap
        * hook_end - a callback function that is called after the animation is complete
        * frame_speed - the duration of the animation in frames (at 60 FPS)
        * renderer - a function that re-renders the scene after each frame of the animation
    */
    static SwapContainers(container1: Container, container2: Container, hook_end: () => any, frame_speed: number, renderer: () => any): void {
        let startX1 = container1.rel_x;
        let startX2 = container2.rel_x
        let startY1 = container1.rel_y;
        let startY2 = container2.rel_y;

        this.animator.ScheduleAnimationAfterPrevious((deltaTime) => {
            COMMON_ANIMATIONS.LinearInterpolation(startX1, startX2, (v) => {
                container1.rel_x = v;
                renderer()
            })(COMMON_ANIMATION_EASING_FUNCTIONS.EaseInOutCubic(deltaTime));

            COMMON_ANIMATIONS.LinearInterpolation(startX2, startX1, (v) => {
                container2.rel_x = v;
                renderer()
            })(COMMON_ANIMATION_EASING_FUNCTIONS.EaseInOutCubic(deltaTime));

            COMMON_ANIMATIONS.LinearInterpolation(startY1, startY2, (v) => {
                container2.rel_y = v;
                renderer()
            })

            COMMON_ANIMATIONS.LinearInterpolation(startY2, startY1, (v) => {
                container2.rel_y = v;
                renderer()
            })

            return deltaTime >= 1.0;
        }, frame_speed, hook_end);
    }

    static ColorContainers(containers: Container[], color: string, hook_end: () => any, frame_speed: number, renderer: () => any): void {
        ExtraHelpers.animator.ScheduleAnimationAfterPrevious((deltaTime) => {
            containers.forEach(container => {
                container.template.style.backgroundColor = color;
            });
            renderer();
            return deltaTime >= 1.0;
        }, frame_speed, hook_end);
    }

    static HighlightContainers(containers: Container[], color: string, hook_end: () => any, frame_speed: number, renderer: () => any): void {
        let colors = containers.map(container => container.template.style.borderColor);
        let widths = containers.map(container => parseFloat(container.template.style.borderWidth));

        ExtraHelpers.animator.ScheduleAnimationAfterPrevious((deltaTime) => {
            containers.forEach(container => {
                container.template.style.borderColor = color;
                let currentWidth = parseFloat(container.template.style.borderWidth);
                COMMON_ANIMATIONS.LinearInterpolation(currentWidth, 1.5 * currentWidth, (v) => {
                    container.template.style.borderWidth = currentWidth.toString() + "px";
                    renderer()
                })(COMMON_ANIMATION_EASING_FUNCTIONS.EaseOutCubic(deltaTime));
            });
            renderer();
            return deltaTime >= 1.0;
        }, frame_speed, () => {
            containers.forEach(container => {
                container.template.style.borderColor = colors[containers.indexOf(container)];
                container.template.style.borderWidth = widths[containers.indexOf(container)].toString() + "px";
            });
            return hook_end();
        });
    }

    static SchedulePersonalAnimation(hook_end: () => any, frame_speed: number, renderer: () => any, tick_callback: () => any): void {
        ExtraHelpers.animator.ScheduleAnimationAfterPrevious((deltaTime) => {
            tick_callback();
            renderer();
            return deltaTime >= 1.0;
        }, frame_speed, hook_end);
    }

    static MoveContainer(container:Container, x: number, y: number, hook_end:() => any, frame_speed: number, renderer: () => any) :void {
        let startX = container.rel_x;
        let startY = container.rel_y;
        let endX = x
        let endY = y
        ExtraHelpers.animator.ScheduleAnimationAfterPrevious((deltaTime) => {
            COMMON_ANIMATIONS.LinearInterpolation(startX, endX, (v) => {
                container.rel_x = v
                renderer()
            })(COMMON_ANIMATION_EASING_FUNCTIONS.EaseInOutCubic(deltaTime));
            COMMON_ANIMATIONS.LinearInterpolation(startY, endY, (v) => {
                container.rel_y = v
                renderer()
            })(COMMON_ANIMATION_EASING_FUNCTIONS.EaseInOutCubic(deltaTime));

            return deltaTime >= 1.0;
        }, frame_speed, hook_end);
    }
}