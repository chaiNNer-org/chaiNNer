import { ChevronDownIcon, ChevronUpIcon } from '@chakra-ui/icons';
import { Box, Center, HStack, Heading, IconButton, Spacer, Text, VStack } from '@chakra-ui/react';
import { memo } from 'react';
import ReactTimeAgo from 'react-time-ago';
import { DisabledStatus } from '../../../common/nodes/disabled';
import { NodeProgress } from '../../contexts/ExecutionContext';
import { interpolateColor } from '../../helpers/colorTools';
import { useThemeColor } from '../../hooks/useThemeColor';
import { IconFactory } from '../CustomIcons';

interface NodeHeaderProps {
    name: string;
    icon: string;
    accentColor: string;
    selected: boolean;
    disabledStatus: DisabledStatus;
    nodeProgress?: NodeProgress;
    useCollapse: { isCollapsed: boolean; toggleCollapse: () => void };
}

export const NodeHeader = memo(
    ({
        name,
        icon,
        accentColor,
        selected,
        disabledStatus,
        nodeProgress,
        useCollapse,
    }: NodeHeaderProps) => {
        const bgColor = useThemeColor('--bg-700');
        const gradL = interpolateColor(accentColor, bgColor, 0.9);
        const gradR = bgColor;

        const progColor = interpolateColor(accentColor, bgColor, 0.5);

        const { isCollapsed, toggleCollapse } = useCollapse;

        let iteratorProcess = null;
        if (nodeProgress) {
            const { progress, eta, index, total } = nodeProgress;
            const etaDate = new Date();
            etaDate.setSeconds(etaDate.getSeconds() + eta);

            iteratorProcess = (
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
                                fontSize="sm"
                                fontWeight="medium"
                            >
                                {index}/{total} ({(progress * 100).toFixed(0)}
                                %)
                            </Text>
                            <Text
                                fontSize="sm"
                                fontWeight="medium"
                            >
                                ETA:{' '}
                                {progress === 1 ? (
                                    'Finished'
                                ) : (
                                    <ReactTimeAgo
                                        future
                                        date={etaDate}
                                        locale="en-US"
                                        timeStyle="round"
                                        tooltip={false}
                                    />
                                )}
                            </Text>
                        </HStack>
                    </Center>
                    <Box
                        bgColor="var(--node-bg-color)"
                        h={6}
                        w="full"
                    >
                        <Box
                            bgColor={progColor}
                            h={6}
                            transition="all 0.15s ease-in-out"
                            w={`${progress * 100}%`}
                        />
                    </Box>
                </Box>
            );
        }

        return (
            <VStack
                spacing={0}
                w="full"
            >
                <Center
                    bgGradient={`linear(to-r, ${gradL}, ${gradR})`}
                    borderBottomColor={accentColor}
                    borderBottomWidth="2px"
                    h="auto"
                    p={1}
                    verticalAlign="middle"
                    w="full"
                >
                    {/* // TODO: replace this with something useful */}
                    <IconButton
                        aria-label="placeholder"
                        cursor="default"
                        icon={<ChevronDownIcon />}
                        opacity={0}
                        size="xs"
                    />
                    <Spacer />
                    <HStack verticalAlign="middle">
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
                                textTransform="uppercase"
                                verticalAlign="middle"
                                whiteSpace="nowrap"
                            >
                                {name}
                            </Heading>
                        </Center>
                    </HStack>
                    <Spacer />
                    <IconButton
                        aria-label={isCollapsed ? 'Expand' : 'Collapse'}
                        className="nodrag"
                        icon={!isCollapsed ? <ChevronUpIcon /> : <ChevronDownIcon />}
                        size="xs"
                        onClick={toggleCollapse}
                    />
                </Center>
                {iteratorProcess}
            </VStack>
        );
    }
);
