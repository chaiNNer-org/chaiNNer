import { Center, HStack, Heading, LayoutProps, useColorModeValue } from '@chakra-ui/react';
import { memo } from 'react';
import { IconFactory } from '../CustomIcons';

interface NodeHeaderProps {
    name: string;
    icon: string;
    accentColor: string;
    selected: boolean;
    width?: LayoutProps['width'];
    parentNode?: string;
}

const NodeHeader = memo(
    ({ name, width, icon, accentColor, selected, parentNode }: NodeHeaderProps) => (
        <Center
            borderBottomColor={accentColor}
            borderBottomStyle={parentNode ? 'double' : undefined}
            borderBottomWidth={parentNode ? '4px' : '2px'}
            h="auto"
            verticalAlign="middle"
            w={width || 'full'}
        >
            <HStack
                mb={-1}
                mt={-1}
                pb={2}
                pl={6}
                pr={6}
                verticalAlign="middle"
            >
                <Center
                    alignContent="center"
                    alignItems="center"
                    h={4}
                    verticalAlign="middle"
                    w={4}
                >
                    <IconFactory
                        accentColor={
                            selected ? accentColor : useColorModeValue('gray.600', 'gray.400')
                        }
                        icon={icon}
                    />
                </Center>
                <Center verticalAlign="middle">
                    <Heading
                        alignContent="center"
                        as="h5"
                        fontWeight={700}
                        lineHeight="auto"
                        m={0}
                        p={0}
                        size="sm"
                        textAlign="center"
                        verticalAlign="middle"
                    >
                        {name.toUpperCase()}
                    </Heading>
                </Center>
            </HStack>
        </Center>
    )
);

export default NodeHeader;
