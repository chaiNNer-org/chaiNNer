import { memo } from 'react';
import { Group, GroupKind } from '../../../common/common-types';
import { InputItem } from '../../../common/group-inputs';
import { NodeState } from '../../helpers/nodeState';
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
    nodeState: NodeState;
    ItemRenderer: InputItemRenderer;
}

export const GroupElement = memo(
    ({ group, inputs, nodeState, ItemRenderer }: GroupElementProps) => {
        const GroupType = GroupComponents[group.kind];
        return (
            <GroupType
                ItemRenderer={ItemRenderer}
                group={group as never}
                inputs={inputs as never}
                nodeState={nodeState}
            />
        );
    }
);
