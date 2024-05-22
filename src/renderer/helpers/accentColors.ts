import {
    NamedExpression,
    NumberType,
    StringType,
    Type,
    evaluate,
    isDisjointWith,
} from '@chainner/navi';
import { CategoryMap } from '../../common/CategoryMap';
import { CategoryId } from '../../common/common-types';
import { getChainnerScope } from '../../common/types/chainner-scope';

export const defaultColor = '#718096';

const getComputedColor = (color: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(color);

const colorList = () => {
    const scope = getChainnerScope();
    return [
        {
            type: evaluate(new NamedExpression('Directory'), scope),
            color: getComputedColor('--type-color-directory'),
        },
        {
            type: evaluate(new NamedExpression('Image'), scope),
            color: getComputedColor('--type-color-image'),
        },
        { type: NumberType.instance, color: getComputedColor('--type-color-number') },
        { type: StringType.instance, color: getComputedColor('--type-color-string') },
        {
            type: evaluate(new NamedExpression('bool'), scope),
            color: getComputedColor('--type-color-bool'),
        },
        {
            type: evaluate(new NamedExpression('Color'), scope),
            color: getComputedColor('--type-color-color'),
        },
        {
            type: evaluate(new NamedExpression('PyTorchModel'), scope),
            color: getComputedColor('--type-color-torch'),
        },
        {
            type: evaluate(new NamedExpression('OnnxModel'), scope),
            color: getComputedColor('--type-color-onnx'),
        },
        {
            type: evaluate(new NamedExpression('NcnnNetwork'), scope),
            color: getComputedColor('--type-color-ncnn'),
        },
    ];
};

const defaultColorList = [defaultColor] as const;

export const getTypeAccentColors = (inputType: Type): readonly [string, ...string[]] => {
    const colors: string[] = [];
    const allColors = colorList();
    for (const { type, color } of allColors) {
        if (!isDisjointWith(type, inputType)) {
            colors.push(color);
        }
    }
    return colors.length > 0 && colors.length < allColors.length
        ? (colors as [string, ...string[]])
        : defaultColorList;
};

export const getCategoryAccentColor = (categories: CategoryMap, category: CategoryId) => {
    return categories.get(category)?.color ?? '#718096';
};
