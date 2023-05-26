import { Version } from './common-types';

export interface PyPiPackage {
    displayName?: string;
    pypiName: string;
    version: Version;
    findLink?: string;
    /**
     * A size estimate (in bytes) for the whl file to download.
     */
    sizeEstimate: number;
    autoUpdate?: boolean;
}
export interface Package {
    name: string;
    dependencies: PyPiPackage[];
    description?: string;
}
