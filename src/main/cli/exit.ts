/**
 * An error that signals that the CLI app should exit in error with a given non-zero exit code.
 */
export class Exit extends Error {
    exitCode: number;

    constructor(exitCode = 1) {
        super(`Exit with code ${exitCode}`);
        this.exitCode = exitCode;
    }
}
