import { InfoIcon, StarIcon } from '@chakra-ui/icons';
import { Box, Center, MenuItem, MenuList, Tooltip, useDisclosure } from '@chakra-ui/react';
import { DragEvent, memo, useCallback, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useReactFlow } from 'reactflow';
import { useContext } from 'use-context-selector';
import { NodeSchema } from '../../../common/common-types';
import { GlobalContext } from '../../contexts/GlobalNodeState';
import { NodeDocumentationContext } from '../../contexts/NodeDocumentationContext';
import { ChainnerDragData, TransferTypes } from '../../helpers/dataTransfer';
import { useContextMenu } from '../../hooks/useContextMenu';
import { useNodeFavorites } from '../../hooks/useNodeFavorites';
import { RepresentativeNode } from './RepresentativeNode';

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

export const RepresentativeNodeWrapper = memo(
    ({ node, collapsed = false }: RepresentativeNodeWrapperProps) => {
        const { reactFlowWrapper, setHoveredNode, createNode } = useContext(GlobalContext);
        const reactFlowInstance = useReactFlow();
        const { openNodeDocumentation } = useContext(NodeDocumentationContext);

        const { favorites, addFavorites, removeFavorite } = useNodeFavorites();
        const isFavorite = favorites.has(node.schemaId);

        const { isOpen, onOpen, onClose } = useDisclosure();
        const [didSingleClick, setDidSingleClick] = useState(false);
        useEffect(() => {
            const timerId = setTimeout(() => {
                if (didSingleClick) {
                    setDidSingleClick(false);
                    onOpen();
                }
            }, 500);
            return () => clearTimeout(timerId);
        }, [didSingleClick, onOpen]);

        const { onContextMenu } = useContextMenu(() => (
            <MenuList>
                <MenuItem
                    icon={<StarIcon />}
                    onClick={() => {
                        if (isFavorite) {
                            removeFavorite(node.schemaId);
                        } else {
                            addFavorites(node.schemaId);
                        }
                    }}
                >
                    {isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
                </MenuItem>
                <MenuItem
                    icon={<InfoIcon />}
                    onClick={() => {
                        openNodeDocumentation(node.schemaId);
                    }}
                >
                    Open Documentation
                </MenuItem>
            </MenuList>
        ));

        const createNodeFromSelector = useCallback(() => {
            if (!reactFlowWrapper.current) return;

            const { height: wHeight, width } = reactFlowWrapper.current.getBoundingClientRect();

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
        }, [createNode, node.schemaId, node.nodeType, reactFlowInstance, reactFlowWrapper]);

        return (
            <Box
                my={1.5}
                onContextMenu={onContextMenu}
            >
                <Tooltip
                    closeOnMouseDown
                    hasArrow
                    borderRadius={8}
                    isOpen={isOpen}
                    label="Either double-click or drag and drop to add nodes to the canvas."
                    placement="top"
                    px={2}
                    py={1}
                    onClose={onClose}
                >
                    <Box>
                        <Tooltip
                            closeOnMouseDown
                            hasArrow
                            borderRadius={8}
                            label={
                                <ReactMarkdown>{`**${collapsed ? node.name : ''}**\n\n${
                                    node.description
                                }`}</ReactMarkdown>
                            }
                            openDelay={500}
                            placement="bottom"
                            px={2}
                            py={1}
                        >
                            <Center
                                draggable
                                boxSizing="content-box"
                                display="block"
                                onClick={() => {
                                    setDidSingleClick(true);
                                }}
                                onDoubleClick={() => {
                                    setDidSingleClick(false);
                                    createNodeFromSelector();
                                }}
                                onDragEnd={() => {
                                    setHoveredNode(undefined);
                                }}
                                onDragStart={(event) => {
                                    setDidSingleClick(false);
                                    onDragStart(event, node);
                                    setHoveredNode(undefined);
                                }}
                            >
                                <RepresentativeNode
                                    category={node.category}
                                    collapsed={collapsed}
                                    createNodeFromSelector={createNodeFromSelector}
                                    icon={node.icon}
                                    name={node.name}
                                    nodeType={node.nodeType}
                                    schemaId={node.schemaId}
                                    subcategory={node.subcategory}
                                />
                            </Center>
                        </Tooltip>
                    </Box>
                </Tooltip>
            </Box>
        );
    }
);
