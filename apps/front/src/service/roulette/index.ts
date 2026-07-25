export function pickWinnerIndex(options: string[]): number {
    if (options.length === 0) {
        throw new Error("Cannot pick a winner from an empty options list");
    }
    return Math.floor(Math.random() * options.length);
}

export function parseOptionsFromText(text: string): string[] {
    return text
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
}

export function optionsEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((value, index) => value === b[index]);
}
