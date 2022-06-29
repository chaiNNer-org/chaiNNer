import { evaluate } from '../../common/types/evaluate';
import { NamedExpression } from '../../common/types/expression';
import { intersect } from '../../common/types/intersection';
import { TypeDefinitions } from '../../common/types/typedef';
import { NumberType, StringType, Type } from '../../common/types/types';

const defaultColor = () => '#718096';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const colorList = (typeDefinitions: TypeDefinitions, isDarkMode = true) => [
    { type: evaluate(new NamedExpression('Directory'), typeDefinitions), color: '#805AD5' },
    { type: evaluate(new NamedExpression('Image'), typeDefinitions), color: '#D69E2E' },
    { type: NumberType.instance, color: '#3182CE' },
    { type: StringType.instance, color: '#00B5D8' },
    { type: evaluate(new NamedExpression('PyTorchModel'), typeDefinitions), color: '#DD6B20' },
    { type: evaluate(new NamedExpression('OnnxModel'), typeDefinitions), color: '#63B3ED' },
    { type: evaluate(new NamedExpression('NcnnNetwork'), typeDefinitions), color: '#ED64A6' },
];

export default (inputType: Type, typeDefinitions: TypeDefinitions, isDarkMode = true): string[] => {
    const colors: string[] = [];
    for (const { type, color } of colorList(typeDefinitions, isDarkMode)) {
        if (intersect(type, inputType).type !== 'never') {
            colors.push(color);
        }
    }
    return colors.length > 0 ? colors : [defaultColor()];
};
