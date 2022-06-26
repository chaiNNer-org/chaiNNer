import { evaluate } from '../../common/types/evaluate';
import { NamedExpression } from '../../common/types/expression';
import { isSubsetOf } from '../../common/types/relation';
import { TypeDefinitions } from '../../common/types/typedef';
import { NumberType, StringType, Type } from '../../common/types/types';
import { shadeColor } from './colorTools';

const typeColors = {
    file: '#C53030',
    image: '#D69E2E',
    number: '#3182CE',
    pytorch: '#DD6B20',
    onnx: '#63B3ED',
    ncnn: '#ED64A6',
    default: '#718096',
};

export default (type: Type, typeDefinitions: TypeDefinitions): string => {
    console.log('🚀 ~ file: getTypeAccentColors.ts ~ line 19 ~ type', type);
    console.log(evaluate(new NamedExpression('Image'), typeDefinitions));
    console.log(
        'isSubsetOf(type, evaluate(new NamedExpression(Image), typeDefinitions))',
        isSubsetOf(type, evaluate(new NamedExpression('Image'), typeDefinitions))
    );
    if (isSubsetOf(type, evaluate(new NamedExpression('Image'), typeDefinitions))) {
        return typeColors.image;
    }
    if (isSubsetOf(type, NumberType.instance)) {
        return typeColors.number;
    }
    if (isSubsetOf(type, StringType.instance)) {
        return typeColors.default;
    }
    if (isSubsetOf(type, evaluate(new NamedExpression('PyTorchModel'), typeDefinitions))) {
        return typeColors.pytorch;
    }
    if (isSubsetOf(type, evaluate(new NamedExpression('PthFile'), typeDefinitions))) {
        return shadeColor(typeColors.pytorch, -50);
    }
    if (isSubsetOf(type, evaluate(new NamedExpression('OnnxModel'), typeDefinitions))) {
        return typeColors.onnx;
    }
    if (isSubsetOf(type, evaluate(new NamedExpression('OnnxFile'), typeDefinitions))) {
        return shadeColor(typeColors.onnx, -50);
    }
    if (isSubsetOf(type, evaluate(new NamedExpression('NcnnNetwork'), typeDefinitions))) {
        return typeColors.ncnn;
    }
    if (isSubsetOf(type, evaluate(new NamedExpression('NcnnBinFile'), typeDefinitions))) {
        return shadeColor(typeColors.ncnn, -50);
    }
    if (isSubsetOf(type, evaluate(new NamedExpression('NcnnParamFile'), typeDefinitions))) {
        return shadeColor(typeColors.ncnn, -75);
    }
    return typeColors.default;
};
