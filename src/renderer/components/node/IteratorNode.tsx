import { Box, Center, Text, VStack } from '@chakra-ui/react';
import { memo, useMemo, useRef } from 'react';
import { useContext, useContextSelector } from 'use-context-selector';
import { NodeData } from '../../../common/common-types';
import { DisabledStatus } from '../../../common/nodes/disabled';
import { BackendContext } from '../../contexts/BackendContext';
import { ExecutionContext } from '../../contexts/ExecutionContext';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { getCategoryAccentColor } from '../../helpers/accentColors';
import { shadeColor } from '../../helpers/colorTools';
import { useDisabled } from '../../hooks/useDisabled';
import { useNodeMenu } from '../../hooks/useNodeMenu';
import { useValidity } from '../../hooks/useValidity';
import { IteratorNodeBody } from './IteratorNodeBody';
import { IteratorNodeHeader } from './IteratorNodeHeader';
import { NodeFooter } from './NodeFooter/NodeFooter';
import { NodeInputs } from './NodeInputs';
import { NodeOutputs } from './NodeOutputs';

interface IteratorNodeProps {
    data: NodeData;
    selected: boolean;
}

export const IteratorNode = memo(({ data, selected }: IteratorNodeProps) => (
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    <IteratorNodeInner
        data={data}
        selected={selected}
    />
));

const IteratorNodeInner = memo(({ data, selected }: IteratorNodeProps) => {
    const { schemata, categories } = useContext(BackendContext);
    const { getIteratorProgress } = useContext(ExecutionContext);

    const { id, inputData, isLocked, schemaId, iteratorSize, minWidth, minHeight } = data;

    const iteratorProgress = getIteratorProgress(id);

    const animated = useContextSelector(GlobalVolatileContext, (c) => c.isAnimated(id));

    // We get inputs and outputs this way in case something changes with them in the future
    // This way, we have to do less in the migration file
    const schema = schemata.get(schemaId);
    const { inputs, outputs, icon, category, name } = schema;

    const regularBorderColor = 'var(--node-border-color)';
    const accentColor = getCategoryAccentColor(categories, category);
    const borderColor = useMemo(
        () => (selected ? shadeColor(accentColor, 0) : regularBorderColor),
        [selected, accentColor, regularBorderColor]
    );

    const { validity } = useValidity(id, schema, inputData);

    const iteratorBoxRef = useRef<HTMLDivElement | null>(null);

    const disabled = useDisabled(data);
    const menu = useNodeMenu(data, disabled, { canLock: false });

    return (
        <Center
            bg="var(--node-bg-color)"
            borderColor={borderColor}
            borderRadius="lg"
            borderWidth="0.5px"
            boxShadow="lg"
            opacity={disabled.status === DisabledStatus.Enabled ? 1 : 0.75}
            transition="0.15s ease-in-out"
            onContextMenu={menu.onContextMenu}
        >
            <VStack
                minWidth="240px"
                opacity={disabled.status === DisabledStatus.Enabled ? 1 : 0.75}
                spacing={0}
            >
                <VStack
                    spacing={0}
                    w="full"
                >
                    <IteratorNodeHeader
                        accentColor={accentColor}
                        disabledStatus={disabled.status}
                        icon={icon}
                        name={name}
                        iteratorProgress={iteratorProgress}
                        selected={selected}
                    />
                    {inputs.length > 0 && <Box py={1} />}
                    <Box
                        bgColor="var(--bg-700)"
                        w="full"
                    >
                        <NodeInputs
                            id={id}
                            inputData={inputData}
                            isLocked={isLocked}
                            schema={schema}
                        />
                    </Box>
                    <Center>
                        <Text
                            fontSize="xs"
                            m={0}
                            mb={-1}
                            mt={-1}
                            p={1}
                        >
                            ITERATION
                        </Text>
                    </Center>
                    <Center
                        m={0}
                        p={0}
                        ref={iteratorBoxRef}
                    >
                        <IteratorNodeBody
                            accentColor={accentColor}
                            id={id}
                            iteratorSize={iteratorSize}
                            minHeight={minHeight}
                            minWidth={minWidth}
                        />
                    </Center>
                    {outputs.length > 0 && <Box py={1} />}
                    <Box
                        bgColor="var(--bg-700)"
                        w="full"
                    >
                        <NodeOutputs
                            id={id}
                            outputs={outputs}
                            schemaId={schemaId}
                        />
                    </Box>
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
