"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Helpers_1 = require("./Helpers");
var PrefabAnimations = /** @class */ (function () {
    function PrefabAnimations() {
    }
    PrefabAnimations.BUBBLE_SORT_ANIMATION = function (array, compFunction, renderer) {
        var n = array.length;
        var j = 0;
        var done = false;
        var i = 0;
        var colors = array.map(function (container) { return container.element.style.backgroundColor; });
        while (!done) {
            done = true;
            for (i = 0; i < n - j - 1; i++) {
                Helpers_1.default.ColorContainers([array[i], array[i + 1]], "red", function () {
                    Helpers_1.default.HighlightContainers([array[i], array[i + 1]], "yellow", function () {
                        Helpers_1.default.ColorContainers([array[i], array[i + 1]], colors[0], function () {
                        }, 10, renderer);
                    }, 20, renderer);
                }, 10, renderer);
                if (compFunction(array[i], array[i + 1])) {
                    Helpers_1.default.SwapContainers(array[i], array[i + 1], function () {
                        var temp = array[i];
                        array[i] = array[i + 1];
                        array[i + 1] = temp;
                        renderer();
                    }, 30, renderer);
                    done = false;
                }
            }
        }
    };
    return PrefabAnimations;
}());
exports.default = PrefabAnimations;
