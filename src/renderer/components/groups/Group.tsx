import { memo } from 'react';
import {
    Group,
    GroupKind,
    Input,
    InputData,
    InputSize,
    SchemaId,
} from '../../../common/common-types';
import { FromToDropdownsGroup } from './FromToDropdownsGroup';
import { NcnnFileInputsGroup } from './NcnnFileInputsGroup';
import { OptionalInputsGroup } from './OptionalInputsGroup';
import { GroupProps } from './props';

const GroupComponents: {
    readonly [K in GroupKind]: React.MemoExoticComponent<(props: GroupProps<K>) => JSX.Element>;
} = {
    'from-to-dropdowns': FromToDropdownsGroup,
    'ncnn-file-inputs': NcnnFileInputsGroup,
    'optional-list': OptionalInputsGroup,
};

interface GroupElementProps {
    group: Group;
    inputs: readonly Input[];
    schemaId: SchemaId;
    nodeId: string;
    isLocked: boolean;
    inputData: InputData;
    inputSize: InputSize | undefined;
}

export const GroupElement = memo(
    ({ group, inputs, schemaId, nodeId, isLocked, inputData, inputSize }: GroupElementProps) => {
        const GroupType = GroupComponents[group.kind];
        return (
            <GroupType
                group={group as never}
                inputData={inputData}
                inputSize={inputSize}
                inputs={inputs as never}
                isLocked={isLocked}
                nodeId={nodeId}
                schemaId={schemaId}
            />
        );
    }
);
