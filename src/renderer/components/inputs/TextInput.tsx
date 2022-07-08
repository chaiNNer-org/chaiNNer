import { Input } from '@chakra-ui/react';
import { ChangeEvent, memo, useEffect, useState } from 'react';
import { useContextSelector } from 'use-context-selector';
import { useDebouncedCallback } from 'use-debounce';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { InputProps } from './props';

interface TextInputProps extends InputProps {
    maxLength?: number;
    placeholder?: string;
}

export const TextInput = memo(
    ({ label, id, inputId, useInputData, isLocked, maxLength, placeholder }: TextInputProps) => {
        const isInputLocked = useContextSelector(GlobalVolatileContext, (c) => c.isNodeInputLocked)(
            id,
            inputId
        );

        const [input, setInput] = useInputData<string>(inputId);
        const [tempText, setTempText] = useState('');

        useEffect(() => {
            if (!input) {
                setInput('');
            } else {
                setTempText(input);
            }
        }, []);

        const handleChange = useDebouncedCallback((event: ChangeEvent<HTMLInputElement>) => {
            let text = event.target.value;
            text = maxLength ? text.slice(0, maxLength) : text;
            setInput(text);
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
