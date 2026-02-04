let view = new Viewport(600, 400, 10, 300, "white", "black", 2);
let root = new RootContainer(800, 600, view);

root.addChild(new Container(200, 150, 50, 50, "red", "black", 1));
root.addChild(new Container(300, 200, 300, 200, "blue", "black", 1));
root.addChild(new Container(400, 200, 400, 200, "red", "black", 1));
root.children[0].addChild(new Container(100, 75, 0, 0, "green", "black", 1));

console.log(root)

let text = document.createElement("span");
text.innerText = "Hello, AlgoVis!";
//root.children[0][0].setElement(text);

view.render();

console.log("Test main executed");