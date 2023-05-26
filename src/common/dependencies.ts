import { Version } from './common-types';

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
