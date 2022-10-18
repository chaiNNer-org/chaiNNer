import { FunctionCallExpression, Type, evaluate } from '@chainner/navi';
import { Input } from '@chakra-ui/react';
import { ChangeEvent, memo, useEffect, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { getChainnerScope } from '../../../common/types/chainner-scope';
import { NewInputProps } from './props';

const typeToString = (type: Type): Type => {
    return evaluate(new FunctionCallExpression('toString', [type]), getChainnerScope());
};

export const TextInput = memo(
    ({
        value,
        setValue,
        input,
        isLocked,
        useInputLocked,
        useInputType,
    }: NewInputProps<'text-line', string>) => {
        const { label, minLength, maxLength, placeholder } = input;

        const [tempText, setTempText] = useState(value ?? '');

        useEffect(() => {
            if (value === undefined && minLength === 0) {
                setValue('');
            }
        }, []);

        const handleChange = useDebouncedCallback((event: ChangeEvent<HTMLInputElement>) => {
            let text = event.target.value;
            text = maxLength ? text.slice(0, maxLength) : text;
            if (!minLength || text.length >= minLength) {
                setValue(text);
            } else {
                resetInput();
            }
        }, 500);

        const isInputLocked = useInputLocked();
        const inputType = useInputType();
        const strType = inputType.underlying === 'number' ? typeToString(inputType) : inputType;
        const typeText =
            strType.underlying === 'string' && strType.type === 'literal'
                ? strType.value
                : undefined;

        return (
            <Input
                className="nodrag"
                disabled={isLocked || isInputLocked}
                draggable={false}
                maxLength={maxLength ?? undefined}
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
