import { useEffect } from 'react';
import { DropDownInput, InputSchemaValue } from '../../common/common-types';

export const useValidDropDownValue = (
    value: InputSchemaValue | undefined,
    setValue: (value: InputSchemaValue) => void,
    input: Pick<DropDownInput, 'options' | 'def'>
) => {
    let valid = value ?? input.def;
    if (input.options.every((o) => o.value !== valid)) {
        valid = input.def;
    }

    // reset to valid value
    const resetTo = valid !== value ? valid : undefined;
    useEffect(() => {
        if (resetTo !== undefined) {
            setValue(resetTo);
        }
    }, [resetTo, setValue]);

    return valid;
};
