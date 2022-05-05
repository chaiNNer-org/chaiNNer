import { Textarea } from '@chakra-ui/react';
import { ChangeEvent, memo, useContext, useEffect } from 'react';
import { GlobalContext } from '../../helpers/contexts/GlobalNodeState';

interface TextAreaInputProps {
    id: string;
    index: number;
    isLocked?: boolean;
    label: string;
    resizable: boolean;
}

const TextAreaInput = memo(({ label, id, index, isLocked, resizable }: TextAreaInputProps) => {
    const { useInputData } = useContext(GlobalContext);
    const [input, setInput] = useInputData<string>(id, index);

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
});

export default TextAreaInput;
