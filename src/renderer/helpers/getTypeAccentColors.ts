import {
    NamedExpression,
    NumberType,
    StringType,
    Type,
    evaluate,
    isDisjointWith,
} from '@chainner/navi';
import { getChainnerScope } from '../../common/types/chainner-scope';
import { lazy } from '../../common/util';

export const defaultColor = '#718096';

const colorList = lazy(() => {
    const scope = getChainnerScope();
    return [
        { type: evaluate(new NamedExpression('Directory'), scope), color: '#805AD5' },
        { type: evaluate(new NamedExpression('Image'), scope), color: '#D69E2E' },
        { type: NumberType.instance, color: '#3182CE' },
        { type: StringType.instance, color: '#10b52c' },
        { type: evaluate(new NamedExpression('PyTorchModel'), scope), color: '#DD6B20' },
        { type: evaluate(new NamedExpression('OnnxModel'), scope), color: '#63B3ED' },
        { type: evaluate(new NamedExpression('NcnnNetwork'), scope), color: '#ED64A6' },
    ];
});

const defaultColorList = [defaultColor] as const;

export const getTypeAccentColors = (inputType: Type): readonly [string, ...string[]] => {
    if (inputType.type === 'any') {
        return defaultColorList;
    }

    const colors: string[] = [];
    for (const { type, color } of colorList()) {
        if (!isDisjointWith(type, inputType)) {
            colors.push(color);
        }
    }
    return colors.length > 0 ? (colors as [string, ...string[]]) : defaultColorList;
};
