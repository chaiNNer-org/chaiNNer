import { Box, Center, Tooltip } from '@chakra-ui/react';
import { DragEvent, memo, useContext } from 'react';
import ReactMarkdown from 'react-markdown';
import { NodeSchema } from '../../common-types';
import { GlobalContext } from '../../helpers/contexts/GlobalNodeState';
import RepresentativeNode from '../node/RepresentativeNode';

const onDragStart = (event: DragEvent<HTMLDivElement>, node: NodeSchema) => {
    event.dataTransfer.setData('application/reactflow/schema', JSON.stringify(node));
    event.dataTransfer.setData('application/reactflow/offsetX', String(event.nativeEvent.offsetX));
    event.dataTransfer.setData('application/reactflow/offsetY', String(event.nativeEvent.offsetY));
    // eslint-disable-next-line no-param-reassign
    event.dataTransfer.effectAllowed = 'move';
};

interface RepresentativeNodeWrapperProps {
    node: NodeSchema;
}

const RepresentativeNodeWrapper = ({ node }: RepresentativeNodeWrapperProps) => {
    const { createNode, reactFlowInstance, reactFlowWrapper, useHoveredNode } =
        useContext(GlobalContext);

    const [, setHoveredNode] = useHoveredNode;

    return (
        <Box
            key={node.name}
            py={1.5}
            w="full"
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
                    w="100%"
                    onDoubleClick={() => {
                        if (!reactFlowInstance || !reactFlowWrapper.current) return;

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
                                identifier: node.identifier,
                                category: node.category,
                                subcategory: node.subcategory,
                                type: node.name,
                                icon: node.icon,
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
                        icon={node.icon}
                        subcategory={node.subcategory}
                        type={node.name}
                    />
                </Center>
            </Tooltip>
        </Box>
    );
};

export default memo(RepresentativeNodeWrapper);
