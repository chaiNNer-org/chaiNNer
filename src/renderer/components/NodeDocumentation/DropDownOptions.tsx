import { memo } from 'react';
import { InputOption } from '../../../common/common-types';
import { TypeTag } from '../TypeTag';

interface DropDownOptionProps {
    option: InputOption;
}
const DropDownOption = memo(({ option }: DropDownOptionProps) => {
    return (
        <TypeTag
            fontSize="small"
            height="auto"
            key={option.value}
            mt="-0.2rem"
            verticalAlign="middle"
        >
            {option.option}
        </TypeTag>
    );
});

interface DropDownOptionsProps {
    options: readonly InputOption[];
}
export const DropDownOptions = memo(({ options }: DropDownOptionsProps) => {
    return (
        <>
            {options.map((o) => (
                <DropDownOption
                    key={o.value}
                    option={o}
                />
            ))}
        </>
    );
});
