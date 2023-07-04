/* eslint-disable react/prop-types */
import { memo } from 'react';
import { useContext } from 'use-context-selector';
import { getUniqueKey } from '../../../common/group-inputs';
import { BackendContext } from '../../contexts/BackendContext';
import { NodeState } from '../../helpers/nodeState';
import { GroupElement } from '../groups/Group';
import { InputItemRenderer } from '../groups/props';
import { SchemaInput } from '../inputs/SchemaInput';

const ItemRenderer: InputItemRenderer = memo(({ item, nodeState }) => {
    if (item.kind === 'group') {
        const { group } = item;
        return (
            <GroupElement
                ItemRenderer={ItemRenderer}
                group={group}
                inputs={item.inputs}
                nodeState={nodeState}
            />
        );
    }

    return (
        <SchemaInput
            input={item}
            nodeState={nodeState}
        />
    );
});

interface NodeInputsProps {
    nodeState: NodeState;
}

export const NodeInputs = memo(({ nodeState }: NodeInputsProps) => {
    const { schemaInputs } = useContext(BackendContext);

    const inputs = schemaInputs.get(nodeState.schemaId);

    return (
        <>
            {inputs.map((item) => (
                <ItemRenderer
                    item={item}
                    key={getUniqueKey(item)}
                    nodeState={nodeState}
                />
            ))}
        </>
    );
});
