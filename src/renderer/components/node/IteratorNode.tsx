import { Center, Text, VStack, useColorModeValue } from '@chakra-ui/react';
import { memo, useMemo, useRef } from 'react';
import { useContext, useContextSelector } from 'use-context-selector';
import { NodeData } from '../../../common/common-types';
import { BackendContext } from '../../contexts/BackendContext';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { shadeColor } from '../../helpers/colorTools';
import { DisabledStatus } from '../../helpers/disabled';
import { getNodeAccentColor } from '../../helpers/getNodeAccentColor';
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
    const { schemata } = useContext(BackendContext);

    const {
        id,
        inputData,
        isLocked,
        schemaId,
        iteratorSize,
        minWidth,
        minHeight,
        percentComplete,
    } = data;
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

    const iteratorBoxRef = useRef<HTMLDivElement | null>(null);

    const disabled = useDisabled(data);
    const menu = useNodeMenu(data, disabled, { canLock: false });

    return (
        <Center
            bg={useColorModeValue('gray.300', 'gray.750')}
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
                <VStack w="full">
                    <IteratorNodeHeader
                        accentColor={accentColor}
                        disabledStatus={disabled.status}
                        icon={icon}
                        name={name}
                        percentComplete={percentComplete}
                        selected={selected}
                    />
                    {inputs.length && (
                        <Center>
                            <Text
                                fontSize="xs"
                                m={0}
                                mb={-1}
                                mt={-1}
                                p={0}
                            >
                                INPUTS
                            </Text>
                        </Center>
                    )}
                    <NodeInputs
                        accentColor={accentColor}
                        id={id}
                        inputData={inputData}
                        inputs={inputs}
                        isLocked={isLocked}
                        schemaId={schemaId}
                    />
                    <Center>
                        <Text
                            fontSize="xs"
                            m={0}
                            mb={-1}
                            mt={-1}
                            p={0}
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
                    {outputs.length > 0 && (
                        <Center>
                            <Text
                                fontSize="xs"
                                m={0}
                                mb={-1}
                                mt={-1}
                                p={0}
                            >
                                OUTPUTS
                            </Text>
                        </Center>
                    )}
                    <NodeOutputs
                        id={id}
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
