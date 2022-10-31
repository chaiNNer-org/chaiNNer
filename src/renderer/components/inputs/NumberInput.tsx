import { isNumericLiteral } from '@chainner/navi';
import { HStack } from '@chakra-ui/react';
import { memo, useEffect, useState } from 'react';
import { areApproximatelyEqual } from '../../../common/util';
import { AdvancedNumberInput } from './elements/AdvanceNumberInput';
import { InputProps } from './props';

export const NumberInput = memo(
    ({
        value,
        setValue,
        input,
        isLocked,
        useInputConnected,
        useInputType,
    }: InputProps<'number', number>) => {
        const { def, min, max, unit, precision, controlsStep, hideTrailingZeros } = input;

        const [inputString, setInputString] = useState(String(value ?? def));

        useEffect(() => {
            const asNumber = parseFloat(inputString);
            if (
                !Number.isNaN(asNumber) &&
                value !== undefined &&
                !areApproximatelyEqual(asNumber, value)
            ) {
                setInputString(String(value));
            }
        }, [value]);

        const isInputConnected = useInputConnected();
        const inputType = useInputType();
        const typeNumberString = isNumericLiteral(inputType) ? inputType.toString() : '';

        return (
            <HStack w="full">
                <AdvancedNumberInput
                    controlsStep={controlsStep}
                    defaultValue={def}
                    hideTrailingZeros={hideTrailingZeros}
                    inputString={isInputConnected ? typeNumberString : inputString}
                    isDisabled={isLocked || isInputConnected}
                    max={max ?? Infinity}
                    min={min ?? -Infinity}
                    precision={precision}
                    setInput={setValue}
                    setInputString={setInputString}
                    unit={unit}
                />
            </HStack>
        );
    }
);
