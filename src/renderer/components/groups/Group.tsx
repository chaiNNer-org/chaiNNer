import { memo } from 'react';
import {
    Group,
    GroupKind,
    InputData,
    InputId,
    InputSize,
    InputValue,
    SchemaId,
    Size,
} from '../../../common/common-types';
import { InputItem } from '../../../common/group-inputs';
import { ConditionalGroup } from './ConditionalGroup';
import { FromToDropdownsGroup } from './FromToDropdownsGroup';
import { NcnnFileInputsGroup } from './NcnnFileInputsGroup';
import { OptionalInputsGroup } from './OptionalInputsGroup';
import { GroupProps, InputItemRenderer } from './props';
import { RequiredGroup } from './RequiredGroup';
import { SeedGroup } from './SeedGroup';

const GroupComponents: {
    readonly [K in GroupKind]: React.MemoExoticComponent<(props: GroupProps<K>) => JSX.Element>;
} = {
    conditional: ConditionalGroup,
    required: RequiredGroup,
    'from-to-dropdowns': FromToDropdownsGroup,
    'ncnn-file-inputs': NcnnFileInputsGroup,
    'optional-list': OptionalInputsGroup,
    seed: SeedGroup,
};

interface GroupElementProps {
    group: Group;
    inputs: readonly InputItem[];
    schemaId: SchemaId;
    nodeId: string;
    isLocked: boolean;
    inputData: InputData;
    setInputValue: (inputId: InputId, value: InputValue) => void;
    inputSize: InputSize | undefined;
    setInputSize: (inputId: InputId, size: Readonly<Size>) => void;
    ItemRenderer: InputItemRenderer;
}

export const GroupElement = memo(
    ({
        group,
        inputs,
        schemaId,
        nodeId,
        isLocked,
        inputData,
        setInputValue,
        inputSize,
        setInputSize,
        ItemRenderer,
    }: GroupElementProps) => {
        const GroupType = GroupComponents[group.kind];
        return (
            <GroupType
                ItemRenderer={ItemRenderer}
                group={group as never}
                inputData={inputData}
                inputSize={inputSize}
                inputs={inputs as never}
                isLocked={isLocked}
                nodeId={nodeId}
                schemaId={schemaId}
                setInputSize={setInputSize}
                setInputValue={setInputValue}
            />
        );
    }
);
