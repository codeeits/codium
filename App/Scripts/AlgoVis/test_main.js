import PrefabAnimations, { Settings } from "./Animations.js";
import { Container, RootContainer, Viewport, Connection } from "./Container.js";
import { AnimationHandler } from "./AnimationHandler.js";
import AnimHelpers, {InitHelpers} from "./Helpers.js";

let view = new Viewport(1220, 1000, 20, 0);
let root = new RootContainer(view.width + 40, view.height, view);
let n = 30

let scheduleRender = InitHelpers.InitViewport(view)

let elementTemplate = document.createElement("div")

elementTemplate.style.backgroundColor = "oklch(0.7559 0.185 335.65)"
elementTemplate.style.border = "1px solid black";

let elementTextTemplate = document.createElement("span");
elementTextTemplate.style.color = "white";
elementTextTemplate.style.fontWeight = "bold";
elementTextTemplate.style.fontFamily = "Arial, sans-serif";
elementTextTemplate.style.verticalAlign = "middle";

let vectorTemplate = document.createElement("div");
vectorTemplate.style.backgroundColor = "white";

let vector = InitHelpers.InitSortVector([10, 2, 3, 4, 5, 6, 7, 8, 9], vectorTemplate, elementTemplate, elementTextTemplate, root, 5)

view.render();

let animator = new AnimationHandler()

function compare(a, b) {
    return a.value > b.value
}

AnimHelpers.SetAnimator(animator);

PrefabAnimations.BUBBLE_SORT_ANIMATION(vector, compare, scheduleRender, new Settings("", "", "", 1));

animator.Start();