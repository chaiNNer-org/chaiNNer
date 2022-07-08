import { Input } from '@chakra-ui/react';
import { ChangeEvent, memo, useEffect, useState } from 'react';
import { useContextSelector } from 'use-context-selector';
import { useDebouncedCallback } from 'use-debounce';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { InputProps } from './props';

interface TextInputProps extends InputProps {
    minLength: number;
    maxLength?: number;
    placeholder?: string;
}

export const TextInput = memo(
    ({
        label,
        id,
        inputId,
        useInputData,
        isLocked,
        minLength,
        maxLength,
        placeholder,
    }: TextInputProps) => {
        const isInputLocked = useContextSelector(GlobalVolatileContext, (c) => c.isNodeInputLocked)(
            id,
            inputId
        );

        const [input, setInput, resetInput] = useInputData<string>(inputId);
        const [tempText, setTempText] = useState(input ?? '');

        useEffect(() => {
            if (input === undefined && minLength === 0) {
                setInput('');
            }
        }, []);

        const handleChange = useDebouncedCallback((event: ChangeEvent<HTMLInputElement>) => {
            let text = event.target.value;
            text = maxLength ? text.slice(0, maxLength) : text;
            if (text.length >= minLength) {
                setInput(text);
            } else {
                resetInput();
            }
        }, 500);

        return (
            <Input
                className="nodrag"
                disabled={isLocked || isInputLocked}
                draggable={false}
                maxLength={maxLength}
                placeholder={placeholder ?? label}
                value={tempText}
                onChange={(event) => {
                    setTempText(event.target.value);
                    handleChange(event);
                }}
            />
        );
    }
);
