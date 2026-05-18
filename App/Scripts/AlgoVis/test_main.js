import * as AlgoVis from "./Helpers.js";

let root = AlgoVis.Main.Init()
let elementTemplate = document.getElementById("algovisTemplate")

let elementTextTemplate = document.createElement("span");
elementTextTemplate.style.color = "white";
elementTextTemplate.style.fontWeight = "bold";
elementTextTemplate.style.fontFamily = "Arial, sans-serif";
elementTextTemplate.style.verticalAlign = "middle";

let vectorTemplate = document.createElement("div");
vectorTemplate.style.backgroundColor = "white";

let n = 30
let vector = AlgoVis.Main.InitRandSortVector(n, vectorTemplate, elementTemplate, elementTextTemplate, root)

AlgoVis.Main.InitAndStartAnimation(AlgoVis.AnimationType.MERGE_SORT, vector, AlgoVis.Main.BaseSettings(1))