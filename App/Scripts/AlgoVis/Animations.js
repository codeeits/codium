import ExtraHelpers from "./Helpers.js";
const defaultHighlightColor = "oklch(0.7 0.1 225)";
const defaultHighlightBorderColor = "oklch(0.6765 0.1998 42.35)";
export default class PrefabAnimations {
    static init(vector, speed) {
        if (speed <= 0 || speed > 10) {
            throw "Invalid speed";
        }
        let array = [];
        for (let i = 0; i < vector.length; i++) {
            array.push({ container: vector[i].container, value: vector[i].value, originalPos: vector[i].container.rel_x });
        }
        return array;
    }
    static settingsInit(settings) {
        if (settings == null) {
            settings = {
                highlightColor: defaultHighlightColor,
                highlightBorderColor: defaultHighlightBorderColor,
                speed: 1,
            };
        }
        if (settings.highlightColor == "") {
            settings.highlightColor = defaultHighlightColor;
        }
        if (settings.highlightBorderColor == "") {
            settings.highlightBorderColor = defaultHighlightBorderColor;
        }
        return settings;
    }
    static BUBBLE_SORT_ANIMATION(vector, compFunction, renderer, settings) {
        settings = this.settingsInit(settings);
        let array = PrefabAnimations.init(vector, settings.speed);
        let n = array.length;
        let j = 0;
        let done = false;
        let colors = array.map(item => item.container.template.style.backgroundColor);
        let iterations = 0;
        while (!done && iterations < n * n) {
            done = true;
            for (let i = 0; i < n - j - 1; i++) {
                ExtraHelpers.ColorContainers([array[i].container, array[i + 1].container], settings.highlightColor, () => { }, Math.floor(10 / settings.speed), renderer);
                ExtraHelpers.HighlightContainers([array[i].container, array[i + 1].container], settings.highlightBorderColor, () => { }, Math.floor(20 / settings.speed), renderer);
                ExtraHelpers.ColorContainers([array[i].container, array[i + 1].container], colors[0], () => { }, Math.floor(10 / settings.speed), renderer);
                if (compFunction(array[i], array[i + 1])) {
                    ExtraHelpers.SwapContainers(array[i].container, array[i + 1].container, () => {
                        renderer();
                    }, Math.floor(30 / settings.speed), renderer);
                    [array[i].container.rel_x, array[i + 1].container.rel_x] = [array[i + 1].container.rel_x, array[i].container.rel_x];
                    [array[i], array[i + 1]] = [array[i + 1], array[i]];
                    done = false;
                }
            }
            iterations++;
            j++;
        }
        for (let j = 0; j < array.length; j++) {
            array[j].container.rel_x = array[j].originalPos;
        }
    }
    static INSERTION_SORT_ANIMATION(vector, compFunction, renderer, settings) {
        settings = this.settingsInit(settings);
        let array = PrefabAnimations.init(vector, settings.speed);
        let n = array.length;
        let colors = array.map(item => item.container.template.style.backgroundColor);
        for (let i = 0; i < n - 1; i++) {
            for (let j = i + 1; j < n; j++) {
                ExtraHelpers.ColorContainers([array[i].container, array[j].container], "red", () => { }, Math.floor(10 / settings.speed), renderer);
                ExtraHelpers.HighlightContainers([array[i].container, array[j].container], "yellow", () => { }, Math.floor(20 / settings.speed), renderer);
                ExtraHelpers.ColorContainers([array[i].container, array[j].container], colors[0], () => { }, Math.floor(10 / settings.speed), renderer);
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
            array[j].container.rel_x = array[j].originalPos;
        }
    }
    static QUICK_SORT_ANIMATION(vector, compFunction, renderer, settings) {
        settings = this.settingsInit(settings);
        let array = PrefabAnimations.init(vector, settings.speed);
        let n = array.length;
        let colors = array.map(item => item.container.template.style.backgroundColor);
        function pivot(left, right) {
            let bgElem = null;
            let bgElemTemplate = document.createElement("div");
            bgElemTemplate.style.backgroundColor = "oklch(0.5265 0 42.35 / 16.67%)";
            let leftPos = array[left].container.rel_x;
            let rightPos = array[right].container.rel_x + array[right].container.width;
            let parent = array[left].container.parent;
            ExtraHelpers.SchedulePersonalAnimation(() => { }, 1, renderer, () => {
                if (!bgElem) {
                    bgElem = ExtraHelpers.NewBoxFromTemplate(bgElemTemplate, parent, rightPos - leftPos, parent.height - 2, leftPos, 2);
                }
            });
            let i = left;
            let j = right;
            let mode = -1;
            while (i < j) {
                ExtraHelpers.ColorContainers([array[i].container, array[j].container], settings.highlightColor, () => { }, Math.floor(10 / settings.speed), renderer);
                ExtraHelpers.HighlightContainers([array[i].container, array[j].container], settings.highlightBorderColor, () => { }, Math.floor(20 / settings.speed), renderer);
                ExtraHelpers.ColorContainers([array[i].container, array[j].container], colors[0], () => { }, Math.floor(10 / settings.speed), renderer);
                if (compFunction(array[i], array[j])) {
                    ExtraHelpers.SwapContainers(array[i].container, array[j].container, () => { }, Math.floor(20 / settings.speed), renderer);
                    [array[i].container.rel_x, array[j].container.rel_x] = [array[j].container.rel_x, array[i].container.rel_x];
                    [array[i], array[j]] = [array[j], array[i]];
                    mode *= -1;
                }
                if (mode === -1) {
                    i++;
                }
                else {
                    j--;
                }
            }
            ExtraHelpers.SchedulePersonalAnimation(() => { }, 1, renderer, () => {
                if (bgElem) {
                    bgElem.parent.removeChild(bgElem);
                    bgElem = null;
                }
            });
            return i;
        }
        let stack = [{ left: 0, right: n - 1 }];
        while (stack.length) {
            let pos = stack.pop();
            if (pos.left >= pos.right) {
                continue;
            }
            let mid = pivot(pos.left, pos.right);
            stack.push({ left: pos.left, right: mid - 1 });
            stack.push({ left: mid + 1, right: pos.right });
        }
        for (let j = 0; j < array.length; j++) {
            array[j].container.rel_x = array[j].originalPos;
        }
    }
}
