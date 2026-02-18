import "./Container"

export function NewBoxFromTemplate(template: HTMLElement, parent: Container, width: number, height: number, start_x:number, start_y:number): Container {
    let container = new Container(width, height, start_x, start_y, template);
    parent.addChild(container);
    return container;
}

export function NewCircleFromTemplate(template: HTMLElement, parent: Container, width: number, start_x: number, start_y: number): Container {
    template.style.borderRadius = "50%";
    let container = new Container(width, width, start_x, start_y, template);
    parent.addChild(container);
    return container;
}

export function NewVectorFromTemplateWithDifferentHeights(template: HTMLElement, parent: Container, width: number, height: number[], start_x: number, start_y: number, n: number, spacing: number = 0): Container[] {
    let containers: Container[] = [];
    let individualWidth = width / n;
    for (let i = 0; i < n; i++) {
        let container = new Container(individualWidth, height[i], start_x + (individualWidth + 2*spacing) * i, start_y, template);
        parent.addChild(container);
        containers.push(container);
    }

    return containers;
}

export function NewVectorFromTemplate(template: HTMLElement, parent: Container, width: number, height: number, start_x: number, start_y: number, n: number, spacing: number = 0): Container[] {
    let containers: Container[] = [];
    let individualWidth = width / n;
    for (let i = 0; i < n; i++) {
        let container = new Container(individualWidth, height, (individualWidth + 2*spacing) * i, start_y, template);
        parent.addChild(container);
        containers.push(container);
    }

    return containers;
}