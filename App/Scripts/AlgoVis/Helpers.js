import { Container, RootContainer, Viewport } from "./Container.js";
import { AnimationHandler, COMMON_ANIMATIONS, COMMON_ANIMATION_EASING_FUNCTIONS } from "./AnimationHandler.js";
import PrefabAnimations, { Settings } from "./Animations.js";
class AnimHelpers {
    static SetAnimator(animationHandler) {
        AnimHelpers.animator = animationHandler;
    }
    static NewBoxFromTemplate(template, parent, width, height, start_x, start_y) {
        let templateCopy = template.cloneNode(true);
        templateCopy.style.display = "unset";
        let container = new Container(width, height, start_x, start_y, templateCopy);
        if (templateCopy.children.length > 0) {
            for (let i = 0; i < templateCopy.children.length; i++) {
                let child = templateCopy.children[i];
                let childElement = this.NewBoxFromTemplate(child, container, child.clientWidth, child.clientHeight, child.offsetLeft, child.offsetTop);
                container.addChild(childElement);
            }
        }
        parent.addChild(container);
        return container;
    }
    static NewCircleFromTemplate(template, parent, width, start_x, start_y) {
        let templateCopy = template.cloneNode(true);
        templateCopy.style.borderRadius = "50%";
        templateCopy.style.display = "unset";
        let container = new Container(width, width, start_x, start_y, template);
        parent.addChild(container);
        return container;
    }
    static NewVectorFromTemplateWithDifferentHeights(template, parent, width, height, start_x, start_y, n, spacing = 0) {
        let containers = [];
        let individualWidth = width / n - 2 * spacing;
        for (let i = 0; i < n; i++) {
            let templateClone = template.cloneNode(true);
            let container = new Container(individualWidth, height[i], start_x + (individualWidth + 2 * spacing) * i, parent.height - height[i] + start_y, templateClone);
            parent.addChild(container);
            containers.push(container);
        }
        return containers;
    }
    static NewVectorFromTemplate(template, parent, width, height, start_x, start_y, n, spacing = 0) {
        let containers = [];
        let individualWidth = width / n;
        for (let i = 0; i < n; i++) {
            let container = new Container(individualWidth, height, start_x + (individualWidth + 2 * spacing) * i, start_y, template);
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
    static SwapContainers(container1, container2, hook_end, frame_speed, renderer) {
        let startX1 = container1.rel_x;
        let startX2 = container2.rel_x;
        let startY1 = container1.rel_y;
        let startY2 = container2.rel_y;
        this.animator.ScheduleAnimationAfterPrevious((deltaTime) => {
            COMMON_ANIMATIONS.LinearInterpolation(startX1, startX2, (v) => {
                container1.rel_x = v;
                renderer();
            })(COMMON_ANIMATION_EASING_FUNCTIONS.EaseInOutCubic(deltaTime));
            COMMON_ANIMATIONS.LinearInterpolation(startX2, startX1, (v) => {
                container2.rel_x = v;
                renderer();
            })(COMMON_ANIMATION_EASING_FUNCTIONS.EaseInOutCubic(deltaTime));
            COMMON_ANIMATIONS.LinearInterpolation(startY1, startY2, (v) => {
                container2.rel_y = v;
                renderer();
            });
            COMMON_ANIMATIONS.LinearInterpolation(startY2, startY1, (v) => {
                container2.rel_y = v;
                renderer();
            });
            return deltaTime >= 1.0;
        }, frame_speed, hook_end);
    }
    static ColorContainers(containers, color, hook_end, frame_speed, renderer) {
        AnimHelpers.animator.ScheduleAnimationAfterPrevious((deltaTime) => {
            containers.forEach(container => {
                container.template.style.backgroundColor = color;
            });
            renderer();
            return deltaTime >= 1.0;
        }, frame_speed, hook_end);
    }
    static HighlightContainers(containers, color, hook_end, frame_speed, renderer) {
        let colors = containers.map(container => container.template.style.borderColor);
        let widths = containers.map(container => parseFloat(container.template.style.borderWidth));
        AnimHelpers.animator.ScheduleAnimationAfterPrevious((deltaTime) => {
            containers.forEach(container => {
                container.template.style.borderColor = color;
                let currentWidth = parseFloat(container.template.style.borderWidth);
                COMMON_ANIMATIONS.LinearInterpolation(currentWidth, 1.5 * currentWidth, (v) => {
                    container.template.style.borderWidth = currentWidth.toString() + "px";
                    renderer();
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
    static SchedulePersonalAnimation(hook_end, frame_speed, renderer, tick_callback) {
        AnimHelpers.animator.ScheduleAnimationAfterPrevious((deltaTime) => {
            tick_callback();
            renderer();
            return deltaTime >= 1.0;
        }, frame_speed, hook_end);
    }
    static MoveContainer(container, x, y, hook_end, frame_speed, renderer) {
        let startX = container.rel_x;
        let startY = container.rel_y;
        let endX = x;
        let endY = y;
        AnimHelpers.animator.ScheduleAnimationAfterPrevious((deltaTime) => {
            COMMON_ANIMATIONS.LinearInterpolation(startX, endX, (v) => {
                container.rel_x = v;
                renderer();
            })(COMMON_ANIMATION_EASING_FUNCTIONS.EaseInOutCubic(deltaTime));
            COMMON_ANIMATIONS.LinearInterpolation(startY, endY, (v) => {
                container.rel_y = v;
                renderer();
            })(COMMON_ANIMATION_EASING_FUNCTIONS.EaseInOutCubic(deltaTime));
            return deltaTime >= 1.0;
        }, frame_speed, hook_end);
    }
}
AnimHelpers.animator = null;
AnimHelpers.COMMON_ANIMATIONS = COMMON_ANIMATIONS;
AnimHelpers.COMMON_ANIMATION_EASING_FUNCTIONS = COMMON_ANIMATION_EASING_FUNCTIONS;
export default AnimHelpers;
export class Main {
    /*
    * This function sets up the necessary event handlers on the specified viewport element to enable interactive movement based on user input.
    * @param view - A viewport element (extension of the Container class) that will handle rendering and movement based on user interactions.
    * Remember to set view as the default viewport for your root container, and ensure that the element in your HTML that will represent the "viewable" portion of the animation has the id "AlgoVis-Viewport" for this function to work correctly.
    * @return A function that can be called to schedule a render of the viewport, useful for triggering re-renders after programmatic changes to the view.
     */
    static InitViewport(view) {
        let prev = { x: 0, y: 0 };
        let pendingRender = false;
        let dragging = false;
        let activePointerID = null;
        let viewPortElement = document.getElementById("AlgoVis-Viewport");
        function scheduleRender() {
            if (pendingRender)
                return;
            pendingRender = true;
            requestAnimationFrame(() => {
                view.render();
                pendingRender = false;
            });
        }
        viewPortElement.addEventListener("pointerdown", (e) => {
            if (e.button && e.button !== 0)
                return;
            e.preventDefault();
            dragging = true;
            activePointerID = e.pointerId;
            prev.x = e.clientX;
            prev.y = e.clientY;
            try {
                viewPortElement.setPointerCapture(activePointerID);
            }
            catch (w) {
                console.warn("Failed to capture pointer:", w);
            }
            viewPortElement.style.cursor = "none";
        });
        viewPortElement.addEventListener("pointermove", (e) => {
            if (!dragging || e.pointerId !== activePointerID)
                return;
            e.preventDefault(); // prevents default behaviors while dragging
            const dx = e.clientX - prev.x;
            const dy = e.clientY - prev.y;
            prev.x = e.clientX;
            prev.y = e.clientY;
            // update your logical view position
            view.move(-dx, -dy);
            // schedule a single rAF render per frame (throttles heavy rendering)
            scheduleRender();
        });
        viewPortElement.addEventListener("pointerover", (e) => {
            if (dragging) {
                viewPortElement.style.cursor = "none";
            }
            else {
                viewPortElement.style.cursor = "move";
            }
        });
        function stopDrag(e) {
            if (!dragging)
                return;
            // release pointer capture
            try {
                viewPortElement.releasePointerCapture(activePointerID);
            }
            catch (err) { /* ignore */
            }
            dragging = false;
            activePointerID = null;
            viewPortElement.style.cursor = "";
            // final render to ensure state is correct
            view.render();
        }
        viewPortElement.addEventListener("pointerup", stopDrag);
        viewPortElement.addEventListener("pointercancel", stopDrag);
        this.scheduleRender = scheduleRender;
        return scheduleRender;
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
    static InitSortVector(values, vectorTemplate, elementTemplate, elementTextComponentTemplate, parent, spacing = 2) {
        let n = 0;
        for (let value of values) {
            if (value > n) {
                n = value;
            }
        }
        let vector = AnimHelpers.NewBoxFromTemplate(vectorTemplate, parent, parent.width, parent.height, parent.rel_x, parent.rel_y);
        let containers = AnimHelpers.NewVectorFromTemplateWithDifferentHeights(elementTemplate, vector, vector.width, values.map(value => (value / n) * vector.height), vector.rel_x, vector.rel_y, values.length, spacing);
        if (elementTextComponentTemplate) {
            for (let container of containers) {
                let textComponent = elementTextComponentTemplate.cloneNode(true);
                textComponent.innerText = values[containers.indexOf(container)].toString();
                container.setElement(textComponent);
            }
        }
        return containers.map((container, index) => ({ container: container, value: values[index] }));
    }
    static InitRandSortVector(n, vectorTemplate, elementTemplate, elementTextComponentTemplate, parent) {
        let vector = AnimHelpers.NewBoxFromTemplate(vectorTemplate, parent, parent.width, parent.height, parent.rel_x, parent.rel_y);
        let returnedArray = [];
        for (let i = 0; i < n; i++) {
            let rand = Math.floor(Math.random() * n) + 1;
            let size_y = (rand / n) * vector.height;
            let size_X = (vector.width / n) * 0.8;
            let container = AnimHelpers.NewBoxFromTemplate(elementTemplate, vector, size_X, size_y, i * (vector.width / n), vector.height - size_y);
            if (elementTextComponentTemplate) {
                let textComponent = elementTextComponentTemplate.cloneNode(true);
                textComponent.innerText = rand.toString();
                container.setElement(textComponent);
            }
            returnedArray.push({ container: container, value: rand });
        }
        return returnedArray;
    }
    static InitAnimator(framerateCap = 60) {
        let animator = new AnimationHandler();
        AnimHelpers.SetAnimator(animator);
        this.animator = animator;
        return animator;
    }
    /*
    * Initializes and starts an animation based on animType with the starting data provided.
    * @expects (InitAnimator and InitViewport) or Init to have been called beforehand to set up the necessary environment for the animations to run correctly.
     * @param animType - A string that specifies the type of animation to initialize (e.g., "bubble", "quick", "insertion", "merge").
     * @param startingData - The initial data required for the specified animation type, such as an array of values to sort.
        * @param settings - An object containing any additional settings or parameters needed for the animation.
        * @throws An error if InitAnimator or InitViewport have not been called prior to this function, as they are necessary for the animations to function properly.
        * @returns void
     */
    static InitAndStartAnimation(animType, startingData, settings) {
        function compare(a, b) {
            return a.value > b.value;
        }
        this.Stop();
        switch (animType) {
            case AnimationType.BUBBLE_SORT:
                PrefabAnimations.BUBBLE_SORT_ANIMATION(startingData, compare, this.scheduleRender, settings);
                break;
            case AnimationType.QUICK_SORT:
                PrefabAnimations.QUICK_SORT_ANIMATION(startingData, compare, this.scheduleRender, settings);
                break;
            case AnimationType.INSERTION_SORT:
                PrefabAnimations.INSERTION_SORT_ANIMATION(startingData, compare, this.scheduleRender, settings);
                break;
            case AnimationType.MERGE_SORT:
                PrefabAnimations.MERGE_SORT_ANIMATION(startingData, compare, this.scheduleRender, settings);
                break;
        }
        this.animator.Start();
    }
    static InitViewAndRootFromElement() {
        let providedElement = document.getElementById("AlgoVis-Viewport");
        if (!providedElement) {
            throw new Error(`Element with id AlgoVis-Viewport not found`);
        }
        let view = new Viewport(providedElement.clientWidth, providedElement.clientHeight, 0, 0, providedElement);
        let root = new RootContainer(providedElement.clientWidth, providedElement.clientHeight, view);
        return { view, root };
    }
    /*
    * Makes the necessary initializations for the animation environment.
    * @expects to be called after the DOM has fully loaded, as it relies on the presence of an element with the id "AlgoVis-Viewport" to set up the viewport and root container correctly.
     * @returns The initialized root container that serves as the base for all animations and elements in the scene.
     * @throws An error if the required element with id "AlgoVis-Viewport" is not found in the DOM, as it is essential for setting up the viewport and root container.
     */
    static Init() {
        let res = this.InitViewAndRootFromElement();
        let view = res.view;
        let root = res.root;
        this.InitAnimator();
        this.InitViewport(view);
        return root;
    }
    static BaseSettings(speed = 1) {
        return new Settings("", "", "", speed);
    }
    static Stop() {
        this.animator.Stop();
    }
}
Main.scheduleRender = null;
Main.animator = null;
export var AnimationType;
(function (AnimationType) {
    AnimationType["BUBBLE_SORT"] = "bubble";
    AnimationType["QUICK_SORT"] = "quick";
    AnimationType["INSERTION_SORT"] = "insertion";
    AnimationType["MERGE_SORT"] = "merge";
})(AnimationType || (AnimationType = {}));
