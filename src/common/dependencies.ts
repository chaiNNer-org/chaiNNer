import { isMac } from './env';

const KB = 1024 ** 1;
const MB = 1024 ** 2;
const GB = 1024 ** 3;

export interface PyPiPackage {
    packageName: string;
    version: string;
    findLink?: string;
    /**
     * A size estimate (in bytes) for the whl file to download.
     */
    sizeEstimate: number;
}
export interface Dependency {
    name: string;
    packages: PyPiPackage[];
}

export const getOptionalDependencies = (isNvidiaAvailable: boolean): Dependency[] => [
    {
        name: 'PyTorch',
        packages: [
            {
                packageName: 'torch',
                version: `1.10.2+${isNvidiaAvailable && !isMac ? 'cu113' : 'cpu'}`,
                findLink: `https://download.pytorch.org/whl/${
                    isNvidiaAvailable && !isMac ? 'cu113' : 'cpu'
                }/torch_stable.html`,
                sizeEstimate: isNvidiaAvailable && !isMac ? 2 * GB : 140 * MB,
            },
        ],
    },
    {
        name: 'NCNN',
        packages: [{ packageName: 'ncnn-vulkan', version: '2022.8.12', sizeEstimate: 4 * MB }],
    },
    {
        name: 'ONNX',
        packages: [
            {
                packageName: 'onnx',
                version: '1.11.0',
                sizeEstimate: 12 * MB,
            },
            {
                packageName: isNvidiaAvailable ? 'onnxruntime-gpu' : 'onnxruntime',
                sizeEstimate: isNvidiaAvailable ? 110 * MB : 5 * MB,
                version: '1.11.1',
            },
            {
                packageName: 'protobuf',
                version: '3.16.0',
                sizeEstimate: 500 * KB,
            },
        ],
    },
];

export const requiredDependencies: Dependency[] = [
    {
        name: 'Sanic',
        packages: [{ packageName: 'sanic', version: '21.9.3', sizeEstimate: 270 * KB }],
    },
    {
        name: 'Sanic Cors',
        packages: [{ packageName: 'Sanic-Cors', version: '1.0.1', sizeEstimate: 17 * KB }],
    },
    {
        name: 'OpenCV',
        packages: [{ packageName: 'opencv-python', version: '4.5.5.64', sizeEstimate: 30 * MB }],
    },
    {
        name: 'NumPy',
        packages: [{ packageName: 'numpy', version: '1.22.3', sizeEstimate: 15 * MB }],
    },
    {
        name: 'Pillow (PIL)',
        packages: [{ packageName: 'Pillow', version: '9.1.0', sizeEstimate: 3 * MB }],
    },
];
