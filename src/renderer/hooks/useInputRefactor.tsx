import { MenuDivider, MenuItem } from '@chakra-ui/react';
import { clipboard } from 'electron';
import { useTranslation } from 'react-i18next';
import { CgArrowsExpandUpLeft } from 'react-icons/cg';
import { MdContentCopy } from 'react-icons/md';
import { useReactFlow } from 'reactflow';
import { useContext } from 'use-context-selector';
import {
    EdgeData,
    Input,
    InputId,
    InputKind,
    InputValue,
    NodeData,
    OutputId,
    PartialBy,
    SchemaId,
} from '../../common/common-types';
import { createInputOverrideId } from '../../common/input-override';
import { createUniqueId } from '../../common/util';
import { BackendContext } from '../contexts/BackendContext';
import { FakeNodeContext } from '../contexts/FakeExampleContext';
import { GlobalContext } from '../contexts/GlobalNodeState';

const valueNodeMap = {
    number: 'chainner:utility:number' as SchemaId,
    slider: 'chainner:utility:number' as SchemaId,
    text: 'chainner:utility:text' as SchemaId,
    directory: 'chainner:utility:directory' as SchemaId,
} as const satisfies Partial<Record<InputKind, SchemaId>>;

export const useInputRefactor = (
    nodeId: string | undefined,
    input: Omit<PartialBy<Input, 'id'>, 'type' | 'conversion'>,
    value: InputValue,
    isConnected: boolean
): JSX.Element | null => {
    const { t } = useTranslation();
    const { createNode, createEdge } = useContext(GlobalContext);
    const { schemata } = useContext(BackendContext);
    const { getNode } = useReactFlow<NodeData, EdgeData>();
    const { isFake } = useContext(FakeNodeContext);

    const inputId = input.id;
    if (isFake || nodeId === undefined || inputId === undefined) {
        return null;
    }

    const refactoringOptions: (JSX.Element | 'divider')[] = [];
    const specificInput = input as Input;

    // extract value into node
    if (
        specificInput.hasHandle &&
        ((specificInput.kind === 'text' && !specificInput.multiline) ||
            specificInput.kind === 'number' ||
            specificInput.kind === 'slider' ||
            specificInput.kind === 'directory')
    ) {
        refactoringOptions.push(
            <MenuItem
                icon={<CgArrowsExpandUpLeft />}
                isDisabled={isConnected || value === undefined}
                key="extract text"
                onClick={() => {
                    const containingNode = getNode(nodeId);
                    const valueNodeId = createUniqueId();

                    let inputIndex = 0;
                    if (containingNode) {
                        const schema = schemata.get(containingNode.data.schemaId);
                        inputIndex = schema.inputs.findIndex((i) => i.id === inputId);
                    }

                    createNode({
                        id: valueNodeId,
                        position: {
                            x: (containingNode?.position.x ?? 0) - 300,
                            y: (containingNode?.position.y ?? 0) - 30 + inputIndex * 50,
                        },
                        data: {
                            schemaId: valueNodeMap[specificInput.kind],
                            inputData: { [0 as InputId]: value },
                        },
                        nodeType: 'regularNode',
                    });
                    createEdge(
                        { nodeId: valueNodeId, outputId: 0 as OutputId },
                        { nodeId, inputId }
                    );
                }}
            >
                {t('inputs.extractValueIntoNode', 'Extract value into node')}
            </MenuItem>
        );
    }

    // copy override id
    if (
        specificInput.kind === 'directory' ||
        specificInput.kind === 'file' ||
        specificInput.kind === 'text' ||
        specificInput.kind === 'number' ||
        specificInput.kind === 'slider'
    ) {
        refactoringOptions.push(
            'divider',
            <MenuItem
                icon={<MdContentCopy />}
                key="copy override"
                onClick={() => {
                    clipboard.writeText(createInputOverrideId(nodeId, inputId));
                }}
            >
                {t('inputs.copyInputOverrideId', 'Copy Input Override Id')}
            </MenuItem>
        );
    }

    // handle dividers
    const finalOptions = refactoringOptions.filter(
        (o, i) => o !== 'divider' || (i > 0 && refactoringOptions[i - 1] !== 'divider')
    );

    if (finalOptions.length === 0) return null;
    return (
        <>
            <MenuDivider />
            {finalOptions.map((o, i) =>
                // eslint-disable-next-line react/no-array-index-key
                o === 'divider' ? <MenuDivider key={`divider ${i}`} /> : o
            )}
        </>
    );
};
