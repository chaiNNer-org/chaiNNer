import { Box, Center, HStack, Heading, LayoutProps, Text, VStack } from '@chakra-ui/react';
import { memo } from 'react';
import ReactTimeAgo from 'react-time-ago';
import { DisabledStatus } from '../../../common/nodes/disabled';
import { IconFactory } from '../CustomIcons';

interface IteratorNodeHeaderProps {
    name: string;
    icon: string;
    accentColor: string;
    selected: boolean;
    percentComplete?: number;
    eta?: number;
    width?: LayoutProps['width'];
    disabledStatus: DisabledStatus;
}

export const IteratorNodeHeader = memo(
    ({
        name,
        width,
        icon,
        accentColor,
        selected,
        percentComplete,
        eta,
        disabledStatus,
    }: IteratorNodeHeaderProps) => {
        const etaDate = new Date();
        etaDate.setSeconds(etaDate.getSeconds() + (eta ?? 0));

        return (
            <VStack
                spacing={0}
                w={width || 'full'}
            >
                <Center
                    borderBottomColor={accentColor}
                    borderBottomWidth={percentComplete !== undefined ? '0px' : '4px'}
                    borderStyle="default"
                    h="auto"
                    pt={2}
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
                                accentColor={selected ? accentColor : 'var(--node-icon-color)'}
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
                                opacity={disabledStatus === DisabledStatus.Enabled ? 1 : 0.5}
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
                {percentComplete !== undefined && (
                    <Box
                        h={6}
                        w="full"
                    >
                        <Center w="full">
                            <HStack
                                mb="-6"
                                position="relative"
                            >
                                <Text
                                    fontWeight="medium"
                                    size="sm"
                                >{`${Number(percentComplete * 100).toFixed(1)}%`}</Text>
                                <Text
                                    fontWeight="medium"
                                    size="sm"
                                >
                                    ETA:{' '}
                                    <ReactTimeAgo
                                        future
                                        date={etaDate}
                                        locale="en-US"
                                        timeStyle="round"
                                        tooltip={false}
                                    />
                                </Text>
                            </HStack>
                        </Center>
                        <Box
                            bgColor="gray.500"
                            h={6}
                            w="full"
                        >
                            <Box
                                bgColor={accentColor}
                                // h="full"
                                h={6}
                                transition="all 0.15s ease-in-out"
                                w={`${percentComplete * 100}%`}
                            />
                        </Box>
                    </Box>
                )}
            </VStack>
        );
    }
);
