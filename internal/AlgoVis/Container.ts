class Container {
     width: number;
     height: number;
     rel_x: number;
     rel_y: number;
     bg_color: string = "transparent";
     border_color: string = "transparent";
     border_width: number = 0;
     element: HTMLElement | null = null;
     parent: Container | null = null;

     children: Container[];

     constructor(width: number, height: number, rel_x: number = 0, rel_y: number = 0, bg_color: string = "transparent", border_color: string = "transparent", border_width: number = 0) {
         this.width = width;
         this.height = height;
         this.rel_x = rel_x;
         this.rel_y = rel_y;
         this.children = [];
            this.bg_color = bg_color;
            this.border_color = border_color;
            this.border_width = border_width;
     }

     addChild(child: Container) {
         if (child.width + child.rel_x > this.width || child.height + child.rel_y > this.height) {
             throw new Error("Child container exceeds parent bounds.");
         }
         child.parent = this;
         this.children.push(child);
     }

     setParent(parent: Container) {
         if (parent.width < this.width + this.rel_x || parent.height < this.height + this.rel_y) {
             throw new Error("Parent container is too small to contain this container.");
         }
         this.parent = parent;
     }

     removeChild(child: Container) {
         const index = this.children.indexOf(child);
         if (index !== -1) {
             this.children.splice(index, 1);
         }
     }

     setElement(element: HTMLElement) {
         this.element = element;
     }

     getAbsoluteX(): number {
            let absX = this.rel_x;
            let currentParent = this.parent;
            while (currentParent) {
                absX += currentParent.rel_x;
                currentParent = currentParent.parent;
            }
            return absX;
     }

     getAbsoluteY(): number {
         let absY = this.rel_y;
         let currentParent = this.parent;
         while (currentParent) {
             absY += currentParent.rel_y;
             currentParent = currentParent.parent;
         }
         return absY;
     }

     render(): HTMLElement {
         let output = document.createElement("div");
         if (this.element) {
             output.appendChild(this.element);
         }
         output.style.width = this.width + "px";
         output.style.height = this.height + "px";
         output.style.position = "absolute";
         output.style.left = this.rel_x + "px";
         output.style.top = this.rel_y + "px";
         output.style.backgroundColor = this.bg_color;
         output.style.borderColor = this.border_color;
         output.style.borderWidth = this.border_width + "px";
         output.style.borderStyle = this.border_width > 0 ? "solid" : "none";

         for (let child of this.children) {
             output.appendChild(child.render());
         }
         return output;
     }

     intersects(other: Container): boolean {
         // Since rel_x and rel_y are relative to the parent, if we try to see if two containers intersect,
         // we need to consider their positions relative to a common ancestor.

         let thisAbsX = this.getAbsoluteX();
         let thisAbsY = this.getAbsoluteY();
         let otherAbsX = other.getAbsoluteX();
         let otherAbsY = other.getAbsoluteY();

            return !(thisAbsX + this.width <= otherAbsX ||
                        thisAbsX >= otherAbsX + other.width ||
                        thisAbsY + this.height <= otherAbsY ||
                        thisAbsY >= otherAbsY + other.height);
     }
}

class RootContainer extends Container {
    viewport : Viewport;

    constructor(width: number, height: number, viewport : Viewport) {
        super(width, height, 0, 0);
        this.viewport = viewport;
        viewport.parent = this;
    }

    addChild(child: Container) {
        if (child instanceof Viewport) {
            this.viewport.setParent(this);
            return;
        }
        super.addChild(child);
    }

    // Deprecated: This method is deprecated and should not be used directly. Use viewport.render() instead.
    render(): HTMLElement {
        return this.viewport.render();
    }
}

class Viewport extends Container {
    children: null;

    render(): HTMLElement {
        if (!this.parent || !(this.parent instanceof RootContainer)) {
            throw new Error("Viewport must have a RootContainer as parent.");
        }
        let root = this.parent as RootContainer;
        let output = document.getElementById("AlgoVis-Viewport");
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

        for (let child of root.children) {
            console.log("This is the currently targeted child:")
            console.log(child.render());
            if (child === this) throw new Error("Viewport should not be part of the root container's children"); // Skip the viewport itself
            if (!this.intersects(child)) {
                console.log("Viewport doesn't intersect current child: " + child)
                continue;
            } // Skip non-intersecting children

            // Calculate the relative position of the child within the viewport
            let relativeChild = new Container(child.width, child.height, child.rel_x - this.rel_x, child.rel_y - this.rel_y, child.bg_color, child.border_color, child.border_width);
            if (child.element) {
                relativeChild.setElement(child.element);
            }
            relativeChild.children = child.children;

            output.appendChild(relativeChild.render());
        }
        return output;
    }
}