import { isNumericLiteral } from '@chainner/navi';
import { HStack, MenuItem, MenuList, Text, VStack } from '@chakra-ui/react';
import { clipboard } from 'electron';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MdContentCopy, MdContentPaste } from 'react-icons/md';
import { useContext, useContextSelector } from 'use-context-selector';
import { Input, OfKind } from '../../../common/common-types';
import { assertNever } from '../../../common/util';
import { BackendContext } from '../../contexts/BackendContext';
import { InputContext } from '../../contexts/InputContext';
import { useContextMenu } from '../../hooks/useContextMenu';
import { useInputRefactor } from '../../hooks/useInputRefactor';
import { AdvancedNumberInput } from './elements/AdvanceNumberInput';
import {
    LINEAR_SCALE,
    LogScale,
    PowerScale,
    Scale,
    SliderStyle,
    StyledSlider,
    getSliderHeight,
} from './elements/StyledSlider';
import { WithLabel, WithoutLabel } from './InputContainer';
import { InputProps } from './props';

const parseScale = (
    input: Pick<OfKind<Input, 'slider'>, 'scale' | 'min' | 'max' | 'precision'>
): Scale => {
    switch (input.scale) {
        case 'linear':
            return LINEAR_SCALE;
        case 'log':
            return new LogScale(input.min, input.max, input.precision);
        case 'log-offset':
            return new LogScale(input.min, input.max, input.precision, 0.66);
        case 'sqrt':
            return new PowerScale(0.5, input.min, input.precision);
        default:
            return assertNever(input.scale);
    }
};

const tryEvaluate = (expression: string, args: Record<string, unknown>): string | undefined => {
    try {
        return String(
            // eslint-disable-next-line @typescript-eslint/no-implied-eval
            new Function(...Object.keys(args), `return ${expression};`)(...Object.values(args))
        );
    } catch (error) {
        return undefined;
    }
};

const wholeNumberDigitsOf = (n: number) => Math.floor(Math.abs(n)).toString().length;
const computeInputWidthRem = (
    input: Pick<OfKind<Input, 'slider'>, 'min' | 'max' | 'precision'>
) => {
    const { min, max, precision } = input;

    const digits = Math.max(wholeNumberDigitsOf(min), wholeNumberDigitsOf(max)) + precision;
    const sign = min < 0 ? 1 : 0;
    return 1.85 + (digits + sign) * 0.4;
};

export const SliderInput = memo(
    ({
        value,
        setValue,
        input,
        isConnected,
        isLocked,
        inputType,
        nodeId,
        nodeSchemaId,
    }: InputProps<'slider', number>) => {
        const {
            def,
            min,
            max,
            precision,
            controlsStep,
            sliderStep,
            unit,
            hideTrailingZeros,
            noteExpression,
            ends,
        } = input;

        const [inputString, setInputString] = useState(String(value ?? def));
        const [sliderValue, setSliderValue] = useState(value ?? def);

        const precisionOutput = useCallback(
            (val: number) => (hideTrailingZeros ? String(val) : val.toFixed(precision)),
            [hideTrailingZeros, precision]
        );

        useEffect(() => {
            setSliderValue(value ?? def);
            if (!Number.isNaN(value)) {
                setInputString(precisionOutput(value ?? def));
            }
        }, [value, def, precisionOutput]);

        const onSliderChange = useCallback(
            (n: number) => {
                setInputString(precisionOutput(n));
                setSliderValue(n);
            },
            [precisionOutput]
        );
        const onNumberInputChange = (numberAsString: string) => {
            setInputString(numberAsString);
            setSliderValue(Number(numberAsString));
        };

        // dynamic number input width based on precision
        const schema = useContextSelector(
            BackendContext,
            (c) => nodeSchemaId && c.schemata.get(nodeSchemaId)
        );
        const inputWidthRem = useMemo(() => {
            const ownWidth = computeInputWidthRem(input);
            if (!schema) return ownWidth;
            return Math.max(
                ownWidth,
                ...schema.inputs.map((i) => {
                    if (i.kind === 'slider') return computeInputWidthRem(i);
                    return -Infinity;
                })
            );
        }, [input, schema]);

        const typeNumber = isNumericLiteral(inputType) ? inputType.value : undefined;
        const typeNumberString = typeNumber !== undefined ? precisionOutput(typeNumber) : '';

        const displaySliderValue: number = isConnected ? typeNumber ?? def : sliderValue;
        const expr = noteExpression
            ? tryEvaluate(noteExpression, {
                  min,
                  max,
                  value: displaySliderValue,
              })
            : undefined;
        const filled = !expr;

        const { t } = useTranslation();
        const refactor = useInputRefactor(nodeId, input, value, isConnected);

        const menu = useContextMenu(() => (
            <MenuList className="nodrag">
                <MenuItem
                    icon={<MdContentCopy />}
                    onClick={() => {
                        clipboard.writeText(String(displaySliderValue));
                    }}
                >
                    {t('inputs.number.copyText', 'Copy Number')}
                </MenuItem>
                <MenuItem
                    icon={<MdContentPaste />}
                    onClick={() => {
                        const n = Number(clipboard.readText());
                        if (!Number.isNaN(n) && min <= n && max >= n) {
                            setValue(n);
                        }
                    }}
                >
                    {t('inputs.number.paste', 'Paste')}
                </MenuItem>
                {refactor}
            </MenuList>
        ));

        const { conditionallyInactive: unused } = useContext(InputContext);
        const scale = useMemo(() => parseScale(input), [input]);
        const sliderStyle = useMemo((): SliderStyle => {
            let { label } = input;
            if (input.unit) label += ` (${input.unit})`;

            if (input.gradient) {
                return { type: 'label', label, unused, gradient: input.gradient };
            }
            if (!filled) {
                return { type: 'no-fill' };
            }
            return { type: 'label', label, unused };
        }, [input, filled, unused]);

        const slider = (
            <VStack w="full">
                <HStack w="full">
                    {ends[0] && <Text fontSize="xs">{ends[0]}</Text>}
                    <StyledSlider
                        def={def}
                        isDisabled={isLocked || isConnected}
                        max={max}
                        min={min}
                        scale={scale}
                        step={sliderStep}
                        style={sliderStyle}
                        tooltip={`${precisionOutput(displaySliderValue)}${unit ?? ''}`}
                        value={displaySliderValue}
                        onChange={onSliderChange}
                        onChangeEnd={setValue}
                        onContextMenu={menu.onContextMenu}
                    />
                    {ends[1] && <Text fontSize="xs">{ends[1]}</Text>}
                    <AdvancedNumberInput
                        small
                        controlsStep={controlsStep}
                        defaultValue={def}
                        hideTrailingZeros={hideTrailingZeros}
                        inputHeight={
                            sliderStyle.type === 'label' ? getSliderHeight(sliderStyle) : undefined
                        }
                        inputString={isConnected ? typeNumberString : inputString}
                        inputWidth={`${inputWidthRem}rem`}
                        isDisabled={isLocked || isConnected}
                        max={max}
                        min={min}
                        precision={precision}
                        setInput={setValue}
                        setInputString={onNumberInputChange}
                        unit={sliderStyle.type === 'label' ? undefined : unit}
                        onContextMenu={menu.onContextMenu}
                    />
                </HStack>
                {expr && <Text fontSize="xs">{expr}</Text>}
            </VStack>
        );

        if (sliderStyle.type === 'label') {
            return <WithoutLabel>{slider}</WithoutLabel>;
        }

        return <WithLabel input={input}>{slider}</WithLabel>;
    }
);
