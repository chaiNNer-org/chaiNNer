import { Version } from './common-types';

export type PyPiName = string & { readonly __pyPiName: never };
export type PackageId = string & { readonly __packageId: never };
export type FeatureId = string & { readonly __featureId: never };

export interface PyPiPackage {
    readonly displayName: string;
    readonly pypiName: PyPiName;
    readonly version: Version;
    readonly findLink?: string | null;
    /**
     * A size estimate (in bytes) for the whl file to download.
     */
    readonly sizeEstimate: number;
    readonly autoUpdate: boolean;
}

export interface Feature {
    readonly id: FeatureId;
    readonly name: string;
    readonly description: string;
}

export interface Package {
    readonly id: PackageId;
    readonly name: string;
    readonly description: string;
    readonly dependencies: readonly PyPiPackage[];
    readonly features: readonly Feature[];
}

export interface FeatureState {
    readonly packageId: PackageId;
    readonly featureId: FeatureId;
    readonly enabled: boolean;
    readonly details?: string | null;
}
