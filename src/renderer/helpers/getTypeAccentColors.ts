import { ExpressionJson } from '../../common/types/json';

const typeColors = {
    file: '#C53030',
    image: '#D69E2E',
    number: '#3182CE',
    int: '#3182CE',
    float: '#3182CE',
    pytorch: '#DD6B20',
    onnx: '#63B3ED',
    ncnn: '#ED64A6',
    default: '#718096',
};

export default (type: ExpressionJson): string => {
    console.log('🚀 ~ file: getTypeAccentColors.ts ~ line 2 ~ type', type);
    const typeInfoString = JSON.stringify(type).toLowerCase();
    const typeColor = Object.entries(typeColors).find(([typeCheck]) =>
        typeInfoString.includes(typeCheck)
    );
    if (typeColor) {
        return typeColor[1];
    }
    return typeColors.default;
};
