import { isNumericLiteral } from '@chainner/navi';
import { HStack } from '@chakra-ui/react';
import { memo, useEffect, useState } from 'react';
import { areApproximatelyEqual } from '../../../common/util';
import { AdvancedNumberInput } from './elements/AdvanceNumberInput';
import { NewInputProps } from './props';

export const NumberInput = memo(
    ({
        value,
        setValue,
        input,
        isLocked,
        useInputLocked,
        useInputType,
    }: NewInputProps<'number', number>) => {
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

        const isInputLocked = useInputLocked();
        const inputType = useInputType();
        const typeNumberString = isNumericLiteral(inputType) ? inputType.toString() : '';

        return (
            <HStack w="full">
                <AdvancedNumberInput
                    controlsStep={controlsStep}
                    defaultValue={def}
                    hideTrailingZeros={hideTrailingZeros}
                    inputString={isInputLocked ? typeNumberString : inputString}
                    isDisabled={isLocked || isInputLocked}
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
