import { Version } from './common-types';

const KB = 1024 ** 1;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const MB = 1024 ** 2;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const GB = 1024 ** 3;

export interface PyPiPackage {
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
    packages: PyPiPackage[];
    description?: string;
}

export const requiredDependencies: Dependency[] = [
    {
        name: 'Sanic',
        packages: [{ packageName: 'sanic', version: '23.3.0', sizeEstimate: 200 * KB }],
    },
    {
        name: 'Sanic Cors',
        packages: [{ packageName: 'Sanic-Cors', version: '2.2.0', sizeEstimate: 17 * KB }],
    },
    {
        name: 'PyNvML',
        packages: [{ packageName: 'pynvml', version: '11.5.0', sizeEstimate: 53 * KB }],
    },
];
