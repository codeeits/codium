import ExtraHelpers from "./Helpers.js";
import PrefabAnimations from "./Animations.js";
import { Container, RootContainer, Viewport, Connection } from "./Container.js";
import { AnimationHandler } from "./AnimationHandler.js";

let view = new Viewport(1220, 1000, 20, 0);
let root = new RootContainer(view.width + 40, view.height, view);
let vector = [];
let n = 30

for (let i = 0; i < n; i++) {
    let rand = Math.floor(Math.random() * n) + 1;

    let size_y = (rand / n) * (root.height * 3 / 5) + 40;
    let size_X = (root.width / n) * 0.8;
    let template = document.createElement("div")

    template.style.backgroundColor = "oklch(0.7559 0.185 335.65)"
    template.style.border = size_X > 10 ? "2px solid black" : "none";

    let container = new Container(size_X, size_y, i * (root.width / n), 2* root.height / 3 + 100 - size_y, template);

    let element = document.createElement("p");
    element.innerText = rand.toString();
    element.style.color = "white";
    element.style.fontWeight = "bold";
    element.style.fontSize = size_X / 2 > 20 ? (size_X / 2).toString() + "px" : "0px";
    element.style.fontFamily = "Arial, sans-serif";
    element.style.verticalAlign = "middle";

    container.setElement(element);
    root.addChild(container);
    vector.push({container: container, value: rand});
}

console.log(root);

view.render();

console.log("Test main executed");
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
    }
    else {
        viewPortElement.style.cursor = "move";
    }
})

function stopDrag(e) {
    if (!dragging) return;
    // release pointer capture
    try { viewPortElement.releasePointerCapture(activePointerID); } catch (err) { /* ignore */ }
    dragging = false;
    activePointerID = null;
    viewPortElement.style.cursor = "";
    // final render to ensure state is correct
    view.render();
}

viewPortElement.addEventListener("pointerup", stopDrag);
viewPortElement.addEventListener("pointercancel", stopDrag);

let animator = new AnimationHandler()

function compare(a, b) {
    return a.value > b.value;
}

ExtraHelpers.SetAnimator(animator);
PrefabAnimations.MERGE_SORT_ANIMATION(vector, compare, scheduleRender, {highlightColor: "", highlightBorderColor: "", speed: 0.5})

animator.Start();