import { SettingsIcon, StarIcon } from '@chakra-ui/icons';
import { Box, Center, Flex, HStack, Heading, Spacer, useColorModeValue } from '@chakra-ui/react';
import { memo, useMemo, useState } from 'react';
import { useContext } from 'use-context-selector';
import { SettingsContext } from '../../contexts/SettingsContext';
import getAccentColor from '../../helpers/getNodeAccentColors';
import { IconFactory } from '../CustomIcons';

interface RepresentativeNodeProps {
    category: string;
    subcategory: string;
    icon: string;
    name: string;
    collapsed?: boolean;
    schemaId: string;
}

function RepresentativeNode({
    category,
    subcategory,
    name,
    icon,
    schemaId,
    collapsed = false,
}: RepresentativeNodeProps) {
    const bgColor = useColorModeValue('gray.300', 'gray.700');
    const borderColor = useColorModeValue('gray.400', 'gray.600');
    const accentColor = getAccentColor(category);

    const [hover, setHover] = useState<boolean>(false);

    const { useNodeFavorites } = useContext(SettingsContext);
    const [favorites, setFavorites] = useNodeFavorites;

    const isFavorite = useMemo(() => !!favorites.includes(schemaId), [favorites.length]);

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
            borderColor={borderColor}
            borderRadius="lg"
            borderWidth="0.5px"
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
                borderRadius="6px 0 0 6px"
                h="auto"
                ml={2}
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
                        {IconFactory(icon, useColorModeValue('gray.600', 'gray.400'))}
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
                                {
                                    // TODO: Re-enable when ready to do node settings
                                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                                    false && (
                                        <SettingsIcon
                                            _hover={{
                                                stroke: 'gray.500',
                                                transition: '0.15s ease-in-out',
                                            }}
                                            color={bgColor}
                                            opacity={hover ? '100%' : '0%'}
                                            stroke={borderColor}
                                            strokeWidth={1}
                                            transition="0.15s ease-in-out"
                                            verticalAlign="middle"
                                        />
                                    )
                                }
                                <StarIcon
                                    _hover={{
                                        stroke: 'yellow.500',
                                        transition: '0.15s ease-in-out',
                                    }}
                                    aria-label="dlksdmclsdk"
                                    color={isFavorite ? 'yellow.500' : bgColor}
                                    opacity={isFavorite || hover ? '100%' : '0%'}
                                    stroke={borderColor}
                                    strokeWidth={1}
                                    transition="0.15s ease-in-out"
                                    verticalAlign="middle"
                                    onClick={() => {
                                        if (isFavorite) {
                                            setFavorites(favorites.filter((f) => f !== schemaId));
                                        } else {
                                            setFavorites([...favorites, schemaId]);
                                        }
                                    }}
                                />
                            </HStack>
                        </Flex>
                    )}
                </HStack>
            </Box>
        </Center>
    );
}

export default memo(RepresentativeNode);
