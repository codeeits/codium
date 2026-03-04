import ExtraHelpers from "./Helpers.js";
export default class PrefabAnimations {
    static BUBBLE_SORT_ANIMATION(array, compFunction, renderer) {
        let n = array.length;
        let j = 0;
        let done = false;
        let i = 0;
        let colors = array.map(item => item.container.template.style.backgroundColor);
        while (!done) {
            done = true;
            for (i = 0; i < n - j - 1; i++) {
                ExtraHelpers.ColorContainers([array[i].container, array[i + 1].container], "red", () => {
                    ExtraHelpers.HighlightContainers([array[i].container, array[i + 1].container], "yellow", () => {
                        ExtraHelpers.ColorContainers([array[i].container, array[i + 1].container], colors[0], () => {
                        }, 10, renderer);
                    }, 20, renderer);
                }, 10, renderer);
                if (compFunction(array[i], array[i + 1])) {
                    ExtraHelpers.SwapContainers(array[i].container, array[i + 1].container, () => {
                        let temp = array[i];
                        array[i] = array[i + 1];
                        array[i + 1] = temp;
                        renderer();
                    }, 30, renderer);
                    done = false;
                }
            }
        }
    }
}
