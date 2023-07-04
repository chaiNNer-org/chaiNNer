import { Center, VStack } from '@chakra-ui/react';
import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useContext, useContextSelector } from 'use-context-selector';
import { NodeData } from '../../../common/common-types';
import { DisabledStatus, getDisabledStatus } from '../../../common/nodes/disabled';
import { BackendContext } from '../../contexts/BackendContext';
import { GlobalContext, GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { getCategoryAccentColor } from '../../helpers/accentColors';
import { shadeColor } from '../../helpers/colorTools';
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
    const effectivelyDisabledNodes = useContextSelector(
        GlobalVolatileContext,
        (c) => c.effectivelyDisabledNodes
    );
    const { updateIteratorBounds, setHoveredNode, setNodeInputValue, setNodeInputSize } =
        useContext(GlobalContext);
    const { schemata, categories } = useContext(BackendContext);

    const { id, inputData, inputSize, isLocked, parentNode, schemaId } = data;
    const animated = useContextSelector(GlobalVolatileContext, (c) => c.isAnimated(id));

    const setInputValue = useMemo(() => setNodeInputValue.bind(null, id), [id, setNodeInputValue]);
    const setInputSize = useMemo(() => setNodeInputSize.bind(null, id), [id, setNodeInputSize]);

    // We get inputs and outputs this way in case something changes with them in the future
    // This way, we have to do less in the migration file
    const schema = schemata.get(schemaId);
    const { icon, category, name } = schema;

    const regularBorderColor = 'var(--node-border-color)';
    const accentColor = getCategoryAccentColor(categories, category);
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
                        icon={icon}
                        name={name}
                        parentNode={parentNode}
                        selected={selected}
                    />
                    <NodeBody
                        id={id}
                        inputData={inputData}
                        inputSize={inputSize}
                        isLocked={isLocked}
                        schema={schema}
                        setInputSize={setInputSize}
                        setInputValue={setInputValue}
                    />
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
