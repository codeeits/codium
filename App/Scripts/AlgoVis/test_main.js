import { InitHelpers } from "./Helpers.js";

let root = InitHelpers.Init()
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

let n = 30
let vector = InitHelpers.InitRandSortVector(n, vectorTemplate, elementTemplate, elementTextTemplate, root)

InitHelpers.InitAndStartAnimation("merge", vector, InitHelpers.BaseSettings(2))