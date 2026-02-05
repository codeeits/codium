let view = new Viewport(600, 400, 0, 0, "#1B0524", "black", 2);
let root = new RootContainer(800, 600, view);

root.addChild(new Container(200, 150, 50, 50, "red", "black", 1));
root.addChild(new Container(300, 200, 300, 200, "blue", "black", 1));
root.addChild(new Container(400, 200, 400, 200, "red", "black", 1));
root.children[0].addChild(new Container(100, 75, 10, 10, "green", "black", 1));

console.log(root)

let text = document.createElement("span");
text.innerText = "Hello"
root.children[0].children[0].setElement(text)

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