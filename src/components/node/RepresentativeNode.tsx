import { Box, Center, Heading, HStack, useColorModeValue } from '@chakra-ui/react';
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

    return (
        <Center
            bg={subcategory === 'Iteration' ? 'none' : accentColor}
            borderColor={borderColor}
            borderRadius="lg"
            borderWidth="0.5px"
            boxShadow="lg"
            transition="0.15s ease-in-out"
            w="full"
            overflow="hidden"
            bgGradient={
                subcategory === 'Iteration'
                    ? `repeating-linear(to right,${accentColor},${accentColor} 2px,${bgColor} 2px,${bgColor} 4px)`
                    : 'none'
            }
            // opacity="0.95"
            _hover={{
                borderColor: accentColor
            }}
        >
            <Box
                // borderLeftColor={accentColor}
                // borderLeftWidth={8}
                // borderStyle={subcategory === 'Iteration' ? 'double' : 'default'}
                h="auto"
                verticalAlign="middle"
                w="full"
                py={1}
                bg={bgColor}
                ml={2}
                mr={2}
                borderRadius="md"
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
                    <Center
                        overflow="hidden"
                        textOverflow="ellipsis"
                        verticalAlign="middle"
                        w="full"
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
                            whiteSpace="nowrap"
                            w="full"
                        >
                            {type.toUpperCase()}
                        </Heading>
                    </Center>
                </HStack>
            </Box>
        </Center>
    );
};

export default memo(RepresentativeNode);
