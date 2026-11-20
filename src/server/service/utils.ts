export function assertNotProduction(fnName: string) {
    if (process.env.NODE_ENV === "production") {
        throw new Error(
            `${fnName} is blocked in production! Please use a different function!`
        );
    }
}