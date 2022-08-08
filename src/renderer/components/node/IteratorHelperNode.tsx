import { Center, VStack, useColorModeValue } from '@chakra-ui/react';
import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useContext, useContextSelector } from 'use-context-selector';
import { NodeData } from '../../../common/common-types';
import { GlobalContext, GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { shadeColor } from '../../helpers/colorTools';
import { DisabledStatus, getDisabledStatus } from '../../helpers/disabled';
import { getNodeAccentColor } from '../../helpers/getNodeAccentColor';
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
    const { schemata, updateIteratorBounds, setHoveredNode } = useContext(GlobalContext);

    const { id, inputData, isLocked, parentNode, schemaId } = data;
    const animated = useContextSelector(GlobalVolatileContext, (c) => c.isAnimated(id));

    // We get inputs and outputs this way in case something changes with them in the future
    // This way, we have to do less in the migration file
    const schema = schemata.get(schemaId);
    const { inputs, outputs, icon, category, name } = schema;

    const regularBorderColor = useColorModeValue('gray.100', 'gray.800');
    const accentColor = getNodeAccentColor(category);
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
    }, [checkedSize, updateIteratorBounds]);

    const disabled = useDisabled(data);

    return (
        <Center
            bg={useColorModeValue('gray.300', 'gray.750')}
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
                <VStack w="full">
                    <NodeHeader
                        accentColor={accentColor}
                        disabledStatus={disabledStatus}
                        icon={icon}
                        name={name}
                        parentNode={parentNode}
                        selected={selected}
                    />
                    <NodeBody
                        accentColor={accentColor}
                        id={id}
                        inputData={inputData}
                        inputs={inputs}
                        isLocked={isLocked}
                        outputs={outputs}
                        schemaId={schemaId}
                    />
                </VStack>
                <NodeFooter
                    animated={animated}
                    useDisable={disabled}
                    validity={validity}
                />
            </VStack>
        </Center>
    );
});
