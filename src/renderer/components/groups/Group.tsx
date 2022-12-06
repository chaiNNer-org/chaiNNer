import { memo } from 'react';
import { Group, GroupKind, InputData, InputSize, SchemaId } from '../../../common/common-types';
import { InputItem } from '../../../common/group-inputs';
import { ConditionalEnumGroup } from './ConditionalEnumGroup';
import { FromToDropdownsGroup } from './FromToDropdownsGroup';
import { NcnnFileInputsGroup } from './NcnnFileInputsGroup';
import { OptionalInputsGroup } from './OptionalInputsGroup';
import { GroupProps, InputItemRenderer } from './props';

const GroupComponents: {
    readonly [K in GroupKind]: React.MemoExoticComponent<(props: GroupProps<K>) => JSX.Element>;
} = {
    'conditional-enum': ConditionalEnumGroup,
    'from-to-dropdowns': FromToDropdownsGroup,
    'ncnn-file-inputs': NcnnFileInputsGroup,
    'optional-list': OptionalInputsGroup,
};

interface GroupElementProps {
    group: Group;
    inputs: readonly InputItem[];
    schemaId: SchemaId;
    nodeId: string;
    isLocked: boolean;
    inputData: InputData;
    inputSize: InputSize | undefined;
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
        inputSize,
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
            />
        );
    }
);
