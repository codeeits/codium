import * as AlgoVis from "./Helpers.js";

let root = AlgoVis.Main.Init()
let elementTemplate = document.getElementById("algovisTemplate")

let vectorTemplate = document.createElement("div");
vectorTemplate.style.backgroundColor = "white";

let n = 30
let vector = AlgoVis.Main.InitRandSortVector(n, vectorTemplate, elementTemplate, null, root)

AlgoVis.Main.InitAndStartAnimation("quick", vector, AlgoVis.Main.BaseSettings(4))