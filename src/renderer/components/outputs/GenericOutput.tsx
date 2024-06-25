import { Type, getStructDescriptor, isDisjointWith, isSubsetOf } from '@chainner/navi';
import { Center, Flex, Icon, Spacer, Text } from '@chakra-ui/react';
import { memo } from 'react';
import { BsEyeFill } from 'react-icons/bs';
import { useReactFlow } from 'reactflow';
import { useContext } from 'use-context-selector';
import {
    EdgeData,
    InputId,
    NodeData,
    NodeSchema,
    Output,
    SchemaId,
} from '../../../common/common-types';
import { getChainnerScope } from '../../../common/types/chainner-scope';
import { createUniqueId, lazy, lazyKeyed, stringifySourceHandle } from '../../../common/util';
import { FakeNodeContext } from '../../contexts/FakeExampleContext';
import { GlobalContext } from '../../contexts/GlobalNodeState';
import { TypeTags } from '../TypeTag';
import { OutputProps } from './props';

const VIEW_SCHEMA_ID = 'chainner:image:view' as SchemaId;

interface ViewImageButtonProps {
    output: Output;
    id: string;
    schema: NodeSchema;
}
const ViewImageButton = memo(({ output, id, schema }: ViewImageButtonProps) => {
    const { selectNode, createNode, createEdge } = useContext(GlobalContext);
    const { getNodes, getEdges } = useReactFlow<NodeData, EdgeData>();
    const { isFake } = useContext(FakeNodeContext);

    if (isFake) return null;

    return (
        <Center
            _hover={{
                backgroundColor: 'var(--node-image-preview-button-bg-hover)',
            }}
            bgColor="var(--node-image-preview-button-bg)"
            borderRadius="md"
            className="nodrag"
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

                const sourceHandle = stringifySourceHandle({ nodeId: id, outputId: output.id });

                // check whether there already is a view node
                const viewId = getEdges()
                    .filter((e) => e.source === id && e.sourceHandle === sourceHandle)
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
                    const outputIndex = schema.outputs.findIndex((o) => o.id === output.id);

                    // TODO: This is a bit of hardcoding, but it works
                    createNode({
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
                    });
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
    );
});

const getImageType = lazy(() => getStructDescriptor(getChainnerScope(), 'Image').default);
const isImageDefinition = lazyKeyed((type: Type) => {
    if (isDisjointWith(type, getImageType())) {
        return false;
    }
    if (isSubsetOf(type, getImageType())) {
        return true;
    }
    return null;
});
const isImage = lazyKeyed((type: Type) => isSubsetOf(type, getImageType()));

export const GenericOutput = memo(
    ({ output, type, id, schema, definitionType, lengthType }: OutputProps) => {
        // We first check the definition type first, because it changes less, which makes it more efficient to cache.
        const viewImage = isImageDefinition(definitionType) ?? isImage(type);

        return (
            <Flex
                alignItems="center"
                h="2rem"
                style={{ contain: 'layout size' }}
                verticalAlign="middle"
                w="full"
            >
                {viewImage && (
                    <ViewImageButton
                        id={id}
                        output={output}
                        schema={schema}
                    />
                )}
                <Spacer />
                <TypeTags
                    longText
                    isOptional={false}
                    lengthType={lengthType}
                    type={type}
                />
                <Text
                    h="full"
                    lineHeight="2rem"
                    marginInlineEnd="0.5rem"
                    ml={1}
                    textAlign="right"
                    whiteSpace="nowrap"
                >
                    {output.label}
                </Text>
            </Flex>
        );
    }
);
