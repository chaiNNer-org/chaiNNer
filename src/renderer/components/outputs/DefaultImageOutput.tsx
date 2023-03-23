import { Center, Flex, Icon, Spacer, Text } from '@chakra-ui/react';
import { memo } from 'react';
import { BsEyeFill } from 'react-icons/bs';
import { useReactFlow } from 'reactflow';
import { useContext, useContextSelector } from 'use-context-selector';
import { EdgeData, InputId, NodeData, SchemaId } from '../../../common/common-types';
import {
    createUniqueId,
    parseSourceHandle,
    stringifySourceHandle,
    stringifyTargetHandle,
} from '../../../common/util';
import { BackendContext } from '../../contexts/BackendContext';
import { GlobalContext, GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { TypeTags } from '../TypeTag';
import { OutputProps } from './props';

const VIEW_SCHEMA_ID = 'chainner:image:view' as SchemaId;

export const DefaultImageOutput = memo(({ label, id, outputId, schemaId }: OutputProps) => {
    const type = useContextSelector(GlobalVolatileContext, (c) =>
        c.typeState.functions.get(id)?.outputs.get(outputId)
    );

    const { selectNode, createNode, createConnection } = useContext(GlobalContext);

    const outputIndex = useContextSelector(BackendContext, (c) =>
        c.schemata.get(schemaId).outputs.findIndex((o) => o.id === outputId)
    );

    const { getNodes, getEdges } = useReactFlow<NodeData, EdgeData>();

    return (
        <Flex
            h="full"
            minH="2rem"
            verticalAlign="middle"
            w="full"
        >
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
                    const byId = new Map(getNodes().map((n) => [n.id, n]));

                    // check whether there already is a view node
                    const viewId = getEdges()
                        .filter(
                            (e) =>
                                e.source === id &&
                                e.sourceHandle &&
                                parseSourceHandle(e.sourceHandle).outputId === outputId
                        )
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
                                    x:
                                        containingNode.position.x +
                                        (containingNode.width ?? 0) +
                                        75 +
                                        outputIndex * 20,
                                    y: containingNode.position.y + outputIndex * 30,
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
                            sourceHandle: stringifySourceHandle({ nodeId: id, outputId }),
                            target: nodeId,
                            targetHandle: stringifyTargetHandle({
                                nodeId,
                                inputId: 0 as InputId,
                            }),
                        });
                    }
                }}
            >
                <Icon
                    as={BsEyeFill}
                    color="var(--node-image-preview-button-fg)"
                />
            </Center>
            <Spacer />
            {type && (
                <Center
                    h="2rem"
                    verticalAlign="middle"
                >
                    <TypeTags
                        isOptional={false}
                        type={type}
                    />
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
