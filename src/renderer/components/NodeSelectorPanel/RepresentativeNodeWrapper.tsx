import { StarIcon } from '@chakra-ui/icons';
import { Box, Center, MenuItem, MenuList, Tooltip } from '@chakra-ui/react';
import { DragEvent, memo } from 'react';
import { useReactFlow } from 'react-flow-renderer';
import ReactMarkdown from 'react-markdown';
import { useContext, useContextSelector } from 'use-context-selector';
import { NodeSchema } from '../../../common/common-types';
import { GlobalContext, GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { ChainnerDragData, TransferTypes } from '../../helpers/dataTransfer';
import { useContextMenu } from '../../hooks/useContextMenu';
import { useNodeFavorites } from '../../hooks/useNodeFavorites';
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

function RepresentativeNodeWrapper({ node, collapsed = false }: RepresentativeNodeWrapperProps) {
    const createNode = useContextSelector(GlobalVolatileContext, (c) => c.createNode);
    const { reactFlowWrapper, setHoveredNode } = useContext(GlobalContext);
    const reactFlowInstance = useReactFlow();

    const { favorites, addFavorites, removeFavorite } = useNodeFavorites();
    const isFavorite = favorites.has(node.schemaId);

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
        </MenuList>
    ));

    return (
        <Box
            key={node.name}
            my={1.5}
            onContextMenu={onContextMenu}
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
}

export default memo(RepresentativeNodeWrapper);
