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
import { cached } from '../../common/util';

const getComputedColor = (color: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(color);

const resolveName = cached((name: string): Type => {
    const scope = getChainnerScope();
    return evaluate(new NamedExpression(name), scope);
});

const colorList = () => {
    return [
        { type: resolveName('Directory'), color: getComputedColor('--type-color-directory') },
        { type: resolveName('Image'), color: getComputedColor('--type-color-image') },
        { type: NumberType.instance, color: getComputedColor('--type-color-number') },
        { type: StringType.instance, color: getComputedColor('--type-color-string') },
        { type: resolveName('bool'), color: getComputedColor('--type-color-bool') },
        { type: resolveName('Color'), color: getComputedColor('--type-color-color') },
        { type: resolveName('PyTorchModel'), color: getComputedColor('--type-color-torch') },
        { type: resolveName('OnnxModel'), color: getComputedColor('--type-color-onnx') },
        { type: resolveName('NcnnNetwork'), color: getComputedColor('--type-color-ncnn') },
        { type: resolveName('TensorRTEngine'), color: getComputedColor('--type-color-tensorrt') },
    ];
};
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const cachedColorList = cached((_theme: string) => colorList());

export const defaultColor = '#718096';
const defaultColorList = [defaultColor] as const;

export const getTypeAccentColors = (
    inputType: Type,
    theme?: string
): readonly [string, ...string[]] => {
    if (inputType.underlying === 'never') {
        // never is common enough to warrant a special optimization
        return defaultColorList;
    }

    const colors: string[] = [];
    const allColors = theme ? cachedColorList(theme) : colorList();
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
