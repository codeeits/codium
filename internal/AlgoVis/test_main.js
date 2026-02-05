let view = new Viewport(1220, 1000, 0, 0, "#1B0524", "black", 2);
let root = new RootContainer(1220, 1000, view);

for (let i = 0; i < 10; i++) {
    let container = new Container(100, 100, i * 110 + 20, root.height / 2 - 50, "rgba(255,255,255,0.1)", "white", 2, "center");
    let element = document.createElement("p");
    element.innerText = i.toString();
    element.style.color = "white";
    element.style.fontWeight = "bold";
    element.style.fontSize = "30px";
    element.style.fontFamily = "Arial, sans-serif";
    element.style.verticalAlign = "middle";

    container.setElement(element);
    root.addChild(container);
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
animator.ScheduleAnimation((deltaTime) => {
    root.children[1].rel_x += 3 * deltaTime;
    scheduleRender();
    console.log("Animating frame" + deltaTime);
}, 0, 120);
animator.ScheduleAnimationAfterPrevious((deltaTime) => {
    root.children[2].rel_y += 5 * deltaTime;
    scheduleRender();
    console.log("Animating frame" + deltaTime);
}, 120);

animator.Start();