/* eslint-disable react/prop-types */
import { StarIcon } from '@chakra-ui/icons';
import {
    Box,
    Center,
    HStack,
    Heading,
    MenuItem,
    MenuList,
    Text,
    Tooltip,
    useDisclosure,
} from '@chakra-ui/react';
import { DragEvent, memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BsFillJournalBookmarkFill } from 'react-icons/bs';
import { useReactFlow } from 'reactflow';
import { useContext } from 'use-context-selector';
import { NodeSchema, SchemaId } from '../../../common/common-types';
import { BackendContext } from '../../contexts/BackendContext';
import { GlobalContext } from '../../contexts/GlobalNodeState';
import { NodeDocumentationContext } from '../../contexts/NodeDocumentationContext';
import { getCategoryAccentColor } from '../../helpers/accentColors';
import { ChainnerDragData, TransferTypes } from '../../helpers/dataTransfer';
import { useContextMenu } from '../../hooks/useContextMenu';
import { useNodeFavorites } from '../../hooks/useNodeFavorites';
import { IconFactory } from '../CustomIcons';
import { IfVisible } from '../IfVisible';
import { Markdown } from '../Markdown';

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

interface NodeRepresentativeProps {
    node: NodeSchema;
    collapsed: boolean;
    onCreateNode: (schemaId: SchemaId) => void;
    isFavorite: boolean;
    toggleFavorite: (schemaId: SchemaId) => void;
    openNodeDocumentation: (schemaId: SchemaId) => void;
}

const NodeRepresentative = memo(
    ({
        node,
        collapsed,
        onCreateNode,
        isFavorite,
        toggleFavorite,
        openNodeDocumentation,
    }: NodeRepresentativeProps) => {
        const { t } = useTranslation();
        const { featureStates, categories } = useContext(BackendContext);

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
                        toggleFavorite(node.schemaId);
                    }}
                >
                    {isFavorite
                        ? t('favorites.removeFromFavorites', 'Remove from Favorites')
                        : t('favorites.addToFavorites', 'Add to Favorites')}
                </MenuItem>
                <MenuItem
                    icon={<BsFillJournalBookmarkFill />}
                    onClick={() => {
                        openNodeDocumentation(node.schemaId);
                    }}
                >
                    {t('documentation.openDocumentation', 'Open Documentation')}
                </MenuItem>
            </MenuList>
        ));

        const featureDetails = node.features.map((feature) => {
            const featureState = featureStates.get(feature);
            return { isEnabled: featureState?.enabled, details: featureState?.details };
        });
        const unavailableReason =
            featureDetails
                .filter((feature) => !feature.isEnabled)
                .map((feature) => feature.details)
                .join('\n') || undefined;
        const isDisabled = !!unavailableReason;

        const bgColor = 'var(--selector-node-bg)';
        const accentColor = getCategoryAccentColor(categories, node.category);

        return useMemo(() => {
            const isIterator = node.kind === 'generator' || node.kind === 'collector';
            const bgGradient = isIterator
                ? `repeating-linear(to right,${accentColor},${accentColor} 2px,${bgColor} 2px,${bgColor} 4px)`
                : `linear-gradient(90deg, ${accentColor} 0%, ${accentColor} 33%, ${bgColor} 66%, ${bgColor} 100%)`;

            return (
                <Tooltip
                    closeOnMouseDown
                    hasArrow
                    borderRadius={8}
                    isOpen={isOpen}
                    label={t(
                        'tooltips.addNodesToCanvas',
                        'Either double-click or drag and drop to add nodes to the canvas.'
                    )}
                    placement="top"
                    px={2}
                    py={1}
                    onClose={onClose}
                >
                    <Box
                        data-group
                        draggable
                        _active={{ borderColor: accentColor }}
                        _focus={{ borderColor: accentColor }}
                        _hover={{ borderColor: accentColor }}
                        bgGradient={bgGradient}
                        borderColor={bgColor}
                        borderRadius="lg"
                        borderWidth="1px"
                        boxShadow="lg"
                        boxSizing="content-box"
                        display="block"
                        mx="-1px"
                        my={1}
                        opacity={isDisabled ? 0.5 : 1}
                        overflow="hidden"
                        tabIndex={0}
                        transition="border-color 0.15s ease-in-out"
                        onClick={() => {
                            setDidSingleClick(true);
                        }}
                        onContextMenu={onContextMenu}
                        onDoubleClick={() => {
                            setDidSingleClick(false);
                            onCreateNode(node.schemaId);
                        }}
                        onDragStart={(event) => {
                            setDidSingleClick(false);
                            onDragStart(event, node);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                onCreateNode(node.schemaId);
                            }
                        }}
                    >
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
                            <HStack
                                bg={
                                    isIterator
                                        ? bgColor
                                        : `linear-gradient(90deg, ${bgColor} 0%, ${bgColor} 66%, transparent 100%)`
                                }
                                borderRadius="8px 0 0 8px"
                                ml="5px"
                                pl={2}
                                py={0.5}
                            >
                                <Center
                                    alignContent="center"
                                    alignItems="center"
                                    h={4}
                                    py={3}
                                    verticalAlign="middle"
                                    w={4}
                                >
                                    <IconFactory
                                        accentColor="var(--selector-icon)"
                                        boxSize={4}
                                        icon={node.icon}
                                    />
                                </Center>
                                {!collapsed && (
                                    <>
                                        <Heading
                                            alignContent="center"
                                            as="h5"
                                            flex={1}
                                            fontWeight={700}
                                            h="20px"
                                            lineHeight="20px"
                                            m={0}
                                            opacity={0.92}
                                            overflow="hidden"
                                            p={0}
                                            size="xs"
                                            textAlign="left"
                                            textOverflow="ellipsis"
                                            textTransform="uppercase"
                                            verticalAlign="middle"
                                            whiteSpace="nowrap"
                                        >
                                            {node.name}
                                        </Heading>
                                        <StarIcon
                                            _groupHover={{
                                                opacity: '100%',
                                            }}
                                            _hover={{
                                                stroke: 'yellow.500',
                                                color: isFavorite ? 'yellow.500' : bgColor,
                                                transition: '0.15s ease-in-out',
                                            }}
                                            aria-label={t('favorites.title', 'Favorites')}
                                            color={isFavorite ? 'gray.500' : bgColor}
                                            mr={2}
                                            opacity={isFavorite ? '100%' : '0%'}
                                            overflow="hidden"
                                            stroke="gray.500"
                                            strokeWidth={isFavorite ? 0 : 2}
                                            transition="0.15s ease-in-out"
                                            verticalAlign="middle"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleFavorite(node.schemaId);
                                            }}
                                            onDoubleClick={(e) => e.stopPropagation()}
                                        />
                                    </>
                                )}
                            </HStack>
                        </Tooltip>
                    </Box>
                </Tooltip>
            );
        }, [
            node,
            accentColor,
            isOpen,
            t,
            onClose,
            isDisabled,
            onContextMenu,
            collapsed,
            unavailableReason,
            isFavorite,
            onCreateNode,
            toggleFavorite,
        ]);
    }
);

interface NodeRepresentativeListProps {
    nodes: readonly NodeSchema[];
    collapsed: boolean;
}
export const NodeRepresentativeList = memo(({ nodes, collapsed }: NodeRepresentativeListProps) => {
    const { openNodeDocumentation } = useContext(NodeDocumentationContext);
    const { reactFlowWrapper, createNode } = useContext(GlobalContext);
    const reactFlowInstance = useReactFlow();

    const onCreateNode = useCallback(
        (schemaId: SchemaId) => {
            if (!reactFlowWrapper.current) return;

            const rect = reactFlowWrapper.current.getBoundingClientRect();
            const position = reactFlowInstance.screenToFlowPosition({
                x: (rect.width + rect.x) / 2,
                y: (rect.height + rect.y) / 2,
            });

            createNode({ position, data: { schemaId } });
        },
        [createNode, reactFlowInstance, reactFlowWrapper]
    );

    const { favorites, toggleFavorite } = useNodeFavorites();

    const nodeHeight = 30;
    const nodePadding = 4;

    return (
        <IfVisible
            height={nodeHeight * nodes.length + nodePadding * (nodes.length + 1)}
            visibleOffset={600}
        >
            {nodes.map((node) => (
                <NodeRepresentative
                    collapsed={collapsed}
                    isFavorite={favorites.has(node.schemaId)}
                    key={node.schemaId}
                    node={node}
                    openNodeDocumentation={openNodeDocumentation}
                    toggleFavorite={toggleFavorite}
                    onCreateNode={onCreateNode}
                />
            ))}
        </IfVisible>
    );
});
