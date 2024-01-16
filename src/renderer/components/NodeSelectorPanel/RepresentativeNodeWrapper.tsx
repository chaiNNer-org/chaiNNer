import { StarIcon } from '@chakra-ui/icons';
import { Box, Center, MenuItem, MenuList, Text, Tooltip, useDisclosure } from '@chakra-ui/react';
import { DragEvent, memo, useCallback, useEffect, useState } from 'react';
import { BsFillJournalBookmarkFill } from 'react-icons/bs';
import { useReactFlow } from 'reactflow';
import { useContext } from 'use-context-selector';
import { NodeSchema } from '../../../common/common-types';
import { BackendContext } from '../../contexts/BackendContext';
import { GlobalContext } from '../../contexts/GlobalNodeState';
import { NodeDocumentationContext } from '../../contexts/NodeDocumentationContext';
import { ChainnerDragData, TransferTypes } from '../../helpers/dataTransfer';
import { useContextMenu } from '../../hooks/useContextMenu';
import { useNodeFavorites } from '../../hooks/useNodeFavorites';
import { Markdown } from '../Markdown';
import { RepresentativeNode } from './RepresentativeNode';

interface TooltipLabelProps {
    name?: string;
    description: string;
    unavailableReason?: string;
}
const TooltipLabel = memo(({ name, description, unavailableReason }: TooltipLabelProps) => {
    const firstParagraph = description.split('\n\n')[0];

    let text = firstParagraph;

    if (unavailableReason) {
        text += `\n\nThis node is currently unavailable because a feature is not enabled. Reason(s):\n\n${unavailableReason}`;
    }

    return (
        <>
            {name && <Text fontWeight="bold">{name}</Text>}
            <Markdown nonInteractive>{text}</Markdown>
        </>
    );
});

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
        const { reactFlowWrapper, createNode } = useContext(GlobalContext);
        const { featureStates } = useContext(BackendContext);
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
                    icon={<BsFillJournalBookmarkFill />}
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

            const {
                height: wHeight,
                width,
                x,
                y,
            } = reactFlowWrapper.current.getBoundingClientRect();

            const position = reactFlowInstance.screenToFlowPosition({
                x: (width + x) / 2,
                y: (wHeight + y) / 2,
            });

            createNode({
                nodeType: node.nodeType,
                position,
                data: {
                    schemaId: node.schemaId,
                },
            });
        }, [createNode, node.schemaId, node.nodeType, reactFlowInstance, reactFlowWrapper]);

        const featureDetails = node.features.map((feature) => {
            const featureState = featureStates.get(feature);
            return { isEnabled: featureState?.enabled, details: featureState?.details };
        });

        const isDisabled = featureDetails.some((feature) => !feature.isEnabled);

        const unavailableReason = isDisabled
            ? featureDetails
                  .filter((feature) => !feature.isEnabled)
                  .map((feature) => feature.details)
                  .join('\n')
            : undefined;

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
                                <TooltipLabel
                                    description={node.description}
                                    name={collapsed ? node.name : undefined}
                                    unavailableReason={unavailableReason}
                                />
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
                                opacity={isDisabled ? 0.5 : 1}
                                onClick={() => {
                                    setDidSingleClick(true);
                                }}
                                onDoubleClick={() => {
                                    setDidSingleClick(false);
                                    createNodeFromSelector();
                                }}
                                onDragStart={(event) => {
                                    setDidSingleClick(false);
                                    onDragStart(event, node);
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
                                />
                            </Center>
                        </Tooltip>
                    </Box>
                </Tooltip>
            </Box>
        );
    }
);
