let view = new Viewport(1220, 1000, 20, 0, "#1B0524", "black", 2);
let root = new RootContainer(view.width + 40, view.height, view);
let vector = [];
let n = 10

for (let i = 0; i < n; i++) {
    let rand = Math.floor(Math.random() * (n - 1)) + 1;
    let size_y = (rand / n) * (root.height * 3 / 5);
    let size_X = (root.width / n) * 0.8;
    let container = new Container(size_X, size_y, i * (root.width / n), root.height / 2 + 100 - size_y, "rgba(255,255,255,0.1)", "white", size_X > 10 ? 2 : 0, "center");
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

function swapBoxes (i, j, durationFrames) {
    let startX1 = vector[i].container.rel_x;
    let startX2 = vector[j].container.rel_x;
    animator.ScheduleAnimationAfterPrevious((deltaTime) => {
        COMMON_ANIMATIONS.LinearInterpolation(startX1, startX2, (v) => {
            vector[i].container.rel_x = v;
            scheduleRender();
        })(COMMON_ANIMATION_EASING_FUNCTIONS.EaseInOutCubic(deltaTime));

        COMMON_ANIMATIONS.LinearInterpolation(startX2, startX1, (v) => {
            vector[j].container.rel_x = v;
            scheduleRender();
        })(COMMON_ANIMATION_EASING_FUNCTIONS.EaseInOutCubic(deltaTime));

        return deltaTime >= 1.0;
    }, durationFrames, () => {
        console.log("Finished swapping", i, j);
        let temp = vector[i];
        vector[i] = vector[j];
        vector[j] = temp;
    }); // :D :DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDd
}

let vector_copies = vector.map(v => ({...v})); // create a shallow copy for reference
console.log(vector.toString())
for (let i = 0; i < n  - 1; i++) {
    for (let j = i + 1; j < n; j++) {
        if (vector_copies[i].value > vector_copies[j].value) {
            swapBoxes(i, j, 30);
            let temp = vector_copies[i];
            vector_copies[i] = vector_copies[j];
            vector_copies[j] = temp;
        }
    }
}

animator.Start();