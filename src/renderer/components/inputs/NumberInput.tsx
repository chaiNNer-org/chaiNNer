import { HStack } from '@chakra-ui/react';
import { memo, useEffect, useState } from 'react';
import { useContextSelector } from 'use-context-selector';
import { areApproximatelyEqual } from '../../../common/util';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { AdvancedNumberInput } from './elements/AdvanceNumberInput';
import { InputProps } from './props';

interface NumericalInputProps extends InputProps {
    precision: number;
    controlsStep: number;
    min?: number | null;
    max?: number | null;
    def: number;
    unit?: string | null;
    hideTrailingZeros: boolean;
}

export const NumberInput = memo(
    ({
        id,
        inputId,
        useInputData,
        def,
        min,
        max,
        precision,
        controlsStep,
        unit,
        hideTrailingZeros,
        isLocked,
    }: NumericalInputProps) => {
        const isInputLocked = useContextSelector(GlobalVolatileContext, (c) => c.isNodeInputLocked)(
            id,
            inputId
        );

        // TODO: make sure this is always a number
        const [input, setInput] = useInputData<number>(inputId);
        const [inputString, setInputString] = useState(String(input ?? def));

        useEffect(() => {
            const asNumber = parseFloat(inputString);
            if (
                !Number.isNaN(asNumber) &&
                input !== undefined &&
                !areApproximatelyEqual(asNumber, input)
            ) {
                setInputString(String(input));
            }
        }, [input]);

        const typeNumberString = useContextSelector(GlobalVolatileContext, (c) => {
            const type = c.typeState.functions.get(id)?.inputs.get(inputId);
            return type && type.underlying === 'number' && type.type === 'literal'
                ? type.toString()
                : '';
        });

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
                    setInput={setInput}
                    setInputString={setInputString}
                    unit={unit}
                />
            </HStack>
        );
    }
);
