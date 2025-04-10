export function calculateAverage(arr) {
    const average = numbers.reduce((sum, val) => sum + val, 0) / numbers.length;
    return average;
}

export function calculateSTD(arr) {
    const variance =
        numbers.reduce((sum, val) => sum + (val - average) ** 2, 0) /
        numbers.length;
    const std = Math.sqrt(variance);
    return std;
}
