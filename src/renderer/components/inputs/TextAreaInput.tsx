import { Textarea } from '@chakra-ui/react';
import { ChangeEvent, memo, useEffect } from 'react';
import { InputProps } from './props';

interface TextAreaInputProps extends InputProps {
    resizable: boolean;
}

const TextAreaInput = memo(
    ({ label, inputId, useInputData, isLocked, resizable }: TextAreaInputProps) => {
        const [input, setInput] = useInputData<string>(inputId);

        useEffect(() => {
            if (!input) {
                setInput('');
            }
        }, []);

        const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
            const text = event.target.value;
            setInput(text);
        };

        return (
            <Textarea
                className="nodrag"
                disabled={isLocked}
                draggable={false}
                minW={240}
                placeholder={label}
                resize={resizable ? 'both' : 'none'}
                value={input ?? ''}
                onChange={handleChange}
            />
        );
    }
);

export default TextAreaInput;
