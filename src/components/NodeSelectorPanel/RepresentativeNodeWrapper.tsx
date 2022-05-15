import { Box, Center, Tooltip } from '@chakra-ui/react';
import { DragEvent, memo } from 'react';
import { useReactFlow } from 'react-flow-renderer';
import ReactMarkdown from 'react-markdown';
import { useContext, useContextSelector } from 'use-context-selector';
import { NodeSchema } from '../../common-types';
import { GlobalContext, GlobalVolatileContext } from '../../helpers/contexts/GlobalNodeState';
import { ChainnerDragData, TransferTypes } from '../../helpers/dataTransfer';
import RepresentativeNode from './RepresentativeNode';

const onDragStart = (event: DragEvent<HTMLDivElement>, node: NodeSchema) => {
    const data: ChainnerDragData = {
        schemaId: node.schemaId,
        offsetX: event.nativeEvent.offsetX,
        offsetY: event.nativeEvent.offsetY,
    };

    event.dataTransfer.setData(TransferTypes.ChainnerSchema, JSON.stringify(data));
    // eslint-disable-next-line no-param-reassign
    event.dataTransfer.effectAllowed = 'move';
};

interface RepresentativeNodeWrapperProps {
    node: NodeSchema;
    collapsed?: boolean;
}

const RepresentativeNodeWrapper = ({ node, collapsed = false }: RepresentativeNodeWrapperProps) => {
    const createNode = useContextSelector(GlobalVolatileContext, (c) => c.createNode);
    const { reactFlowWrapper, setHoveredNode } = useContext(GlobalContext);
    const reactFlowInstance = useReactFlow();

    return (
        <Box
            key={node.name}
            py={1.5}
            // w="full"
        >
            <Tooltip
                closeOnMouseDown
                hasArrow
                borderRadius={8}
                label={<ReactMarkdown>{node.description}</ReactMarkdown>}
                px={2}
                py={1}
            >
                <Center
                    draggable
                    boxSizing="content-box"
                    display="block"
                    // w="100%"
                    onDoubleClick={() => {
                        if (!reactFlowWrapper.current) return;

                        const { height: wHeight, width } =
                            reactFlowWrapper.current.getBoundingClientRect();

                        const position = reactFlowInstance.project({
                            x: width / 2,
                            y: wHeight / 2,
                        });

                        createNode({
                            nodeType: node.nodeType,
                            position,
                            data: {
                                schemaId: node.schemaId,
                            },
                        });
                    }}
                    onDragEnd={() => {
                        setHoveredNode(null);
                    }}
                    onDragStart={(event) => {
                        onDragStart(event, node);
                        setHoveredNode(null);
                    }}
                >
                    <RepresentativeNode
                        category={node.category}
                        collapsed={collapsed}
                        icon={node.icon}
                        name={node.name}
                        schemaId={node.schemaId}
                        subcategory={node.subcategory}
                    />
                </Center>
            </Tooltip>
        </Box>
    );
};

export default memo(RepresentativeNodeWrapper);
