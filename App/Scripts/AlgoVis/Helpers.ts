import {Container, Viewport} from "./Container.js"
import { AnimationHandler, COMMON_ANIMATIONS, COMMON_ANIMATION_EASING_FUNCTIONS } from "./AnimationHandler.js"

export default class AnimHelpers {
    static animator: AnimationHandler | null = null;
    static COMMON_ANIMATIONS = COMMON_ANIMATIONS;
    static COMMON_ANIMATION_EASING_FUNCTIONS = COMMON_ANIMATION_EASING_FUNCTIONS;

    static SetAnimator(animationHandler: AnimationHandler): void {
        AnimHelpers.animator = animationHandler;
    }

    static NewBoxFromTemplate(template: HTMLElement, parent: Container, width: number, height: number, start_x:number, start_y:number): Container {
        let templateCopy = template.cloneNode(true) as HTMLDivElement;
        let container = new Container(width, height, start_x, start_y, templateCopy);
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
        AnimHelpers.animator.ScheduleAnimationAfterPrevious((deltaTime) => {
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

        AnimHelpers.animator.ScheduleAnimationAfterPrevious((deltaTime) => {
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
        AnimHelpers.animator.ScheduleAnimationAfterPrevious((deltaTime) => {
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
        AnimHelpers.animator.ScheduleAnimationAfterPrevious((deltaTime) => {
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

export class InitHelpers {
    /*
    * This function sets up the necessary event handlers on the specified viewport element to enable interactive movement based on user input.
    * @param view - A viewport element (extension of the Container class) that will handle rendering and movement based on user interactions.
    * Remember to set view as the default viewport for your root container, and ensure that the element in your HTML that will represent the "viewable" portion of the animation has the id "AlgoVis-Viewport" for this function to work correctly.
    * @return A function that can be called to schedule a render of the viewport, useful for triggering re-renders after programmatic changes to the view.
     */
    static InitViewport(view: Viewport): () => void {
        let prev = {x: 0, y: 0};
        let pendingRender = false;
        let dragging = false;
        let activePointerID = null;
        let viewPortElement = document.getElementById("AlgoVis-Viewport")

        function scheduleRender() {
            if (pendingRender) return;
            pendingRender = true;
            requestAnimationFrame(() => {
                view.render();
                pendingRender = false;
            });
        }

        viewPortElement.addEventListener("pointerdown", (e) => {
            if (e.button && e.button !== 0) return;
            e.preventDefault();
            dragging = true;
            activePointerID = e.pointerId;
            prev.x = e.clientX;
            prev.y = e.clientY;

            try {
                viewPortElement.setPointerCapture(activePointerID);
            } catch (w) {
                console.warn("Failed to capture pointer:", w);
            }

            viewPortElement.style.cursor = "none";
        })

        viewPortElement.addEventListener("pointermove", (e) => {
            if (!dragging || e.pointerId !== activePointerID) return;
            e.preventDefault(); // prevents default behaviors while dragging
            const dx = e.clientX - prev.x;
            const dy = e.clientY - prev.y;
            prev.x = e.clientX
            prev.y = e.clientY;

            // update your logical view position
            view.move(-dx, -dy);

            // schedule a single rAF render per frame (throttles heavy rendering)
            scheduleRender();
        });

        viewPortElement.addEventListener("pointerover", (e) => {
            if (dragging) {
                viewPortElement.style.cursor = "none";
            } else {
                viewPortElement.style.cursor = "move";
            }
        })

        function stopDrag(e) {
            if (!dragging) return;
            // release pointer capture
            try {
                viewPortElement.releasePointerCapture(activePointerID);
            } catch (err) { /* ignore */
            }
            dragging = false;
            activePointerID = null;
            viewPortElement.style.cursor = "";
            // final render to ensure state is correct
            view.render();
        }

        viewPortElement.addEventListener("pointerup", stopDrag);
        viewPortElement.addEventListener("pointercancel", stopDrag);

        return scheduleRender
    }

    /*
    * Initializes a vector that can be used in any of the AnimHelpers animations, based on the provided values and templates.
    * @param values - An array of numbers that will determine the heights of the elements in the vector, as well as the text content if elementTextComponentTemplate is provided.
    * @param vectorTemplate - An HTMLDivElement that will serve as the template for the overall vector container.
    * @param elementTemplate - An HTMLDivElement that will serve as the template for each individual element in the vector.
    * @param elementTextComponentTemplate - An optional HTMLSpanElement that will serve as the template for the text component of each element in the vector. If provided, each element will display its corresponding value from the values array as text.
    * @param parent - The Container to which the initialized vector will be added as a child.
     * @return An array of Containers representing the individual elements of the vector, which can be used in AnimHelpers animations.
     */
    static InitSortVector(values: number[], vectorTemplate: HTMLDivElement, elementTemplate: HTMLDivElement, elementTextComponentTemplate: HTMLSpanElement | null, parent: Container): {container: Container, value: number}[] {
        let vector:Container = AnimHelpers.NewBoxFromTemplate(vectorTemplate, parent, parent.width, parent.height, parent.rel_x, parent.rel_y);
        let containers = AnimHelpers.NewVectorFromTemplateWithDifferentHeights(elementTemplate, vector, vector.width, values, vector.rel_x, vector.rel_y, values.length, 2)
        if (elementTextComponentTemplate) {
            for (let container of containers) {
                let textComponent = elementTextComponentTemplate.cloneNode(true) as HTMLSpanElement;
                textComponent.innerText = values[containers.indexOf(container)].toString();
                container.setElement(textComponent);
            }
        }
        return containers.map((container, index) => ({container: container, value: values[index]}));
    }

    static InitRandSortVector(n: number, vectorTemplate: HTMLDivElement, elementTemplate: HTMLDivElement, elementTextComponentTemplate: HTMLSpanElement | null, parent: Container): {container: Container, value: number}[] {
        let vector:Container = AnimHelpers.NewBoxFromTemplate(vectorTemplate, parent, parent.width, parent.height, parent.rel_x, parent.rel_y);
        let returnedArray: {container: Container, value: number}[] = [];
        for (let i = 0; i < n; i++) {
            let rand = Math.floor(Math.random() * n) + 1;

            let size_y = (rand / n) * vector.height;
            let size_X = (vector.width / n) * 0.8;

            let container = AnimHelpers.NewBoxFromTemplate(elementTemplate, vector, size_X, size_y, i * (vector.width / n), vector.height - size_y);
            let textComponent = elementTextComponentTemplate.cloneNode(true) as HTMLSpanElement;
            textComponent.innerText = rand.toString();
            container.setElement(textComponent);
            returnedArray.push({container: container, value: rand});
        }
        return returnedArray;
    }
}