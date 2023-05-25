import { Version } from './common-types';

const KB = 1024 ** 1;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const MB = 1024 ** 2;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const GB = 1024 ** 3;

export interface PyPiPackage {
    displayName?: string;
    packageName: string;
    version: Version;
    findLink?: string;
    /**
     * A size estimate (in bytes) for the whl file to download.
     */
    sizeEstimate: number;
    autoUpdate?: boolean;
}
export interface Dependency {
    name: string;
    dependencies: PyPiPackage[];
    description?: string;
}
