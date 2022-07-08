import { Textarea } from '@chakra-ui/react';
import { ChangeEvent, memo, useEffect, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { InputProps } from './props';

interface TextAreaInputProps extends InputProps {
    resizable: boolean;
}

export const TextAreaInput = memo(
    ({ label, inputId, useInputData, isLocked, resizable }: TextAreaInputProps) => {
        const [input, setInput] = useInputData<string>(inputId);
        const [tempText, setTempText] = useState('');

        useEffect(() => {
            if (!input) {
                setInput('');
            } else {
                setTempText(input);
            }
        }, []);

        const handleChange = useDebouncedCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
            const text = event.target.value;
            setInput(text);
        }, 500);

        return (
            <Textarea
                className="nodrag"
                disabled={isLocked}
                draggable={false}
                minW={240}
                placeholder={label}
                resize={resizable ? 'both' : 'none'}
                value={tempText}
                onChange={(event) => {
                    setTempText(event.target.value);
                    handleChange(event);
                }}
            />
        );
    }
);
