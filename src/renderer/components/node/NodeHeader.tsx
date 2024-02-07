import { ChevronDownIcon, ChevronRightIcon } from '@chakra-ui/icons';
import { Box, Center, HStack, Heading, IconButton, Spacer, Text, VStack } from '@chakra-ui/react';
import { memo } from 'react';
import ReactTimeAgo from 'react-time-ago';
import { DisabledStatus } from '../../../common/nodes/disabled';
import { Validity } from '../../../common/Validity';
import { NodeProgress } from '../../contexts/ExecutionContext';
import { interpolateColor } from '../../helpers/colorTools';
import { NodeState } from '../../helpers/nodeState';
import { useThemeColor } from '../../hooks/useThemeColor';
import { IconFactory } from '../CustomIcons';
import { ValidityIndicator } from './NodeFooter/ValidityIndicator';

interface NodeHeaderProps {
    name: string;
    icon: string;
    accentColor: string;
    selected: boolean;
    disabledStatus: DisabledStatus;
    animated: boolean;
    validity: Validity;
    nodeProgress?: NodeProgress;
    useCollapse: { isCollapsed: boolean; toggleCollapse: () => void };
    nodeState: NodeState;
}

export const NodeHeader = memo(
    ({
        name,
        icon,
        accentColor,
        selected,
        disabledStatus,
        animated,
        validity,
        nodeProgress,
        useCollapse,
        nodeState,
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

        const maxConnected = Math.max(
            nodeState.connectedInputs.size,
            nodeState.connectedOutputs.size
        );
        const collapsedHandleHeight = '6px';
        const minHeight = `calc(${maxConnected} * ${collapsedHandleHeight})`;

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
                    minHeight={isCollapsed ? minHeight : undefined}
                    p={1}
                    verticalAlign="middle"
                    w="full"
                    onDoubleClick={toggleCollapse}
                >
                    <IconButton
                        aria-label={isCollapsed ? 'Expand' : 'Collapse'}
                        backgroundColor="transparent"
                        className="nodrag"
                        icon={isCollapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
                        size="xs"
                        onClick={toggleCollapse}
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
                    <Center w="24px">
                        {isCollapsed && (animated || !validity.isValid) && (
                            <ValidityIndicator
                                animated={animated}
                                validity={validity}
                            />
                        )}
                    </Center>
                </Center>
                {iteratorProcess}
            </VStack>
        );
    }
);
