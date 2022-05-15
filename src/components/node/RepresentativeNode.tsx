import { StarIcon } from '@chakra-ui/icons';
import { Box, Center, Flex, Heading, HStack, useColorModeValue } from '@chakra-ui/react';
import { memo } from 'react';
import getAccentColor from '../../helpers/getNodeAccentColors';
import { IconFactory } from '../CustomIcons';

interface RepresentativeNodeProps {
    category: string;
    subcategory: string;
    icon: string;
    type: string;
}

const RepresentativeNode = ({ category, subcategory, type, icon }: RepresentativeNodeProps) => {
    const bgColor = useColorModeValue('gray.300', 'gray.700');
    const borderColor = useColorModeValue('gray.400', 'gray.600');
    const accentColor = getAccentColor(category);

    const collapsed = false;

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
        >
            <Box
                bg={bgColor}
                borderRadius="6px 0 0 6px"
                h="auto"
                ml={2}
                py={1}
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
                                    overflow="hidden"
                                    p={0}
                                    size="sm"
                                    textAlign="left"
                                    textOverflow="ellipsis"
                                    verticalAlign="middle"
                                    // w="90%"
                                    whiteSpace="nowrap"
                                >
                                    {type.toUpperCase()}
                                </Heading>
                            </Box>
                            <HStack
                                alignContent="right"
                                alignItems="right"
                                m={0}
                                p={0}
                                position="relative"
                                right={0}
                                verticalAlign="center"
                                w="fit-content"
                            >
                                <StarIcon
                                    aria-label="dlksdmclsdk"
                                    position="relative"
                                    right={0}
                                    verticalAlign="center"
                                />
                            </HStack>
                        </Flex>
                    )}
                </HStack>
            </Box>
        </Center>
    );
};

export default memo(RepresentativeNode);
