import { range, sort, sum } from "myutils"

export class DataSeries<T = any> {
    data: T[] = []
    points: Point2[] = []
    mappedPoints: Point2[] = []

    constructor(
        public getter: (d: T) => { x: number; y: number },
        public transforms: Transform[] = [],
    ) {}

    public push(...data: T[]): this {
        this.data.push(...data)
        this.points.push(
            ...sort(
                data.map((d) => this.getter(d)),
                (pt) => pt.x,
            ),
        )
        this.mappedPoints = this.transform(this.points)
        return this
    }

    public clear(): this {
        this.data = []
        this.points = []
        this.mappedPoints = []
        return this
    }

    private transform(pts: Point2[]) {
        let result = pts

        for (const tfm of this.transforms) {
            // console.log("before", tfm, result)
            switch (tfm.type) {
                case "average":
                    result = this.transformAverage(result, tfm)
                    break
                case "downsample":
                    result = this.transformDownsample(result, tfm)
                    break
                case "bin":
                    result = this.transformBin(result, tfm)
                    break
                case "binByWidth":
                    result = this.transformBin(result, {
                        type: "bin",
                        keyFn: (pt) =>
                            tfm.width ? Math.trunc(pt.x / tfm.width) : pt.x,
                        aggFn: (key, pts) => ({
                            x: tfm.width ? key * tfm.width : key,
                            y:
                                sum(yVals(pts)) /
                                (tfm.divideByWidth ? tfm.width : 1),
                        }),
                    })
                    break
                case "sort":
                    result = sort(result, ({ x }) => x)
                    break
                case "accumulate":
                    result = result.reduce(
                        ({ last, acc }, pt) => {
                            last.x = pt.x
                            last.y += pt.y
                            acc.push({ ...last })
                            return { last, acc }
                        },
                        {
                            last: { x: 0, y: 0 },
                            acc: [] as Point2[],
                        },
                    ).acc
                    break
                case "map":
                    result = result.map((pt) => tfm.fn(pt))
                    break
                case "fill":
                    result = this.transformFill(result, tfm)
                    break
            }
        }

        result = sort(result, ({ x }) => x)

        return result
    }

    private transformAverage(pts: Point2[], tfm: AverageTransform): Point2[] {
        const update: Point2[] = []

        const keepEdges = tfm.keepEdges ?? true
        const start = keepEdges ? 0 : tfm.width
        const end = keepEdges ? pts.length : pts.length - tfm.width

        for (let idx = start; idx < end; idx++) {
            const center = pts[idx]
            const a = Math.max(idx - tfm.width, 0)
            const b = Math.min(idx + tfm.width + 1, pts.length)

            const items = range(a, b).map((i) => pts[i].y)
            const y = sum(items) / items.length

            update.push({
                x: center.x,
                y,
            })
        }

        return update
    }

    private transformDownsample(
        pts: Point2[],
        tfm: DownsampleTransform,
    ): Point2[] {
        const update: Point2[] = []
        if (!pts.length) {
            return pts
        }

        // First point
        const start = tfm.offset ?? 0
        if ((tfm.keepFirst ?? true) && start !== 0) {
            update.push(pts[0])
        }

        // Step through other points
        let idx
        for (idx = start; idx < pts.length; idx += tfm.step) {
            update.push(pts[idx])
        }

        // Last point
        if ((tfm.keepLast ?? true) && idx !== pts.length - 1) {
            update.push(pts[idx])
        }

        return update
    }

    private transformBin<TKey extends string | number>(
        pts: Point2[],
        tfm: BinTransform<TKey>,
    ): Point2[] {
        const bins = new Map<TKey, Point2[]>()

        // Default to x as key
        const keyfn = tfm.keyFn ?? ((pt) => pt.x as TKey)

        // Default to sum as aggregator
        const aggFn =
            tfm.aggFn ??
            ((key, pts) => ({
                x: key as number,
                y: sum(pts.map((pt) => pt.y)),
            }))

        // Bins
        for (const pt of pts) {
            const k = keyfn(pt)

            if (!bins.has(k)) {
                bins.set(k, [])
            }

            bins.get(k)!.push(pt)
        }

        // Bins to points
        const update = [...bins.entries()].map(([key, pts]) => aggFn(key, pts))

        return update
    }

    private transformFill(pts: Point2[], tfm: FillTransform) {
        const step = tfm.step ?? 1

        pts = sort(pts, (pt) => pt.x)

        let curr = tfm.start ?? {
            x: pts[0].x,
            y: tfm.variant === "hold" ? pts[0].y : (tfm.padValue ?? 0),
        }
        let update: Point2[] = []

        for (const pt of pts) {
            while (curr.x < pt.x) {
                if (pt.x - curr.x > step) {
                    curr.x += step
                    update.push({ ...curr })
                } else {
                    curr.x = pt.x
                    if (tfm.variant === "hold") {
                        curr.y = pt.y
                    } else {
                        curr.y = tfm.padValue ?? 0
                    }
                    break
                }
            }

            update.push({ ...pt })
        }

        while (tfm.stop !== undefined && curr.x < tfm.stop) {
            curr.x += step
            update.push({ ...curr })
        }

        return update
    }
}

type Point2 = {
    x: number
    y: number
}

type Transform =
    | AverageTransform
    | DownsampleTransform
    | BinTransform
    | BinByWidthTransform
    | MapTransform
    | SortTransform
    | AccumulateTransform
    | FillTransform

interface AverageTransform {
    type: "average"
    width: number
    keepEdges?: boolean
}

interface DownsampleTransform {
    type: "downsample"
    step: number
    offset?: number
    keepFirst?: boolean
    keepLast?: boolean
}

interface BinTransform<TKey extends string | number = number> {
    type: "bin"
    keyFn?: (pt: Point2) => TKey
    aggFn?: (key: TKey, pts: Point2[]) => Point2
}

interface BinByWidthTransform {
    type: "binByWidth"
    width: number
    divideByWidth?: boolean
}

interface MapTransform {
    type: "map"
    fn: (pt: Point2) => Point2
}

interface SortTransform {
    type: "sort"
}

interface AccumulateTransform {
    type: "accumulate"
}

interface FillTransform {
    type: "fill"
    variant: "hold" | "pad"
    padValue?: number
    step?: number
    start?: Point2
    stop?: number
}

function xVals(pts: Point2[]): number[] {
    return pts.map((pt) => pt.x)
}

function yVals(pts: Point2[]): number[] {
    return pts.map((pt) => pt.y)
}
