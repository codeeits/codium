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
    private static init(vector: {container: Container, value: any}[], speed :number): {container: Container, value: any, originalPosX: number, originalPosY: number}[] {
        if (speed <= 0 || speed > 10) {
            throw "Invalid speed";
        }

        let array: {container: Container, value: any, originalPosX: number, originalPosY: number}[] = []

        for (let i = 0; i < vector.length; i++) {
            array.push({container: vector[i].container, value: vector[i].value, originalPosX: vector[i].container.rel_x, originalPosY: vector[i].container.rel_y});
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

    public static _swap(array: {container: Container, value: any, originalPosX: number, originalPosY: number}[], i: number, j: number, settings: Settings, renderer: () => any, comp: (a: any, b: any) => boolean, comparisonTrueHook: () => any | null): void {
        let ogColor = array[i].container.template.style.backgroundColor;
        ExtraHelpers.ColorContainers([array[i].container, array[j].container], settings.highlightColor, () => {}, Math.floor(10 / settings.speed), renderer);
        ExtraHelpers.HighlightContainers([array[i].container, array[j].container], settings.highlightBorderColor, () => {}, Math.floor(20 / settings.speed), renderer);
        ExtraHelpers.ColorContainers([array[i].container, array[j].container], ogColor, () => {}, Math.floor(10 / settings.speed), renderer);

        if (comp(array[i], array[j])) {
            ExtraHelpers.SwapContainers(array[i].container, array[j].container, () => {
                renderer();
            }, Math.floor(30 / settings.speed), renderer);
            [array[i].container.rel_x, array[j].container.rel_x] = [array[j].container.rel_x, array[i].container.rel_x];
            [array[i], array[j]] = [array[j], array[i]];
            if (comparisonTrueHook) {
                comparisonTrueHook();
            }
        }
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
                this._swap(array, i, i+1, settings, renderer, compFunction, () => {
                    done = false;
                })
            }
            ExtraHelpers.ColorContainers([array[n - j - 1].container], settings.highlightColor, () => {}, Math.floor(10 / settings.speed), renderer);
            iterations++;
            j++;
        }

        for (let j = 0; j < array.length; j++) {
            array[j].container.rel_x = array[j].originalPosX
        }
    }

    static INSERTION_SORT_ANIMATION(vector: {container: Container, value: any}[], compFunction: (a: any, b: any) => boolean, renderer: () => any, settings: Settings | null): void {
        settings = this.settingsInit(settings);
        let array = PrefabAnimations.init(vector, settings.speed);

        let n = array.length;
        let colors = array.map(item => item.container.template.style.backgroundColor);

        for (let i = 0; i < n - 1; i++) {
            for (let j = i + 1; j < n; j++) {
                this._swap(array, i, j, settings, renderer, compFunction, null)
            }
        }
        for (let j = 0; j < array.length; j++) {
            array[j].container.rel_x = array[j].originalPosX
        }
    }

    static QUICK_SORT_ANIMATION(vector: {container: Container, value: any}[], compFunction: (a: any, b: any) => boolean, renderer: () => any, settings :Settings | null): void {
        settings = this.settingsInit(settings);
        let array = PrefabAnimations.init(vector, settings.speed);
        let n = array.length;
        let colors = array.map(item => item.container.template.style.backgroundColor);

        function pivot (left: number, right: number): number {
            let bgElem: Container | null = null;
            let bgElemTemplate = document.createElement("div");
            bgElemTemplate.style.backgroundColor = "oklch(0.5265 0 42.35 / 16.67%)"
            let leftPos = array[left].container.rel_x;
            let rightPos = array[right].container.rel_x + array[right].container.width;
            let parent = array[left].container.parent;
            ExtraHelpers.SchedulePersonalAnimation(() => {}, 1, renderer, () => {
                if (!bgElem) {
                    bgElem = ExtraHelpers.NewBoxFromTemplate(bgElemTemplate, parent, rightPos - leftPos, parent.height - 2, leftPos, 2);
                }
            })
            let i = left;
            let j = right;
            let mid = Math.floor((i + j) / 2)
            let mode = -1;

            // Quicksort gets worse in a sorted list if you take the first or the last element, so we'll take the middle element instead
            if (i < j) {
                ExtraHelpers.SwapContainers(array[i].container, array[mid].container, () => {}, Math.floor(20 / settings.speed), renderer);
                [array[i].container.rel_x, array[mid].container.rel_x] = [array[mid].container.rel_x, array[i].container.rel_x];
                [array[i], array[mid]] = [array[mid], array[i]];
            }

            while (i < j) {
                PrefabAnimations._swap(array, i, j, settings, renderer, compFunction, () => {
                    mode *= -1;
                })

                if (mode === -1) {
                    i++;
                } else {
                    j--;
                }
            }
            ExtraHelpers.SchedulePersonalAnimation(() => {}, 1, renderer, () => {
                if (bgElem) {
                    bgElem.parent.removeChild(bgElem);
                    bgElem = null;
                }
            })
            return i;
        }

        let stack: {left: number; right: number}[] = [{left: 0, right: n - 1}];
        while (stack.length) {
            let pos = stack.pop();
            if (pos.left >= pos.right) {
                continue;
            }

            let mid = pivot(pos.left, pos.right);
            stack.push({left: pos.left, right: mid - 1});
            stack.push({left: mid + 1, right: pos.right});
        }

        for (let j = 0; j < array.length; j++) {
            array[j].container.rel_x = array[j].originalPosX
        }
    }

    static MERGE_SORT_ANIMATION(vector: {container: Container, value: any}[], compFunction: (a: any, b: any) => boolean, renderer: () => any, settings: Settings | null): void {
        settings = this.settingsInit(settings);
        let array = PrefabAnimations.init(vector, settings.speed);
        let n = array.length;

        // gotta make space for the second vector
        let maxHeight = 0;
        for (let i = 0; i < n; i++) {
            array[i].container.height = array[i].container.height / 2 - 20;
            if (array[i].container.height > maxHeight) {
                maxHeight = array[i].container.height;
            }
        }

        let mergeVect = []
        let markerVect = []
        let aux = []

        for (let j = 0; j < n; j++) {
            array[j].container.rel_y /= 2;

            let newTemplate = document.createElement("div")
            newTemplate.style = array[j].container.template.style.cssText
            let newBox = ExtraHelpers.NewBoxFromTemplate(newTemplate, array[j].container.parent, array[j].container.width, 0, array[j].container.rel_x, array[j].container.rel_y + array[j].container.height + 20);
            array[j].container.parent.addChild(newBox);
            mergeVect.push(newBox);

            newTemplate.style.zIndex = "-2"
            newBox = ExtraHelpers.NewBoxFromTemplate(newTemplate, array[j].container.parent, array[j].container.width, 0, array[j].container.rel_x, array[j].container.rel_y + array[j].container.height);
            array[j].container.parent.addChild(newBox);
            markerVect.push(newBox);
        }

        let ogColor = array[0].container.template.style.backgroundColor

        function merge(left: number, mid: number, right: number): void {
            let i = left;
            let j = mid + 1;
            let k = 0

            console.log(`We got left and right: ${left} & ${right} | With a calculated middle of: ${mid}`)
            while (i <= mid && j <= right) {
                console.log(`Current k: ${k} with element: ${mergeVect[k].toString()}`)
                ExtraHelpers.ColorContainers([array[i].container, array[j].container], settings.highlightColor, () => {}, Math.floor(10 / settings.speed), renderer);
                ExtraHelpers.HighlightContainers([array[i].container, array[j].container], settings.highlightBorderColor, () => {}, Math.floor(10 / settings.speed), renderer);
                ExtraHelpers.ColorContainers([array[i].container, array[j].container], ogColor, () => {}, Math.floor(10 / settings.speed), renderer);

                console.log(`Checking i - ${i}; j - ${j}... \n${array[i].container};\n${array[j].container};\n `)
                if (compFunction(array[i], array[j])) {
                    ExtraHelpers.MoveContainer(array[j].container, mergeVect[k].rel_x, mergeVect[k].rel_y, ()=>{}, 10 / settings.speed, renderer)

                    array[j].container.rel_x = mergeVect[k].rel_x
                    array[j].container.rel_y = mergeVect[k].rel_y
                    aux.push(array[j])
                    k++; j++;
                } else {
                    ExtraHelpers.MoveContainer(array[i].container, mergeVect[k].rel_x, mergeVect[k].rel_y, ()=>{}, 10 / settings.speed, renderer)

                    array[i].container.rel_x = mergeVect[k].rel_x
                    array[i].container.rel_y = mergeVect[k].rel_y
                    aux.push(array[i])
                    k++; i++;
                }
            }

            while (i <= mid) {
                console.log(`Current k: ${k}`)
                ExtraHelpers.MoveContainer(array[i].container, mergeVect[k].rel_x, mergeVect[k].rel_y, ()=>{}, 10 / settings.speed, renderer)

                array[i].container.rel_x = mergeVect[k].rel_x
                array[i].container.rel_y = mergeVect[k].rel_y
                aux.push(array[i])
                k++; i++;
            }
            while (j <= right) {
                console.log(`Current k: ${k}`)
                ExtraHelpers.MoveContainer(array[j].container, mergeVect[k].rel_x, mergeVect[k].rel_y, ()=>{}, 10 / settings.speed, renderer)

                array[j].container.rel_x = mergeVect[k].rel_x
                array[j].container.rel_y = mergeVect[k].rel_y
                aux.push(array[j])
                k++; j++;
            }

            for (let x = 0; x < k; x++) {
                ExtraHelpers.MoveContainer(aux[x].container, markerVect[left + x].rel_x, markerVect[left + x].rel_y - aux[x].container.height, () => {}, 10 / settings.speed, renderer)
                aux[x].rel_x = markerVect[left + x].rel_x
                aux[x].rel_y = markerVect[left + x].rel_y - aux[x].container.height

                array[left + x] = aux[x]
            }
            aux = [];
        }

        function sort (left: number, right: number): void {
            if (left >= right) {
                return;
            }
            let mid = Math.floor((left + right) / 2);
            sort(left, mid)
            sort(mid + 1, right)
            merge(left, mid, right)
        }

        sort(0, n-1)

        for (let item of array) {
            item.container.rel_x = item.originalPosX;
            item.container.rel_y = item.originalPosY / 2;
        }

        renderer();
    }
}