import { Center, Flex, Icon, Spacer, Text } from '@chakra-ui/react';
import { memo } from 'react';
import { BsEyeFill } from 'react-icons/bs';
import { useReactFlow } from 'reactflow';
import { useContext } from 'use-context-selector';
import { EdgeData, InputId, NodeData } from '../../../common/common-types';
import { createUniqueId, stringifySourceHandle } from '../../../common/util';
import { FakeNodeContext } from '../../contexts/FakeExampleContext';
import { GlobalContext } from '../../contexts/GlobalNodeState';
import { TypeTags } from '../TypeTag';
import { OutputProps } from './props';

export const DefaultImageOutput = memo(({ output, id, schema, type }: OutputProps) => {
    const { selectNode, createNode, createEdge } = useContext(GlobalContext);
    const { getNodes, getEdges } = useReactFlow<NodeData, EdgeData>();
    const { isFake } = useContext(FakeNodeContext);

    return (
        <Flex
            h="full"
            minH="2rem"
            verticalAlign="middle"
            w="full"
        >
            {output.previewerSchemaId && (
                <>
                    <Center
                        _hover={{
                            backgroundColor: 'var(--node-image-preview-button-bg-hover)',
                        }}
                        bgColor="var(--node-image-preview-button-bg)"
                        borderRadius="md"
                        cursor="pointer"
                        h="1.75rem"
                        maxH="1.75rem"
                        maxW="1.75rem"
                        minH="1.75rem"
                        minW="1.75rem"
                        my="0.125rem"
                        overflow="hidden"
                        transition="0.15s ease-in-out"
                        w="1.75rem"
                        onClick={() => {
                            if (isFake) return;

                            if (!output.previewerSchemaId) {
                                return;
                            }

                            const byId = new Map(getNodes().map((n) => [n.id, n]));

                            const sourceHandle = stringifySourceHandle({
                                nodeId: id,
                                outputId: output.id,
                            });

                            // check whether there already is a view node
                            const viewId = getEdges()
                                .filter((e) => e.source === id && e.sourceHandle === sourceHandle)
                                .map((e) => e.target)
                                .find(
                                    (i) => byId.get(i)?.data.schemaId === output.previewerSchemaId
                                );
                            if (viewId !== undefined) {
                                // select view node
                                selectNode(viewId);
                                return;
                            }

                            const containingNode = byId.get(id);
                            if (containingNode) {
                                const nodeId = createUniqueId();
                                const outputIndex = schema.outputs.findIndex(
                                    (o) => o.id === output.id
                                );

                                createNode(
                                    {
                                        id: nodeId,
                                        position: {
                                            x:
                                                containingNode.position.x +
                                                (containingNode.width ?? 0) +
                                                75 +
                                                outputIndex * 20,
                                            y: containingNode.position.y + outputIndex * 30,
                                        },
                                        data: {
                                            schemaId: output.previewerSchemaId,
                                        },
                                        nodeType: 'regularNode',
                                    },
                                    containingNode.parentNode
                                );
                                createEdge(
                                    { nodeId: id, outputId: output.id },
                                    { nodeId, inputId: 0 as InputId }
                                );
                            }
                        }}
                    >
                        <Icon
                            as={BsEyeFill}
                            color="var(--node-image-preview-button-fg)"
                        />
                    </Center>
                    <Spacer />
                </>
            )}
            <Center
                h="2rem"
                verticalAlign="middle"
            >
                <TypeTags
                    isOptional={false}
                    type={type}
                />
            </Center>
            <Text
                h="full"
                lineHeight="2rem"
                marginInlineEnd="0.5rem"
                ml={1}
                textAlign="right"
            >
                {output.label}
            </Text>
        </Flex>
    );
});
