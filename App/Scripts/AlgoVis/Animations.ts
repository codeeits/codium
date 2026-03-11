import { Container } from "./Container.js"
import ExtraHelpers from "./Helpers.js"

export default class PrefabAnimations {
    static BUBBLE_SORT_ANIMATION(vector: {container: Container, value: any}[], compFunction: (a: any, b: any) => boolean, renderer: () => any, speed: number): void {
        if (speed <= 0 || speed > 10) {
            throw "Invalid speed";
        }
        let array: {container: Container, value: any, originalPos: number}[] = []

        for (let i = 0; i < vector.length; i++) {
            array.push({container: vector[i].container, value: vector[i].value, originalPos: vector[i].container.rel_x});
        }

        let n = array.length;
        let j = 0;
        let done = false;

        let colors = array.map(item => item.container.template.style.backgroundColor);

        let iterations = 0
        while (!done && iterations < n * n) {
            done = true;
            for (let i = 0; i < n - j - 1; i++) {
                ExtraHelpers.ColorContainers([array[i].container, array[i + 1].container], "red", () => {}, Math.floor(10 / speed), renderer);
                ExtraHelpers.HighlightContainers([array[i].container, array[i + 1].container], "yellow", () => {}, Math.floor(20 / speed), renderer);
                ExtraHelpers.ColorContainers([array[i].container, array[i + 1].container], colors[0], () => {}, Math.floor(10 / speed), renderer);

                if (compFunction(array[i], array[i + 1])) {
                    ExtraHelpers.SwapContainers(array[i].container, array[i + 1].container, () => {
                        renderer();
                    }, Math.floor(30 / speed), renderer);
                    [array[i].container.rel_x, array[i +1 ].container.rel_x] = [array[i + 1].container.rel_x, array[i].container.rel_x];
                    [array[i], array[i + 1]] = [array[i+1], array[i]];
                    done = false;
                }
            }
            iterations++;
            j++;
        }

        for (let j = 0; j < array.length; j++) {
            array[j].container.rel_x = array[j].originalPos
        }
    }
}