import { isMac } from './env';

export interface PyPiPackage {
    packageName: string;
    version: string;
    findLink?: string;
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
            },
        ],
    },
    {
        name: 'NCNN',
        packages: [{ packageName: 'ncnn-vulkan', version: '2022.4.1' }],
    },
    {
        name: 'ONNX',
        packages: [
            {
                packageName: 'onnx',
                version: '1.11.0',
            },
            {
                packageName: isNvidiaAvailable ? 'onnxruntime-gpu' : 'onnxruntime',
                version: '1.11.1',
            },
            {
                packageName: 'protobuf',
                version: '3.16.0',
            },
        ],
    },
];

export const requiredDependencies: Dependency[] = [
    {
        name: 'Sanic',
        packages: [{ packageName: 'sanic', version: '21.9.3' }],
    },
    {
        name: 'Sanic Cors',
        packages: [{ packageName: 'Sanic-Cors', version: '1.0.1' }],
    },
    {
        name: 'OpenCV',
        packages: [{ packageName: 'opencv-python', version: '4.5.5.64' }],
    },
    {
        name: 'NumPy',
        packages: [{ packageName: 'numpy', version: '1.22.3' }],
    },
    {
        name: 'Pillow (PIL)',
        packages: [{ packageName: 'Pillow', version: '9.1.0' }],
    },
];
