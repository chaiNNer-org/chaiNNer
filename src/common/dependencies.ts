import { Version } from './common-types';

export interface PyPiPackage {
    displayName: string;
    pypiName: string;
    version: Version;
    findLink?: string | null;
    /**
     * A size estimate (in bytes) for the whl file to download.
     */
    sizeEstimate: number;
    autoUpdate: boolean;
    installed: Version | null;
}
export interface Package {
    name: string;
    dependencies: PyPiPackage[];
    description?: string;
}
