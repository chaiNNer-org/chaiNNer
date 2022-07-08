export const getNodeAccentColor = (category: string | undefined): string => {
    switch (category) {
        case 'OpenCV':
            return '#C53030';
        case 'Image':
            return '#C53030';
        case 'Image (Dimensions)':
            return '#3182CE';
        case 'Image (Adjustments)':
            return '#319795';
        case 'Image (Filters)':
            return '#38A169';
        case 'Image (Utilities)':
            return '#00A3C4';
        case 'Image (Channels)':
            return '#D69E2E';
        case 'NumPy':
            return '#2B6CB0';
        case 'PyTorch':
            return '#DD6B20';
        case 'ONNX':
            return '#63B3ED';
        case 'NCNN':
            return '#ED64A6';
        default:
            return '#718096';
    }
};
