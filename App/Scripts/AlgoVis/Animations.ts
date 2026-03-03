import ExtraHelpers from "./Helpers"

export default class PrefabAnimations {
    static BUBBLE_SORT_ANIMATION(array: Container[], compFunction: (a: any, b: any) => boolean, renderer: () => any): void {
        let n = array.length;
        let j = 0;
        let done = false;
        let i = 0;

        let colors = array.map(container => container.element.style.backgroundColor);

        while (!done) {
            done = true;
            for (i = 0; i < n - j - 1; i++) {
                ExtraHelpers.ColorContainers([array[i], array[i + 1]], "red", () => {
                    ExtraHelpers.HighlightContainers([array[i], array[i + 1]], "yellow", () => {
                        ExtraHelpers.ColorContainers([array[i], array[i + 1]], colors[0], () => {
                        }, 10, renderer);
                    }, 20, renderer);
                }, 10, renderer);

                if (compFunction(array[i], array[i + 1])) {
                    ExtraHelpers.SwapContainers(array[i], array[i + 1], () => {
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