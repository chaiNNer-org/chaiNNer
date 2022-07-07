import { evaluate } from '../../common/types/evaluate';
import { NamedExpression } from '../../common/types/expression';
import { isDisjointWith } from '../../common/types/intersection';
import { TypeDefinitions } from '../../common/types/typedef';
import { NumberType, StringType, Type } from '../../common/types/types';

const defaultColor = () => '#718096';

const colorList = (typeDefinitions: TypeDefinitions) => [
    { type: evaluate(new NamedExpression('Directory'), typeDefinitions), color: '#805AD5' },
    { type: evaluate(new NamedExpression('Image'), typeDefinitions), color: '#D69E2E' },
    { type: NumberType.instance, color: '#3182CE' },
    { type: StringType.instance, color: '#10b52c' },
    { type: evaluate(new NamedExpression('PyTorchModel'), typeDefinitions), color: '#DD6B20' },
    { type: evaluate(new NamedExpression('OnnxModel'), typeDefinitions), color: '#63B3ED' },
    { type: evaluate(new NamedExpression('NcnnNetwork'), typeDefinitions), color: '#ED64A6' },
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default (inputType: Type, typeDefinitions: TypeDefinitions, isDarkMode = true): string[] => {
    const colors: string[] = [];
    for (const { type, color } of colorList(typeDefinitions)) {
        if (!isDisjointWith(type, inputType)) {
            colors.push(color);
        }
    }
    return colors.length > 0 ? colors : [defaultColor()];
};
