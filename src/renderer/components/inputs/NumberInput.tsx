import { HStack } from '@chakra-ui/react';
import { memo, useEffect, useState } from 'react';
import { useContextSelector } from 'use-context-selector';
import { areApproximatelyEqual } from '../../../common/util';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { AdvancedNumberInput } from './elements/AdvanceNumberInput';
import { InputProps } from './props';

interface NumericalInputProps extends InputProps {
    offset: number;
    step: number;
    controlsStep: number;
    min?: number | null;
    max?: number | null;
    def: number;
    unit?: string | null;
    hideTrailingZeros: boolean;
}

const NumericalInput = memo(
    ({
        id,
        inputId,
        useInputData,
        def,
        min,
        max,
        offset,
        step,
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

        return (
            <HStack w="full">
                <AdvancedNumberInput
                    controlsStep={controlsStep}
                    defaultValue={def}
                    hideTrailingZeros={hideTrailingZeros}
                    inputString={inputString}
                    isDisabled={isLocked || isInputLocked}
                    max={max ?? Infinity}
                    min={min ?? -Infinity}
                    offset={offset}
                    setInput={setInput}
                    setInputString={setInputString}
                    step={step}
                    unit={unit}
                />
            </HStack>
        );
    }
);

export default NumericalInput;
