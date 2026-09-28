export const average = (arr:Array<number>) => {
    return arr.reduce((a, b) => a + b, 0) / arr.length
}