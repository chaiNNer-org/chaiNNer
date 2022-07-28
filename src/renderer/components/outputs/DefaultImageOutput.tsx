import { Center, Flex, Icon, Spacer, Text, useColorModeValue } from '@chakra-ui/react';
import { memo } from 'react';
import { useReactFlow } from 'react-flow-renderer';
import { BsEyeFill } from 'react-icons/bs';
import { useContext, useContextSelector } from 'use-context-selector';
import { EdgeData, InputId, NodeData, SchemaId } from '../../../common/common-types';
import { createUniqueId, stringifySourceHandle, stringifyTargetHandle } from '../../../common/util';
import { GlobalContext, GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { TypeTag } from '../TypeTag';
import { OutputProps } from './props';

const VIEW_SCHEMA_ID = 'chainner:image:view' as SchemaId;

export const DefaultImageOutput = memo(({ label, id, outputId }: OutputProps) => {
    const type = useContextSelector(GlobalVolatileContext, (c) =>
        c.typeState.functions.get(id)?.outputs.get(outputId)
    );

    const createNode = useContextSelector(GlobalVolatileContext, (c) => c.createNode);
    const createConnection = useContextSelector(GlobalVolatileContext, (c) => c.createConnection);

    const { selectNode } = useContext(GlobalContext);

    const imgBgColor = useColorModeValue('gray.400', 'gray.750');
    const eyeIconColor = useColorModeValue('gray.700', 'gray.400');

    const { getNodes, getEdges } = useReactFlow<NodeData, EdgeData>();

    return (
        <Flex
            h="full"
            minH="2rem"
            verticalAlign="middle"
            w="full"
        >
            <Center
                cursor="zoom-in"
                h="2rem"
                w="2rem"
                onClick={() => {
                    const byId = new Map(getNodes().map((n) => [n.id, n]));

                    // check whether there already is a view node
                    const viewId = getEdges()
                        .filter((e) => e.source === id)
                        .map((e) => e.target)
                        .find((i) => byId.get(i)?.data.schemaId === VIEW_SCHEMA_ID);
                    if (viewId !== undefined) {
                        // select view node
                        selectNode(viewId);
                        return;
                    }

                    const containingNode = byId.get(id);
                    if (containingNode) {
                        const nodeId = createUniqueId();
                        // TODO: This is a bit of hardcoding, but it works
                        createNode(
                            {
                                id: nodeId,
                                position: {
                                    x: containingNode.position.x + (containingNode.width ?? 0) + 75,
                                    y: containingNode.position.y,
                                },
                                data: {
                                    schemaId: VIEW_SCHEMA_ID,
                                },
                                nodeType: 'regularNode',
                            },
                            containingNode.parentNode
                        );
                        createConnection({
                            source: id,
                            sourceHandle: stringifySourceHandle(id, outputId),
                            target: nodeId,
                            targetHandle: stringifyTargetHandle(nodeId, 0 as InputId),
                        });
                    }
                }}
            >
                <Center
                    bgColor={imgBgColor}
                    borderRadius="md"
                    cursor="zoom-in"
                    h="1.75rem"
                    maxH="1.75rem"
                    maxW="1.75rem"
                    minH="1.75rem"
                    minW="1.75rem"
                    overflow="hidden"
                    w="1.75rem"
                >
                    <Icon
                        as={BsEyeFill}
                        color={eyeIconColor}
                    />
                </Center>
            </Center>
            <Spacer />
            {type && (
                <Center
                    h="2rem"
                    verticalAlign="middle"
                >
                    <TypeTag type={type} />
                </Center>
            )}
            <Text
                h="full"
                lineHeight="2rem"
                marginInlineEnd="0.5rem"
                ml={1}
                textAlign="right"
            >
                {label}
            </Text>
        </Flex>
    );
});
