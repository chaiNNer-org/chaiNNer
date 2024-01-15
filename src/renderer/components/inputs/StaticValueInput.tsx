import { memo, useEffect } from 'react';
import { useContext } from 'use-context-selector';
import { ExecutionContext } from '../../contexts/ExecutionContext';
import { InputProps } from './props';

export const StaticValueInput = memo(({ value, setValue, input }: InputProps<'static', number>) => {
    const { valueOf } = input;
    const { executionNumber } = useContext(ExecutionContext);

    useEffect(() => {
        switch (valueOf) {
            case 'execution_number':
                setValue(executionNumber);
                break;
            default:
                setValue(0);
                break;
        }
    }, [value, setValue, valueOf, executionNumber]);

    return <div>{value}</div>;
});
