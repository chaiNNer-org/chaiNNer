import { Center, VStack } from '@chakra-ui/react';
import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useContext, useContextSelector } from 'use-context-selector';
import { NodeData } from '../../../common/common-types';
import { DisabledStatus, getDisabledStatus } from '../../../common/nodes/disabled';
import { BackendContext } from '../../contexts/BackendContext';
import { GlobalContext, GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { getCategoryAccentColor } from '../../helpers/accentColors';
import { shadeColor } from '../../helpers/colorTools';
import { useNodeStateFromData } from '../../helpers/nodeState';
import { useDisabled } from '../../hooks/useDisabled';
import { useValidity } from '../../hooks/useValidity';
import { NodeBody } from './NodeBody';
import { NodeFooter } from './NodeFooter/NodeFooter';
import { NodeHeader } from './NodeHeader';

interface IteratorHelperNodeProps {
    data: NodeData;
    selected: boolean;
}

export const IteratorHelperNode = memo(({ data, selected }: IteratorHelperNodeProps) => {
    const nodeState = useNodeStateFromData(data);
    const { schema } = nodeState;

    const effectivelyDisabledNodes = useContextSelector(
        GlobalVolatileContext,
        (c) => c.effectivelyDisabledNodes
    );
    const { updateIteratorBounds, setHoveredNode } = useContext(GlobalContext);
    const { categories } = useContext(BackendContext);

    const { id, inputData, parentNode } = data;
    const animated = useContextSelector(GlobalVolatileContext, (c) => c.isAnimated(id));

    const regularBorderColor = 'var(--node-border-color)';
    const accentColor = getCategoryAccentColor(categories, schema.category);
    const borderColor = useMemo(
        () => (selected ? shadeColor(accentColor, 0) : regularBorderColor),
        [selected, accentColor, regularBorderColor]
    );

    const { validity } = useValidity(id, schema, inputData);

    const disabledStatus = useMemo(
        () => getDisabledStatus(data, effectivelyDisabledNodes),
        [data, effectivelyDisabledNodes]
    );

    const targetRef = useRef<HTMLDivElement>(null);
    const [checkedSize, setCheckedSize] = useState(false);

    useLayoutEffect(() => {
        if (targetRef.current && parentNode) {
            updateIteratorBounds(parentNode, null, {
                width: targetRef.current.offsetWidth,
                height: targetRef.current.offsetHeight,
            });
            setCheckedSize(true);
        }
    }, [checkedSize, updateIteratorBounds, parentNode]);

    const disabled = useDisabled(data);

    return (
        <Center
            bg="var(--node-bg-color)"
            borderColor={borderColor}
            borderRadius="lg"
            borderWidth="0.5px"
            boxShadow="lg"
            opacity={disabledStatus === DisabledStatus.Enabled ? 1 : 0.75}
            overflow="hidden"
            ref={targetRef}
            transition="0.15s ease-in-out"
            onClick={() => {}}
            onContextMenu={() => {}}
            onDragEnter={() => {
                if (parentNode) {
                    setHoveredNode(parentNode);
                }
            }}
        >
            <VStack
                minWidth="240px"
                opacity={disabledStatus === DisabledStatus.Enabled ? 1 : 0.75}
                spacing={0}
            >
                <VStack
                    spacing={0}
                    w="full"
                >
                    <NodeHeader
                        accentColor={accentColor}
                        disabledStatus={disabledStatus}
                        icon={schema.icon}
                        name={schema.name}
                        parentNode={parentNode}
                        selected={selected}
                    />
                    <NodeBody nodeState={nodeState} />
                </VStack>
                <NodeFooter
                    animated={animated}
                    id={id}
                    useDisable={disabled}
                    validity={validity}
                />
            </VStack>
        </Center>
    );
});
