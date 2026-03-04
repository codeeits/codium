var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
// A container class for managing layout and rendering of HTML elements in a hierarchical structure.
// This common container can be used for most visual elements in the AlgoVis library.
var Container = /** @class */ (function () {
    /**
     * Creates a new Container.
     * @param width - The width of the container.
     * @param height - The height of the container.
     * @param rel_x - The x position relative to the parent container.
     * @param rel_y - The y position relative to the parent container.
     * @param template
     */
    function Container(width, height, rel_x, rel_y, template) {
        if (rel_x === void 0) { rel_x = 0; }
        if (rel_y === void 0) { rel_y = 0; }
        if (template === void 0) { template = null; }
        this.element = null;
        this.parent = null;
        this.template = null;
        this.width = width;
        this.height = height;
        this.rel_x = rel_x;
        this.rel_y = rel_y;
        this.children = [];
        this.template = template;
    }
    /**
     * Adds a child container.
     * In the rendering process, the element returned by child.render() will be appended to this container's element.
     * @param child
     */
    Container.prototype.addChild = function (child) {
        if (child.width + child.rel_x > this.width || child.height + child.rel_y > this.height) {
            throw new Error("Child container exceeds parent bounds.");
        }
        child.parent = this;
        this.children.push(child);
    };
    /**
     * Sets the parent container. Called when adding this container as a child to another container.
     * Please do not call this method directly unless you're setting the parent of the viewport.
     * @param parent
     */
    Container.prototype.setParent = function (parent) {
        if (parent.width < this.width + this.rel_x || parent.height < this.height + this.rel_y) {
            throw new Error("Parent container is too small to contain this container.");
        }
        this.parent = parent;
    };
    /**
     * Removes a child container.
     * @param child
     */
    Container.prototype.removeChild = function (child) {
        var index = this.children.indexOf(child);
        if (index !== -1) {
            this.children.splice(index, 1);
        }
    };
    /**
     * Sets the HTML element associated with this container.
     * Think span, canvas, img, etc.
     * @param element
     */
    Container.prototype.setElement = function (element) {
        this.element = element;
    };
    /**
     * Calculates the absolute X position of this container relative to the root container.
     */
    Container.prototype.getAbsoluteX = function () {
        var absX = this.rel_x;
        var currentParent = this.parent;
        while (currentParent) {
            absX += currentParent.rel_x;
            currentParent = currentParent.parent;
        }
        return absX;
    };
    /**
     * Calculates the absolute Y position of this container relative to the root container.
     */
    Container.prototype.getAbsoluteY = function () {
        var absY = this.rel_y;
        var currentParent = this.parent;
        while (currentParent) {
            absY += currentParent.rel_y;
            currentParent = currentParent.parent;
        }
        return absY;
    };
    /**
     * Returns the HTML element representing this container and its children.
     * Never call this method directly on the root container or any common container. Use the Viewport's render method instead.
     * @return HTMLElement
     */
    Container.prototype.render = function () {
        var output = document.createElement("div");
        if (this.element) {
            this.element.style.display = "block";
            //console.log("DEBUG: Found element in container:");
            //console.log(this.element);
            output.appendChild(this.element);
        }
        output.style = this.template ? this.template.style.cssText : "";
        output.style.width = this.width + "px";
        output.style.height = this.height + "px";
        output.style.position = "absolute";
        output.style.left = this.rel_x + "px";
        output.style.top = this.rel_y + "px";
        output.style.textAlign = "center";
        output.style.verticalAlign = "middle";
        for (var _i = 0, _a = this.children; _i < _a.length; _i++) {
            var child = _a[_i];
            output.appendChild(child.render());
        }
        return output;
    };
    /**
     * Checks if this container intersects with another container in absolute coordinates.
     * @param other
     */
    Container.prototype.intersects = function (other) {
        // Since rel_x and rel_y are relative to the parent, if we try to see if two containers intersect,
        // we need to consider their positions relative to a common ancestor.
        var thisAbsX = this.getAbsoluteX();
        var thisAbsY = this.getAbsoluteY();
        var otherAbsX = other.getAbsoluteX();
        var otherAbsY = other.getAbsoluteY();
        return !(thisAbsX + this.width <= otherAbsX ||
            thisAbsX >= otherAbsX + other.width ||
            thisAbsY + this.height <= otherAbsY ||
            thisAbsY >= otherAbsY + other.height);
    };
    /**
     * Moves the container by the specified amounts in the x and y directions.
     * @param x
     * @param y
     */
    Container.prototype.move = function (x, y) {
        var newX = this.rel_x + x;
        var newY = this.rel_y + y;
        if (this.parent) {
            if (newX < 0 || newY < 0 || newX + this.width > this.parent.width || newY + this.height > this.parent.height) {
                throw new Error("Movement would place container out of parent bounds.");
            }
        }
        this.rel_x = newX;
        this.rel_y = newY;
    };
    return Container;
}());
/**
 * The RootContainer is a special container that serves as the top-level container for the entire layout.
 * It contains a Viewport which is responsible for rendering the visible portion of the layout.
 */
var RootContainer = /** @class */ (function (_super) {
    __extends(RootContainer, _super);
    /**
     * Creates a new RootContainer.
     * @param width
     * @param height
     * @param viewport - The viewport to be used for rendering.
     */
    function RootContainer(width, height, viewport) {
        var _this = _super.call(this, width, height, 0, 0) || this;
        _this.viewport = viewport;
        viewport.parent = _this;
        return _this;
    }
    /**
     * Adds a child container.
     * Can be used to change the viewport instance.
     * @param child
     */
    RootContainer.prototype.addChild = function (child) {
        if (child instanceof Viewport) {
            this.viewport = child;
            this.viewport.setParent(this);
            return;
        }
        _super.prototype.addChild.call(this, child);
    };
    // Deprecated: This method is deprecated and should not be used directly. Use viewport.render() instead.
    RootContainer.prototype.render = function () {
        return this.viewport.render();
    };
    return RootContainer;
}(Container));
/**
 * The Viewport is a special container that defines the visible area of the layout.
 * It is responsible for rendering only the containers that intersect with its area.
 */
var Viewport = /** @class */ (function (_super) {
    __extends(Viewport, _super);
    function Viewport() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    /**
     * Renders the viewport and the containers that intersect with it in absolute space.
     * Therefore, the viewport must have a RootContainer as its parent.
     * You can think of the viewport as a "2D camera" that only shows a portion of the entire layout.
     * Requires an HTML element with the id "AlgoVis-Viewport" to be present in the DOM.
     * @return HTMLElement
     */
    Viewport.prototype.render = function () {
        if (!this.parent || !(this.parent instanceof RootContainer)) {
            throw new Error("Viewport must have a RootContainer as parent.");
        }
        var root = this.parent;
        var output = document.getElementById("AlgoVis-Viewport");
        if (!output) {
            throw new Error("Viewport element with id 'AlgoVis-Viewport' not found.");
        }
        output.style.width = this.width + "px";
        output.style.height = this.height + "px";
        output.style.overflow = "hidden";
        output.style.position = "fixed";
        output.style.borderColor = "black";
        output.style.borderWidth = "1px";
        output.style.borderStyle = "solid";
        output.style.top = "15px";
        output.style.left = "15px";
        output.draggable = false;
        // Clear existing content
        output.innerHTML = "";
        for (var _i = 0, _a = root.children; _i < _a.length; _i++) {
            var child = _a[_i];
            //console.log("This is the currently targeted child:")
            //console.log(child.render());
            if (child === this)
                throw new Error("Viewport should not be part of the root container's children"); // Skip the viewport itself
            if (!this.intersects(child)) {
                //console.log("Viewport doesn't intersect current child: " + child)
                continue;
            } // Skip non-intersecting children
            var relativeChild = void 0;
            if (child instanceof Connection) {
                child.update();
                relativeChild = new Connection(child.width, child.height, child.direction, child.rel_x - this.rel_x, child.rel_y - this.rel_y, child.template);
            }
            else {
                relativeChild = new Container(child.width, child.height, child.rel_x - this.rel_x, child.rel_y - this.rel_y, child.template);
            }
            if (child.element) {
                relativeChild.setElement(child.element);
            }
            relativeChild.children = child.children;
            output.appendChild(relativeChild.render());
        }
        return output;
    };
    /**
     * Moves the viewport by the specified amounts in the x and y directions, clamping to the root container bounds.
     * @param x
     * @param y
     */
    Viewport.prototype.move = function (x, y) {
        var newX = this.rel_x + x;
        var newY = this.rel_y + y;
        if (!this.parent) {
            throw new Error("Current container doesn't seem to have a parent!");
        }
        if (newX < 0) {
            this.rel_x = 0;
        }
        else if (newX + this.width > this.parent.width) {
            this.rel_x = this.parent.width - this.width;
        }
        else {
            this.rel_x = newX;
        }
        if (newY < 0) {
            this.rel_y = 0;
        }
        else if (newY + this.height > this.parent.height) {
            this.rel_y = this.parent.height - this.height;
        }
        else {
            this.rel_y = newY;
        }
    };
    return Viewport;
}(Container));
var Connection = /** @class */ (function (_super) {
    __extends(Connection, _super);
    function Connection(width, height, dirVector, rel_x, rel_y, template) {
        var _this = _super.call(this, width, height, rel_x, rel_y, template) || this;
        _this.style = "solid";
        _this.ending = "arrow";
        _this.direction = dirVector;
        return _this;
    }
    Connection.UndetailedConstructor = function (from, to, template, style, ending) {
        if (style === void 0) { style = "solid"; }
        if (ending === void 0) { ending = "arrow"; }
        var fromCenter = { x: Math.floor(from.rel_x + from.width / 2), y: Math.floor(from.rel_y + from.height / 2) };
        var toCenter = { x: Math.floor(to.rel_x + to.width / 2), y: Math.floor(to.rel_y + to.height / 2) };
        var width = Math.abs(toCenter.x - fromCenter.x);
        var height = Math.abs(toCenter.y - fromCenter.y);
        var length = Math.sqrt(width * width + height * height);
        // Guard against zero-length connections (avoid division by zero producing NaN angles)
        var direction;
        if (length === 0) {
            direction = { x: 1, y: 0 }; // default to horizontal
        }
        else {
            direction = { x: (toCenter.x - fromCenter.x) / length, y: (toCenter.y - fromCenter.y) / length };
        }
        var result = new Connection(Math.floor(length), 0, direction, fromCenter.x, fromCenter.y, template);
        result.from = from;
        result.to = to;
        result.style = style;
        result.ending = ending;
        console.log("Created connection between ");
        console.log(from);
        console.log(to);
        console.log("Having length " + length + "and direction vector: X - " + direction.x + "; Y - " + direction.y);
        return result;
    };
    Connection.prototype.update = function () {
        console.log(this);
        console.log("Updating connection between ");
        console.log(this.from);
        console.log(this.to);
        if (!this.from || !this.to) {
            console.log("Connection doesn't seem to have valid endpoints. Skipping update.");
            return;
        }
        var fromCenter = { x: Math.floor(this.from.rel_x + this.from.width / 2), y: Math.floor(this.from.rel_y + this.from.height / 2) };
        var toCenter = { x: Math.floor(this.to.rel_x + this.to.width / 2), y: Math.floor(this.to.rel_y + this.to.height / 2) };
        var width = Math.abs(toCenter.x - fromCenter.x);
        var height = Math.abs(toCenter.y - fromCenter.y);
        var length = Math.sqrt(width * width + height * height);
        if (length === 0) {
            this.direction = { x: 1, y: 0 };
        }
        else {
            this.direction = { x: (toCenter.x - fromCenter.x) / length, y: (toCenter.y - fromCenter.y) / length };
        }
        this.width = Math.floor(length);
        this.rel_x = fromCenter.x;
        this.rel_y = fromCenter.y;
    };
    Connection.prototype.render = function () {
        var output = _super.prototype.render.call(this);
        // Use atan2 to correctly compute quadrant-aware angle; convert to degrees
        var degrees = (Math.atan2(this.direction.y, this.direction.x) * (180 / Math.PI));
        // Ensure connection has a small visible height so it's drawn as a line
        if (this.height <= 0) {
            output.style.height = "2px";
        }
        // Pivot rotation around the left-center of the element so the connection starts at rel_x/rel_y
        output.style.transformOrigin = "0 50%";
        output.style.transform = "rotate(" + degrees + "deg)";
        return output;
    };
    return Connection;
}(Container));
