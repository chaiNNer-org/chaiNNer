import { StarIcon } from '@chakra-ui/icons';
import { Box, Center, Flex, HStack, Heading, Spacer } from '@chakra-ui/react';
import { memo, useState } from 'react';
import { useContext } from 'use-context-selector';
import { CategoryId, NodeType, SchemaId } from '../../../common/common-types';
import { BackendContext } from '../../contexts/BackendContext';
import { getCategoryAccentColor } from '../../helpers/accentColors';
import { useNodeFavorites } from '../../hooks/useNodeFavorites';
import { IconFactory } from '../CustomIcons';

interface RepresentativeNodeProps {
    category: CategoryId;
    icon: string;
    name: string;
    collapsed?: boolean;
    schemaId: SchemaId;
    nodeType: NodeType;
    createNodeFromSelector: () => void;
}

export const RepresentativeNode = memo(
    ({
        category,
        nodeType,
        name,
        icon,
        schemaId,
        collapsed = false,
        createNodeFromSelector,
    }: RepresentativeNodeProps) => {
        const { categories } = useContext(BackendContext);

        const bgColor = 'var(--selector-node-bg)';
        const accentColor = getCategoryAccentColor(categories, category);

        const [hover, setHover] = useState<boolean>(false);

        const { favorites, addFavorites, removeFavorite } = useNodeFavorites();
        const isFavorite = favorites.has(schemaId);

        const isIterator = nodeType === 'newIterator' || nodeType === 'collector';
        let bgGradient = `linear-gradient(90deg, ${accentColor} 0%, ${accentColor} 100%)`;
        if (isIterator) {
            bgGradient = `repeating-linear(to right,${accentColor},${accentColor} 2px,${bgColor} 2px,${bgColor} 4px)`;
        } else if (!hover) {
            bgGradient = `linear-gradient(90deg, ${accentColor} 0%, ${bgColor} 100%)`;
        }

        return (
            <Center
                _active={{ outlineColor: accentColor }}
                _focus={{ outlineColor: accentColor }}
                _hover={{ outlineColor: accentColor }}
                bgGradient={bgGradient}
                borderColor={bgColor}
                borderRadius="lg"
                borderWidth="0px"
                boxShadow="lg"
                outline="1px solid"
                outlineColor={bgColor}
                overflow="hidden"
                tabIndex={0}
                transition="outline 0.15s ease-in-out"
                w="full"
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        createNodeFromSelector();
                    }
                }}
                onMouseEnter={() => setHover(true)}
                onMouseLeave={() => setHover(false)}
            >
                <Box
                    bg={bgColor}
                    borderRadius="8px 0 0 8px"
                    h="auto"
                    ml="5px"
                    overflow="hidden"
                    py={0.5}
                    verticalAlign="middle"
                    w="full"
                >
                    <HStack
                        overflow="hidden"
                        pl={2}
                        textOverflow="ellipsis"
                        verticalAlign="middle"
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
                                icon={icon}
                            />
                        </Center>
                        {!collapsed && (
                            <Flex
                                overflow="hidden"
                                w="300px"
                            >
                                <Box
                                    overflow="hidden"
                                    textOverflow="ellipsis"
                                    verticalAlign="middle"
                                >
                                    <Heading
                                        alignContent="center"
                                        as="h5"
                                        fontWeight={700}
                                        h="20px"
                                        lineHeight="20px"
                                        m={0}
                                        opacity={0.92}
                                        overflow="hidden"
                                        p={0}
                                        size="xs"
                                        textAlign="left"
                                        textOverflow="truncate"
                                        textTransform="uppercase"
                                        verticalAlign="middle"
                                        whiteSpace="nowrap"
                                    >
                                        {name}
                                    </Heading>
                                </Box>
                                <Spacer />
                                <HStack
                                    overflow="hidden"
                                    px={2}
                                    verticalAlign="middle"
                                    w="fit-content"
                                >
                                    <StarIcon
                                        _hover={{
                                            stroke: 'yellow.500',
                                            color: isFavorite ? 'yellow.500' : bgColor,
                                            transition: '0.15s ease-in-out',
                                        }}
                                        aria-label="Favorites"
                                        color={isFavorite ? 'gray.500' : bgColor}
                                        opacity={isFavorite || hover ? '100%' : '0%'}
                                        overflow="hidden"
                                        stroke="gray.500"
                                        strokeWidth={isFavorite ? 0 : 2}
                                        transition="0.15s ease-in-out"
                                        verticalAlign="middle"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (isFavorite) {
                                                removeFavorite(schemaId);
                                            } else {
                                                addFavorites(schemaId);
                                            }
                                        }}
                                        onDoubleClick={(e) => e.stopPropagation()}
                                    />
                                </HStack>
                            </Flex>
                        )}
                    </HStack>
                </Box>
            </Center>
        );
    }
);
