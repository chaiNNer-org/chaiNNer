import { Version } from './common-types';
import { isM1, isMac, isWindows } from './env';

const KB = 1024 ** 1;
const MB = 1024 ** 2;
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

export const getOptionalDependencies = (isNvidiaAvailable: boolean): Dependency[] => {
    const canCuda = isNvidiaAvailable && !isMac;
    return [
        {
            name: 'PyTorch',
            packages: [
                {
                    packageName: 'torch',
                    version: `1.10.2${canCuda ? '+cu113' : ''}`,
                    findLink: canCuda ? 'https://download.pytorch.org/whl/cu113' : undefined,
                    sizeEstimate: canCuda ? 2 * GB : 140 * MB,
                },
                {
                    packageName: 'torchvision',
                    version: `0.11.3${canCuda ? '+cu113' : ''}`,
                    findLink: canCuda ? 'https://download.pytorch.org/whl/cu113' : undefined,
                    sizeEstimate: canCuda ? 2 * MB : 800 * KB,
                },
                {
                    packageName: 'facexlib',
                    version: '0.2.5',
                    sizeEstimate: 1.1 * MB,
                },
            ],
            description:
                'PyTorch uses .pth models to upscale images, and is fastest when CUDA is supported (Nvidia GPU). If CUDA is unsupported, it will install with CPU support (which is very slow).',
        },
        {
            name: 'NCNN',
            packages: [
                {
                    packageName: 'ncnn-vulkan',
                    version: '2022.9.12',
                    sizeEstimate: isMac ? 7 * MB : 4 * MB,
                    autoUpdate: true,
                },
            ],
            description:
                'NCNN uses .bin/.param models to upscale images. NCNN uses Vulkan for GPU acceleration, meaning it supports any modern GPU. Models can be converted from PyTorch to NCNN.',
        },
        {
            name: 'ONNX',
            packages: [
                {
                    packageName: 'onnx',
                    version: '1.12.0',
                    sizeEstimate: 12 * MB,
                },
                {
                    packageName: 'onnxoptimizer',
                    version: '0.3.1',
                    sizeEstimate: 300 * KB,
                },
                {
                    packageName: canCuda ? 'onnxruntime-gpu' : 'onnxruntime',
                    sizeEstimate: canCuda ? 110 * MB : 5 * MB,
                    version: '1.12.1',
                },
                {
                    packageName: 'protobuf',
                    version: '3.16.0',
                    sizeEstimate: 500 * KB,
                },
            ],
            description:
                'ONNX uses .onnx models to upscale images. It also helps to convert between PyTorch and NCNN. It is fastest when CUDA is supported. If TensorRT is installed on the system, it can also be configured to use that.',
        },
    ];
};

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
        packages: [{ packageName: 'opencv-python', version: '4.6.0.66', sizeEstimate: 30 * MB }],
    },
    {
        name: 'NumPy',
        packages: [{ packageName: 'numpy', version: '1.23.2', sizeEstimate: 15 * MB }],
    },
    {
        name: 'Pillow (PIL)',
        packages: [{ packageName: 'Pillow', version: '9.2.0', sizeEstimate: 3 * MB }],
    },
    {
        name: 'appdirs',
        packages: [{ packageName: 'appdirs', version: '1.4.4', sizeEstimate: 13.5 * KB }],
    },
];

if (isMac && !isM1) {
    requiredDependencies.push({
        name: 'Pasteboard',
        packages: [{ packageName: 'pasteboard', version: '0.3.3', sizeEstimate: 19 * KB }],
    });
} else if (isWindows) {
    requiredDependencies.push({
        name: 'Pywin32',
        packages: [{ packageName: 'pywin32', version: '304' as Version, sizeEstimate: 12 * MB }],
    });
}
