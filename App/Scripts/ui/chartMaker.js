/*
*/

// echarts in external/eCharts/echarts.min.js

import * as echarts from '../external/eCharts/echarts.min.js';

export class ChartMaker {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`Container with id ${containerId} not found`);
            return;
        }

        this.chart = echarts.init(this.container);

        // COLOUR PALETTE
        const bodyStyle = window.getComputedStyle(document.body);

        this.themeColors = [
            this.#getHexFromVar(bodyStyle, '--primary'),
            this.#getHexFromVar(bodyStyle, '--confirm'),
            this.#getHexFromVar(bodyStyle, '--warning'),
            this.#getHexFromVar(bodyStyle, '--danger'),
            this.#getHexFromVar(bodyStyle, '--info')
        ];

        this.textColor = this.#getHexFromVar(bodyStyle, '--text-colour-primary-button');
        this.contrastColor = this.#getHexFromVar(bodyStyle, '--contrast', '#ffffff');

        this.stepColors = this.#generateColor('primary', 5);

        this.fontFamily = bodyStyle.getPropertyValue('--font-family').trim().replace(/['"]/g, '') || 'sans-serif';
    }

    #getResolvedHex(cssColor) {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        
        const ctx = canvas.getContext('2d', { willReadFrequently: true }); 
        
        ctx.fillStyle = cssColor;
        ctx.fillRect(0, 0, 1, 1);
        
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        
        const toHex = (v) => v.toString(16).padStart(2, '0');
        return `${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    #getHexFromVar(styleObj, varName, fallbackHex) {
        const cssVar = styleObj.getPropertyValue(varName).trim();
        
        if (!cssVar) return fallbackHex;
        
        const colorToResolve = cssVar.includes('(') || cssVar.startsWith('#') 
            ? cssVar 
            : `oklch(${cssVar})`;
            
        return `#${this.#getResolvedHex(colorToResolve)}`;
    }

    #generateColor(baseVarName, steps) {
        const colors = [];
        const bodyStyle = window.getComputedStyle(document.body);
        
        const baseHex = this.#getHexFromVar(bodyStyle, `--${baseVarName}`, '#000000');
        
        const rBase = parseInt(baseHex.slice(1, 3), 16);
        const gBase = parseInt(baseHex.slice(3, 5), 16);
        const bBase = parseInt(baseHex.slice(5, 7), 16);

        for (let i = 0; i < steps; i++) {
            const factor = (i / (steps - 1)) * 0.4;
            
            const r = Math.round(rBase + (255 - rBase) * factor);
            const g = Math.round(gBase + (255 - gBase) * factor);
            const b = Math.round(bBase + (255 - bBase) * factor);
            
            const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
            colors.push(hex);
        }
        
        return colors;
    }

    createSpiderChart(data) {
        const radarOption = {
            textStyle: {
                fontFamily: this.fontFamily,
                color: this.textColor
            },
            title: {
                text: data.title,
                textStyle: {
                    color: this.textColor
                }
            },
            tooltip: {},
            color: this.themeColors,
            radar: {
                indicator: data.labels.map(label => ({ name: label })),
                axisName: {
                    color: this.textColor
                }
            },
            series: [{
                name: data.title,
                type: 'radar',
                data: data.series.map(item => ({
                    value: item.data,
                    name: item.name
                })),
            }]
        };
        this.chart.setOption(radarOption);
    }

    createCalendarHeatmap(data) {
        const maxVal = Math.max(...data.values.map(v => v[1] || 0));
        const heatmapMax = Math.max(15, maxVal);

        const calendarOption = {
            backgroundColor: this.contrastColor,
            textStyle: {
                fontFamily: this.fontFamily,
                color: this.textColor
            },
            title: {
                text: data.title,
                textStyle: { color: this.textColor }
            },
            tooltip: {
                position: 'top',
                formatter: function (params) {
                    return `<strong>${params.value[0]}</strong><br/>Commits: ${params.value[1]}`;
                }
            },
            visualMap: {
                min: 0,
                max: heatmapMax,
                type: 'piecewise',
                orient: 'horizontal',
                left: 'center',
                bottom: '5%',
                inRange: {
                    // GitHub Green Palette (Lightest to Darkest)
                    color: [this.stepColors[4], this.stepColors[3], this.stepColors[2], this.stepColors[1], this.stepColors[0]]
                },
                textStyle: {
                    color: this.textColor
                }
            },
            calendar: {
                top: 80,
                bottom: 80,
                left: 40,
                right: 20,
                cellSize: ['auto', 'auto'],
                range: data.year,

                itemStyle: {
                    borderWidth: 3,
                    borderColor: this.contrastColor
                },
                yearLabel: { show: false },
                dayLabel: {
                    firstDay: 1, // Start with Monday
                    nameMap: ['Sun', '', 'Tue', '', 'Thu', '', 'Sat'],
                    color: this.textColor
                },
                monthLabel: {
                    nameMap: 'en',
                    color: this.textColor
                }
            },
            series: [{
                name: data.title,
                type: 'heatmap',
                coordinateSystem: 'calendar',
                data: data.values,
                backgroundColor: this.contrastColor
            }]
        };

        this.chart.setOption(calendarOption);
    }

    createLineChart(data) {
        const numericValues = data.series.flatMap(item => item.data.filter(value => typeof value === 'number' && Number.isFinite(value)));
        const maxValue = numericValues.length ? Math.max(...numericValues) : 100;
        const yAxisMax = Math.max(100, Math.ceil(maxValue * 1.1 / 10) * 10);

        const lineOption = {
            textStyle: {
                fontFamily: this.fontFamily,
                color: this.textColor
            },
            title: {
                text: data.title,
                textStyle: { color: this.textColor }
            },
            tooltip: {},
            color: this.themeColors,
            xAxis: {
                type: 'category',
                data: data.labels,
                axisLine: {
                    lineStyle: {
                        color: this.textColor
                    }
                },
                splitLine: {
                    show: true,
                    lineStyle: {
                        color: this.textColor,
                        opacity: 0.2,
                        type: 'dashed'
                    }
                },
                axisTick: {
                    show: true,
                    alignWithLabel: true,
                    lineStyle: {
                        color: this.textColor
                    }
                },
                axisLabel: {
                    color: this.textColor
                }
            },
            yAxis: {
                type: 'value',
                min: 0,
                max: yAxisMax,
                splitNumber: 5,
                axisLine: {
                    lineStyle: {
                        color: this.textColor
                    }
                },
                splitLine: {
                    lineStyle: {
                        color: this.textColor,
                        opacity: 0.2,
                        type: 'dashed'
                    }
                },
                axisLabel: {
                    color: this.textColor
                }
            },
            series: data.series.map(item => ({
                name: item.name,
                type: 'line',
                data: item.data,
                smooth: true,
                lineStyle: {
                    width: 3
                },
                itemStyle: {
                    borderWidth: 3
                },
                areaStyle: {}
            }))
        };
        this.chart.setOption(lineOption);
    }
}