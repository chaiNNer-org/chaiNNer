import { Flex, HStack, Text, VStack } from '@chakra-ui/react';
import { PropsWithChildren, memo } from 'react';

interface ContainerProps {
    title: string;
    description: string;
}

export const SettingContainer = memo(
    ({ title, description, children }: PropsWithChildren<ContainerProps>) => {
        return (
            <Flex
                align="center"
                w="full"
            >
                <VStack
                    alignContent="left"
                    alignItems="left"
                    w="full"
                >
                    <Text
                        flex="1"
                        textAlign="left"
                    >
                        {title}
                    </Text>
                    <Text
                        flex="1"
                        fontSize="xs"
                        marginTop={0}
                        textAlign="left"
                    >
                        {description}
                    </Text>
                </VStack>
                <HStack>{children}</HStack>
            </Flex>
        );
    },
);
