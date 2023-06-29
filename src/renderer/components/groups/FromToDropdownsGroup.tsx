import { Box, HStack } from '@chakra-ui/react';
import { memo, useCallback } from 'react';
import { IoMdArrowForward } from 'react-icons/io';
import { Input, InputData, InputId, InputValue, OfKind } from '../../../common/common-types';
import { getInputValue } from '../../../common/util';
import { DropDown } from '../inputs/elements/Dropdown';
import { InputContainer } from '../inputs/InputContainer';
import { GroupProps } from './props';

interface SmallDropDownProps {
    input: OfKind<Input, 'dropdown'>;
    inputData: InputData;
    setInputValue: (inputId: InputId, value: InputValue) => void;
    isLocked: boolean;
}
const SmallDropDown = memo(({ input, inputData, setInputValue, isLocked }: SmallDropDownProps) => {
    const value = getInputValue<string | number>(input.id, inputData);
    const setValue = useCallback(
        (data?: string | number) => setInputValue(input.id, data ?? input.def),
        [setInputValue, input]
    );

    return (
        <Box w="full">
            <DropDown
                isDisabled={isLocked}
                options={input.options}
                reset={setValue}
                value={value}
                onChange={setValue}
            />
        </Box>
    );
});

export const FromToDropdownsGroup = memo(
    ({ inputs, inputData, setInputValue, isLocked }: GroupProps<'from-to-dropdowns'>) => {
        const [from, to] = inputs;

        return (
            <InputContainer>
                <HStack
                    mb={2}
                    mt={2}
                    w="full"
                >
                    <SmallDropDown
                        input={from}
                        inputData={inputData}
                        isLocked={isLocked}
                        setInputValue={setInputValue}
                    />
                    <Box>
                        <IoMdArrowForward />
                    </Box>
                    <SmallDropDown
                        input={to}
                        inputData={inputData}
                        isLocked={isLocked}
                        setInputValue={setInputValue}
                    />
                </HStack>
            </InputContainer>
        );
    }
);
