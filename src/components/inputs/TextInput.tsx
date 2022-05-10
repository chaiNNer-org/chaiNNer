import { Input } from '@chakra-ui/react';
import { ChangeEvent, memo, useContext, useEffect, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { GlobalChainContext } from '../../helpers/contexts/GlobalNodeState';
import { InputProps } from './props';

interface TextInputProps extends InputProps {
    maxLength?: number;
}

const TextInput = memo(
    ({ label, id, index, useInputData, isLocked, maxLength }: TextInputProps) => {
        const { isNodeInputLocked } = useContext(GlobalChainContext);

        const [input, setInput] = useInputData<string>(index);
        const [tempText, setTempText] = useState('');
        const isInputLocked = isNodeInputLocked(id, index);

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
                placeholder={label}
                value={tempText}
                onChange={(event) => {
                    setTempText(event.target.value);
                    handleChange(event);
                }}
            />
        );
    }
);

export default TextInput;
