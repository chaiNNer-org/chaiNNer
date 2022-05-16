import { Select } from '@chakra-ui/react';
import { ChangeEvent, memo, useEffect } from 'react';
import { InputOption } from '../../../common/common-types';
import { InputProps } from './props';

interface DropDownInputProps extends InputProps {
    options: readonly InputOption[];
}

const DropDownInput = memo(({ options, index, useInputData, isLocked }: DropDownInputProps) => {
    const [selection, setSelection] = useInputData<string | number>(index);

    const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
        const { value } = event.target;
        setSelection(value);
    };

    useEffect(() => {
        if (selection === undefined) {
            setSelection(options[0].value);
        }
    }, []);

    return (
        <Select
            className="nodrag"
            disabled={isLocked}
            draggable={false}
            value={selection}
            onChange={handleChange}
        >
            {options.map(({ option, value }) => (
                <option
                    key={option}
                    value={value}
                >
                    {option}
                </option>
            ))}
        </Select>
    );
});

export default DropDownInput;
