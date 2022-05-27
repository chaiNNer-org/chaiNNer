import { StarIcon } from '@chakra-ui/icons';
import { Box, Center, Flex, HStack, Heading, Spacer, useColorModeValue } from '@chakra-ui/react';
import { memo, useState } from 'react';
import getAccentColor from '../../helpers/getNodeAccentColors';
import { useNodeFavorites } from '../../hooks/useNodeFavorites';
import { IconFactory } from '../CustomIcons';

interface RepresentativeNodeProps {
    category: string;
    subcategory: string;
    icon: string;
    name: string;
    collapsed?: boolean;
    schemaId: string;
}

const RepresentativeNode = memo(
    ({
        category,
        subcategory,
        name,
        icon,
        schemaId,
        collapsed = false,
    }: RepresentativeNodeProps) => {
        const bgColor = useColorModeValue('gray.300', 'gray.700');
        const borderColor = useColorModeValue('gray.400', 'gray.600');
        const accentColor = getAccentColor(category);

        const [hover, setHover] = useState<boolean>(false);

        const { favorites, addFavorites, removeFavorite } = useNodeFavorites();
        const isFavorite = favorites.has(schemaId);

        return (
            <Center
                _hover={{
                    borderColor: accentColor,
                }}
                bg={subcategory === 'Iteration' ? 'none' : accentColor}
                bgGradient={
                    subcategory === 'Iteration'
                        ? `repeating-linear(to right,${accentColor},${accentColor} 2px,${bgColor} 2px,${bgColor} 4px)`
                        : 'none'
                }
                borderColor={bgColor}
                borderRadius="lg"
                borderWidth="1px"
                boxShadow="lg"
                overflow="hidden"
                transition="0.15s ease-in-out"
                // opacity="0.95"
                w="full"
                onMouseEnter={() => setHover(true)}
                onMouseLeave={() => setHover(false)}
            >
                <Box
                    bg={bgColor}
                    borderRadius="8px 0 0 8px"
                    h="auto"
                    ml="5px"
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
                                accentColor={useColorModeValue('gray.600', 'gray.400')}
                                icon={icon}
                            />
                        </Center>
                        {!collapsed && (
                            <Flex w="full">
                                <Box
                                    overflow="hidden"
                                    textOverflow="ellipsis"
                                    verticalAlign="middle"
                                    // w="full"
                                >
                                    <Heading
                                        alignContent="center"
                                        as="h5"
                                        fontWeight={700}
                                        lineHeight="auto"
                                        m={0}
                                        opacity={0.92}
                                        overflow="hidden"
                                        p={0}
                                        size="xs"
                                        textAlign="left"
                                        textOverflow="ellipsis"
                                        verticalAlign="middle"
                                        whiteSpace="nowrap"
                                    >
                                        {name.toUpperCase()}
                                    </Heading>
                                </Box>
                                <Spacer />
                                <HStack
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
                                        stroke="gray.500"
                                        strokeWidth={isFavorite ? 0 : 2}
                                        transition="0.15s ease-in-out"
                                        verticalAlign="middle"
                                        onClick={() => {
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

export default RepresentativeNode;
