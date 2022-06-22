export default (type: string | undefined): string => {
    switch (type?.split('::')[0]) {
        case 'file':
            return '#C53030';
        case 'number':
            return '#3182CE';
        case 'Image (Filters)':
            return '#38A169';
        case 'Image (Utilities)':
            return '#00A3C4';
        case 'numpy':
            return '#D69E2E';
        // case 'NumPy':
        //     return '#2B6CB0';
        case 'pytorch':
            return '#DD6B20';
        case 'onnx':
            return '#63B3ED';
        case 'ncnn':
            return '#ED64A6';
        default:
            return '#718096';
    }
};
