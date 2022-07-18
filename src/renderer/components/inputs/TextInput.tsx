import { Input } from '@chakra-ui/react';
import { ChangeEvent, memo, useEffect, useState } from 'react';
import { useContextSelector } from 'use-context-selector';
import { useDebouncedCallback } from 'use-debounce';
import { getChainnerScope } from '../../../common/types/chainner-scope';
import { evaluate } from '../../../common/types/evaluate';
import { FunctionCallExpression } from '../../../common/types/expression';
import { Type } from '../../../common/types/types';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { InputProps } from './props';

const typeToString = (type: Type): Type => {
    return evaluate(new FunctionCallExpression('toString', [type]), getChainnerScope());
};

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

        const typeText = useContextSelector(GlobalVolatileContext, (c) => {
            const type = c.typeState.functions.get(id)?.inputs.get(inputId);
            if (!type) return undefined;
            const strType = type.underlying === 'number' ? typeToString(type) : type;
            return strType.underlying === 'string' && strType.type === 'literal'
                ? strType.value
                : undefined;
        });

        return (
            <Input
                className="nodrag"
                disabled={isLocked || isInputLocked}
                draggable={false}
                maxLength={maxLength}
                placeholder={placeholder ?? label}
                value={isInputLocked ? typeText ?? '' : tempText}
                onChange={(event) => {
                    setTempText(event.target.value);
                    handleChange(event);
                }}
            />
        );
    }
);
