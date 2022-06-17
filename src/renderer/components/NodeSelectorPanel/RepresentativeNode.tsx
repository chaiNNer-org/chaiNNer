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
        const accentColor = getAccentColor(category);

        const [hover, setHover] = useState<boolean>(false);

        const { favorites, addFavorites, removeFavorite } = useNodeFavorites();
        const isFavorite = favorites.has(schemaId);

        const isIterator = subcategory === 'Iteration';
        let bgGradient = `linear-gradient(90deg, ${accentColor} 0%, ${accentColor} 100%)`;
        if (isIterator) {
            bgGradient = `repeating-linear(to right,${accentColor},${accentColor} 2px,${bgColor} 2px,${bgColor} 4px)`;
        } else if (!hover) {
            bgGradient = `linear-gradient(90deg, ${accentColor} 0%, ${bgColor} 100%)`;
        }

        return (
            <Center
                _hover={{
                    outlineColor: accentColor,
                }}
                bgGradient={bgGradient}
                borderColor={bgColor}
                borderRadius="lg"
                borderWidth="0px"
                boxShadow="lg"
                outline="1px solid"
                outlineColor={bgColor}
                overflow="hidden"
                transition="outline 0.15s ease-in-out"
                w="full"
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
                                accentColor={useColorModeValue('gray.600', 'gray.400')}
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
                                        textOverflow="hidden"
                                        verticalAlign="middle"
                                        whiteSpace="nowrap"
                                    >
                                        {name.toUpperCase()}
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

export default RepresentativeNode;
