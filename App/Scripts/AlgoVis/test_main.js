import * as AlgoVis from "./Helpers.js";
import { Settings } from "./Animations.js";

let root = AlgoVis.Main.Init()
let elementTemplate = document.getElementById("algovisTemplate")

let vectorTemplate = document.createElement("div");
vectorTemplate.style.backgroundColor = "white";

let n = 30
let vector = AlgoVis.Main.InitRandSortVector(n, vectorTemplate, elementTemplate, null, root)

AlgoVis.Main.InitAndStartAnimation("merge", vector, new Settings(undefined, undefined, undefined, 10));


window.setTimeout(() => {
    AlgoVis.Main.InitAndStartAnimation("merge", vector, new Settings(undefined, undefined, undefined, 10));
}, 3000)