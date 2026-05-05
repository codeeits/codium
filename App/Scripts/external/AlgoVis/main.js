class Container {
  width;
  height;
  rel_x;
  rel_y;
  bg_color = "transparent";
  border_color = "transparent";
  border_width = 0;
  element = null;
  parent = null;
  elem_align;
  children;
  /**
   * Creates a new Container.
   * @param width - The width of the container.
   * @param height - The height of the container.
   * @param rel_x - The x position relative to the parent container.
   * @param rel_y - The y position relative to the parent container.
   * @param bg_color
   * @param border_color
   * @param border_width
   * @param elem_align
   */
  constructor(width, height, rel_x = 0, rel_y = 0, bg_color = "transparent", border_color = "transparent", border_width = 0, elem_align = "left") {
    this.width = width;
    this.height = height;
    this.rel_x = rel_x;
    this.rel_y = rel_y;
    this.children = [];
    this.bg_color = bg_color;
    this.border_color = border_color;
    this.border_width = border_width;
    this.elem_align = elem_align;
  }
  /**
   * Adds a child container.
   * In the rendering process, the element returned by child.render() will be appended to this container's element.
   * @param child
   */
  addChild(child) {
    if (child.width + child.rel_x > this.width || child.height + child.rel_y > this.height) {
      throw new Error("Child container exceeds parent bounds.");
    }
    child.parent = this;
    this.children.push(child);
  }
  /**
   * Sets the parent container. Called when adding this container as a child to another container.
   * Please do not call this method directly unless you're setting the parent of the viewport.
   * @param parent
   */
  setParent(parent) {
    if (parent.width < this.width + this.rel_x || parent.height < this.height + this.rel_y) {
      throw new Error("Parent container is too small to contain this container.");
    }
    this.parent = parent;
  }
  /**
   * Removes a child container.
   * @param child
   */
  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);
    }
  }
  /**
   * Sets the HTML element associated with this container.
   * Think span, canvas, img, etc.
   * @param element
   */
  setElement(element) {
    this.element = element;
  }
  /**
   * Calculates the absolute X position of this container relative to the root container.
   */
  getAbsoluteX() {
    let absX = this.rel_x;
    let currentParent = this.parent;
    while (currentParent) {
      absX += currentParent.rel_x;
      currentParent = currentParent.parent;
    }
    return absX;
  }
  /**
   * Calculates the absolute Y position of this container relative to the root container.
   */
  getAbsoluteY() {
    let absY = this.rel_y;
    let currentParent = this.parent;
    while (currentParent) {
      absY += currentParent.rel_y;
      currentParent = currentParent.parent;
    }
    return absY;
  }
  /**
   * Returns the HTML element representing this container and its children.
   * Never call this method directly on the root container or any common container. Use the Viewport's render method instead.
   * @return HTMLElement
   */
  render() {
    let output = document.createElement("div");
    if (this.element) {
      this.element.style.display = "block";
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
    output.style.textAlign = "center";
    output.style.verticalAlign = "middle";
    for (let child of this.children) {
      output.appendChild(child.render());
    }
    return output;
  }
  /**
   * Checks if this container intersects with another container in absolute coordinates.
   * @param other
   */
  intersects(other) {
    let thisAbsX = this.getAbsoluteX();
    let thisAbsY = this.getAbsoluteY();
    let otherAbsX = other.getAbsoluteX();
    let otherAbsY = other.getAbsoluteY();
    return !(thisAbsX + this.width <= otherAbsX || thisAbsX >= otherAbsX + other.width || thisAbsY + this.height <= otherAbsY || thisAbsY >= otherAbsY + other.height);
  }
  /**
   * Moves the container by the specified amounts in the x and y directions.
   * @param x
   * @param y
   */
  move(x, y) {
    let newX = this.rel_x + x;
    let newY = this.rel_y + y;
    if (this.parent) {
      if (newX < 0 || newY < 0 || newX + this.width > this.parent.width || newY + this.height > this.parent.height) {
        throw new Error("Movement would place container out of parent bounds.");
      }
    }
    this.rel_x = newX;
    this.rel_y = newY;
  }
}
class RootContainer extends Container {
  viewport;
  /**
   * Creates a new RootContainer.
   * @param width
   * @param height
   * @param viewport - The viewport to be used for rendering.
   */
  constructor(width, height, viewport) {
    super(width, height, 0, 0);
    this.viewport = viewport;
    viewport.parent = this;
  }
  /**
   * Adds a child container.
   * Can be used to change the viewport instance.
   * @param child
   */
  addChild(child) {
    if (child instanceof Viewport) {
      this.viewport = child;
      this.viewport.setParent(this);
      return;
    }
    super.addChild(child);
  }
  // Deprecated: This method is deprecated and should not be used directly. Use viewport.render() instead.
  render() {
    return this.viewport.render();
  }
}
class Viewport extends Container {
  children;
  /**
   * Renders the viewport and the containers that intersect with it in absolute space.
   * Therefore, the viewport must have a RootContainer as its parent.
   * You can think of the viewport as a "2D camera" that only shows a portion of the entire layout.
   * Requires an HTML element with the id "AlgoVis-Viewport" to be present in the DOM.
   * @return HTMLElement
   */
  render() {
    if (!this.parent || !(this.parent instanceof RootContainer)) {
      throw new Error("Viewport must have a RootContainer as parent.");
    }
    let root = this.parent;
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
    output.draggable = false;
    output.style.backgroundColor = this.bg_color;
    output.innerHTML = "";
    for (let child of root.children) {
      if (child === this) throw new Error("Viewport should not be part of the root container's children");
      if (!this.intersects(child)) {
        continue;
      }
      let relativeChild = new Container(child.width, child.height, child.rel_x - this.rel_x, child.rel_y - this.rel_y, child.bg_color, child.border_color, child.border_width);
      if (child.element) {
        relativeChild.setElement(child.element);
      }
      relativeChild.children = child.children;
      output.appendChild(relativeChild.render());
    }
    return output;
  }
  /**
   * Moves the viewport by the specified amounts in the x and y directions, clamping to the root container bounds.
   * @param x
   * @param y
   */
  move(x, y) {
    let newX = this.rel_x + x;
    let newY = this.rel_y + y;
    if (!this.parent) {
      throw new Error("Movement would place container out of parent bounds.");
    }
    if (newX < 0) {
      this.rel_x = 0;
    } else if (newX + this.width > this.parent.width) {
      this.rel_x = this.parent.width - this.width;
    } else {
      this.rel_x = newX;
    }
    if (newY < 0) {
      this.rel_y = 0;
    } else if (newY + this.height > this.parent.height) {
      this.rel_y = this.parent.height - this.height;
    } else {
      this.rel_y = newY;
    }
  }
}
class AnimationHandler {
  animations;
  //Capping the animation at 60 FPS
  timerId = null;
  frameCount = 0;
  running = false;
  lastFrame = 0;
  Update() {
    if (!this.running) {
      return;
    }
    this.frameCount++;
    this.animations = this.animations.filter(([animation, start_frame, duration, callback]) => {
      if (this.frameCount >= start_frame && this.frameCount <= start_frame + duration) {
        const isComplete = this.RunAnimation(animation, duration, this.frameCount - start_frame);
        if (isComplete) {
          callback();
        }
        return !isComplete;
      }
      return this.frameCount < start_frame + duration;
    });
    if (this.animations.length === 0) {
      this.Stop();
    }
  }
  constructor() {
    this.animations = [];
    this.lastFrame = 0;
  }
  /**
   * Schedules an animation to be run at a specific frame for a specific duration.
   * @param animation - a lerp function that takes in a parameter t
   * @param frame
   * @param duration - duration in frames at 60 FPS
   * @param callback
   * @constructor
   */
  ScheduleAnimation(animation, frame, duration, callback) {
    this.animations.push([animation, frame, duration, callback]);
    if (frame >= this.lastFrame) {
      this.lastFrame = frame + duration;
    }
  }
  ScheduleAnimationInSeconds(animation, frame, duration, callback) {
    this.animations.push([animation, frame, Math.floor(duration / 16), callback]);
    if (frame > this.lastFrame) {
      this.lastFrame = frame + Math.floor(duration / 16);
    }
  }
  ScheduleAnimationAfterPrevious(animation, duration, callback) {
    this.animations.push([animation, this.lastFrame, duration, callback]);
    this.lastFrame += duration;
  }
  ScheduleAnimationAfterPreviousInSeconds(animation, duration, callback) {
    this.animations.push([animation, this.lastFrame, Math.floor(duration / 16), callback]);
    this.lastFrame += Math.floor(duration / 16);
  }
  ScheduleAnimationAfterPreviousWithDelay(animation, delay, duration, callback) {
    this.animations.push([animation, this.lastFrame + delay, duration, callback]);
    this.lastFrame += delay + duration;
  }
  Start() {
    this.running = true;
    this.timerId = window.setInterval(() => this.Update(), 16);
    this.frameCount = 0;
  }
  Stop() {
    this.running = false;
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
  }
  /**
   * Runs the provided animation function.
   * Can be used to immediately run an animation without messing with the timer and whatnot.
   * @param animation
   * @param duration
   * @param progress
   * @constructor
   */
  RunAnimation(animation, duration, progress) {
    return animation(progress / duration);
  }
}
const COMMON_ANIMATION_EASING_FUNCTIONS = {
  Linear: (t) => {
    return t;
  },
  EaseInOutQuad: (t) => {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  },
  EaseInOutCubic: (t) => {
    return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
  }
};
const COMMON_ANIMATIONS = {
  FadeIn: (element, easingFunction) => {
    return (t) => {
      const easedT = easingFunction(t);
      element.style.opacity = easedT.toString();
      return t >= 1;
    };
  },
  FadeOut: (element, easingFunction) => {
    return (t) => {
      const easedT = easingFunction(t);
      element.style.opacity = (1 - easedT).toString();
      return t >= 1;
    };
  },
  LinearMove: (element, startX, startY, endX, endY) => {
    return (t) => {
      const currentX = startX + (endX - startX) * t;
      const currentY = startY + (endY - startY) * t;
      element.style.transform = `translate(${currentX}px, ${currentY}px)`;
      return t >= 1;
    };
  },
  LinearSwap: (elementA, elementB) => {
    const rectA = elementA.getBoundingClientRect();
    const rectB = elementB.getBoundingClientRect();
    const deltaX = rectB.left - rectA.left;
    const deltaY = rectB.top - rectA.top;
    return (t) => {
      const currentXA = deltaX * t;
      const currentYA = deltaY * t;
      const currentXB = -deltaX * t;
      const currentYB = -deltaY * t;
      elementA.style.transform = `translate(${currentXA}px, ${currentYA}px)`;
      elementB.style.transform = `translate(${currentXB}px, ${currentYB}px)`;
      if (t >= 1) {
        elementA.style.transform = "";
        elementB.style.transform = "";
        return true;
      }
      return false;
    };
  },
  LinearInterpolation: (startValue, endValue, callback) => {
    return (t) => {
      const currentValue = startValue + (endValue - startValue) * t;
      callback(currentValue);
      return Math.abs(t - 1) < 1e-4;
    };
  }
};
export {
  AnimationHandler,
  COMMON_ANIMATIONS,
  COMMON_ANIMATION_EASING_FUNCTIONS,
  Container,
  RootContainer,
  Viewport
};
