import { Center, Text, VStack, useColorModeValue } from '@chakra-ui/react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useReactFlow } from 'react-flow-renderer';
import { useContext, useContextSelector } from 'use-context-selector';
import { EdgeData, NodeData } from '../../../common/common-types';
import { GlobalContext, GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import checkNodeValidity from '../../helpers/checkNodeValidity';
import getAccentColor from '../../helpers/getNodeAccentColors';
import shadeColor from '../../helpers/shadeColor';
import { useNodeMenu } from '../../hooks/useNodeMenu';
import IteratorNodeBody from './IteratorNodeBody';
import IteratorNodeHeader from './IteratorNodeHeader';
import NodeFooter from './NodeFooter';
import NodeInputs from './NodeInputs';
import NodeOutputs from './NodeOutputs';

interface IteratorNodeProps {
    data: NodeData;
    selected: boolean;
}

const IteratorNodeWrapper = memo(({ data, selected }: IteratorNodeProps) => (
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    <IteratorNode
        data={data}
        selected={selected}
    />
));

const IteratorNode = memo(({ data, selected }: IteratorNodeProps) => {
    const edgeChanges = useContextSelector(GlobalVolatileContext, (c) => c.edgeChanges);
    const { schemata } = useContext(GlobalContext);
    const { getEdges } = useReactFlow<NodeData, EdgeData>();

    const {
        id,
        inputData,
        isLocked,
        schemaId,
        iteratorSize,
        maxWidth,
        maxHeight,
        percentComplete,
    } = data;

    // We get inputs and outputs this way in case something changes with them in the future
    // This way, we have to do less in the migration file
    const { inputs, outputs, icon, category, name } = schemata.get(schemaId);

    const regularBorderColor = useColorModeValue('gray.400', 'gray.600');
    const accentColor = getAccentColor(category);
    const borderColor = useMemo(
        () => (selected ? shadeColor(accentColor, 0) : regularBorderColor),
        [selected, accentColor, regularBorderColor]
    );

    const [validity, setValidity] = useState<[boolean, string]>([false, '']);

    const iteratorBoxRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (inputs.length) {
            setValidity(
                checkNodeValidity({
                    id,
                    inputs,
                    inputData,
                    edges: getEdges(),
                })
            );
        }
    }, [inputData, edgeChanges]);

    const menu = useNodeMenu(id, undefined);

    return (
        <Center
            bg={useColorModeValue('gray.300', 'gray.700')}
            borderColor={borderColor}
            borderRadius="lg"
            borderWidth="0.5px"
            boxShadow="lg"
            py={2}
            transition="0.15s ease-in-out"
            onContextMenu={menu.onContextMenu}
        >
            <VStack minWidth="240px">
                <IteratorNodeHeader
                    accentColor={accentColor}
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
                        maxHeight={maxHeight}
                        maxWidth={maxWidth}
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
                />
                <NodeFooter
                    invalidReason={validity[1]}
                    isValid={validity[0]}
                />
            </VStack>
        </Center>
    );
});

export default memo(IteratorNodeWrapper);
