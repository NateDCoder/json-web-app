export function getStats(numbers) {
    if (numbers.length === 0) return { average: 0, std: 0 };

    // Calculate the average (mean)
    const average = numbers.reduce((sum, val) => sum + val, 0) / (numbers.length * 2);

    // Calculate the standard deviation
    const variance =
        numbers.reduce((sum, val) => sum + (val - average) ** 2, 0) / (numbers.length * 2);
    const std = Math.sqrt(variance);

    return { average, std };
}

export function eloToEPA(elo, average, std) {
    if (std === 0) return 0; // Avoid division by zero
    // Elo Average is 1500  Elo STD  is 200
    const z = (elo - 1500) / 200;
    return average + z * std;
}

export function epaToUnitlessEPA(epa, average, std) {
    if (!average || !std) {
        console.error("Invalid Average or STD")
    }
    if (std === 0) return 1500;
    return 1500 + ((epa - average) / std) * 200;
}