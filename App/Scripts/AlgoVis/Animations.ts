import { Container } from "./Container.js"
import ExtraHelpers from "./Helpers.js"

export type Settings = {
    highlightColor: string;
    highlightBorderColor: string;
    speed: number;
}

const defaultHighlightColor = "oklch(0.7 0.1 225)"
const defaultHighlightBorderColor = "oklch(0.6765 0.1998 42.35)"

export default class PrefabAnimations {
    private static init(vector: {container: Container, value: any}[], speed :number): {container: Container, value: any, originalPos: number}[] {
        if (speed <= 0 || speed > 10) {
            throw "Invalid speed";
        }

        let array: {container: Container, value: any, originalPos: number}[] = []

        for (let i = 0; i < vector.length; i++) {
            array.push({container: vector[i].container, value: vector[i].value, originalPos: vector[i].container.rel_x});
        }
        return array;
    }

    private static settingsInit(settings: Settings) :Settings {
        if (settings == null) {
            settings = {
                highlightColor: defaultHighlightColor,
                highlightBorderColor: defaultHighlightBorderColor,
                speed: 1,
            }
        }
        if (settings.highlightColor == "") {
            settings.highlightColor = defaultHighlightColor
        }
        if (settings.highlightBorderColor == "") {
            settings.highlightBorderColor = defaultHighlightBorderColor
        }

        return settings;
    }

    static BUBBLE_SORT_ANIMATION(vector: {container: Container, value: any}[], compFunction: (a: any, b: any) => boolean, renderer: () => any, settings :Settings | null): void {
        settings = this.settingsInit(settings);
        let array = PrefabAnimations.init(vector, settings.speed);

        let n = array.length;
        let j = 0;
        let done = false;

        let colors = array.map(item => item.container.template.style.backgroundColor);

        let iterations = 0
        while (!done && iterations < n * n) {
            done = true;
            for (let i = 0; i < n - j - 1; i++) {
                ExtraHelpers.ColorContainers([array[i].container, array[i + 1].container], settings.highlightColor, () => {}, Math.floor(10 / settings.speed), renderer);
                ExtraHelpers.HighlightContainers([array[i].container, array[i + 1].container], settings.highlightBorderColor, () => {}, Math.floor(20 / settings.speed), renderer);
                ExtraHelpers.ColorContainers([array[i].container, array[i + 1].container], colors[0], () => {}, Math.floor(10 / settings.speed), renderer);

                if (compFunction(array[i], array[i + 1])) {
                    ExtraHelpers.SwapContainers(array[i].container, array[i + 1].container, () => {
                        renderer();
                    }, Math.floor(30 / settings. speed), renderer);
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

    static INSERTION_SORT_ANIMATION(vector: {container: Container, value: any}[], compFunction: (a: any, b: any) => boolean, renderer: () => any, settings: Settings | null): void {
        settings = this.settingsInit(settings);
        let array = PrefabAnimations.init(vector, settings.speed);

        let n = array.length;
        let colors = array.map(item => item.container.template.style.backgroundColor);

        for (let i = 0; i < n - 1; i++) {
            for (let j = i + 1; j < n; j++) {
                ExtraHelpers.ColorContainers([array[i].container, array[j].container], "red", () => {}, Math.floor(10 / settings.speed), renderer);
                ExtraHelpers.HighlightContainers([array[i].container, array[j].container], "yellow", () => {}, Math.floor(20 / settings.speed), renderer);
                ExtraHelpers.ColorContainers([array[i].container, array[j].container], colors[0], () => {}, Math.floor(10 / settings.speed), renderer);

                if (compFunction(array[i], array[j])) {
                    ExtraHelpers.SwapContainers(array[i].container, array[j].container, () => {
                        renderer();
                    }, Math.floor(30 / settings.speed), renderer);
                    [array[i].container.rel_x, array[j].container.rel_x] = [array[j].container.rel_x, array[i].container.rel_x];
                    [array[i], array[j]] = [array[j], array[i]];
                }
            }
        }
        for (let j = 0; j < array.length; j++) {
            array[j].container.rel_x = array[j].originalPos
        }
    }

    static QUICK_SORT_ANIMATION(vector: {container: Container, value: any}[], compFunction: (a: any, b: any) => boolean, renderer: () => any, settings :Settings | null): void {
        settings = this.settingsInit(settings);
        let array = PrefabAnimations.init(vector, settings.speed);
        let n = array.length;
        let colors = array.map(item => item.container.template.style.backgroundColor);

        console.log("Creating quick animation")
        function pivot (left: number, right: number): number {
            let i = left;
            let j = right;
            let mode = -1;

            while (i < j) {
                ExtraHelpers.ColorContainers([array[i].container, array[j].container], settings.highlightColor, () => {}, Math.floor(10 / settings.speed), renderer);
                ExtraHelpers.HighlightContainers([array[i].container, array[j].container], settings.highlightBorderColor, () => {}, Math.floor(20 / settings.speed), renderer);
                ExtraHelpers.ColorContainers([array[i].container, array[j].container], colors[0], () => {}, Math.floor(10 / settings.speed), renderer);

                if (compFunction(array[i], array[j])) {
                    ExtraHelpers.SwapContainers(array[i].container, array[j].container, () => {renderer()}, Math.floor(20 / settings.speed), renderer);
                    [array[i].container.rel_x, array[j].container.rel_x] = [array[j].container.rel_x, array[i].container.rel_x];
                    [array[i], array[j]] = [array[j], array[i]];
                    mode *= -1;
                }

                if (mode === -1) {
                    i++;
                } else {
                    j--;
                }
            }
            return i;
        }

        function recurse(left: number, right: number) {
            if (left == right) {
                return;
            }
            let mid = pivot(left, right);
            recurse(left, mid - 1);
            recurse(mid, right);
        }

        recurse(0, n - 1);

        for (let j = 0; j < array.length; j++) {
            array[j].container.rel_x = array[j].originalPos
        }
    }
}