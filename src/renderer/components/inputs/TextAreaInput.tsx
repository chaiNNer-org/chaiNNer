import { Textarea } from '@chakra-ui/react';
import { ChangeEvent, memo, useEffect } from 'react';
import { InputProps } from './props';

interface TextAreaInputProps extends InputProps {
    resizable: boolean;
}

const TextAreaInput = memo(
    ({ label, index, useInputData, isLocked, resizable }: TextAreaInputProps) => {
        const [input, setInput] = useInputData<string>(index);

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
