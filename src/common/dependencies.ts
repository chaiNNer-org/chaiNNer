import { isMac } from './env';

export interface Dependency {
    name: string;
    packageName: string;
    version: string;
    findLink?: string;
}

export const getOptionalDependencies = (isNvidiaAvailable: boolean): Dependency[] => [
    {
        name: 'PyTorch',
        packageName: 'torch',
        version: `1.10.2+${isNvidiaAvailable && !isMac ? 'cu113' : 'cpu'}`,
        findLink: `https://download.pytorch.org/whl/${
            isNvidiaAvailable && !isMac ? 'cu113' : 'cpu'
        }/torch_stable.html`,
    },
    {
        name: 'NCNN',
        packageName: 'ncnn-vulkan',
        version: '2022.4.1',
    },
];

export const requiredDependencies: Dependency[] = [
    {
        name: 'Sanic',
        packageName: 'sanic',
        version: '21.9.3',
    },
    {
        name: 'Sanic Cors',
        packageName: 'Sanic-Cors',
        version: '1.0.1',
    },
    {
        name: 'OpenCV',
        packageName: 'opencv-python',
        version: '4.5.5.64',
    },
    {
        name: 'NumPy',
        packageName: 'numpy',
        version: '1.22.3',
    },
    {
        name: 'Pillow (PIL)',
        packageName: 'Pillow',
        version: '9.1.0',
    },
];
