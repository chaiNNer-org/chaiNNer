import { ChevronDownIcon, ChevronRightIcon } from '@chakra-ui/icons';
import { Box, Center, HStack, Heading, IconButton, Spacer, Text, VStack } from '@chakra-ui/react';
import { memo } from 'react';
import ReactTimeAgo from 'react-time-ago';
import { Validity } from '../../../common/Validity';
import { NodeProgress } from '../../contexts/ExecutionContext';
import { interpolateColor } from '../../helpers/colorTools';
import { NodeState } from '../../helpers/nodeState';
import { useThemeColor } from '../../hooks/useThemeColor';
import { IconFactory } from '../CustomIcons';
import { ValidityIndicator } from './NodeFooter/ValidityIndicator';

interface IteratorProcessProps {
    nodeProgress: NodeProgress;
    progressColor: string;
}

const IteratorProcess = memo(({ nodeProgress, progressColor }: IteratorProcessProps) => {
    const { progress, eta, index, total } = nodeProgress;
    const etaDate = new Date();
    etaDate.setSeconds(etaDate.getSeconds() + eta);

    return (
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
                    bgColor={progressColor}
                    h={6}
                    transition="all 0.15s ease-in-out"
                    w={`${progress * 100}%`}
                />
            </Box>
        </Box>
    );
});

interface NodeHeaderProps {
    nodeState: NodeState;
    accentColor: string;
    selected: boolean;
    isEnabled: boolean;
    animated: boolean;
    validity: Validity;
    nodeProgress?: NodeProgress;
    isCollapsed?: boolean;
    toggleCollapse?: () => void;
}

export const NodeHeader = memo(
    ({
        nodeState,
        accentColor,
        selected,
        isEnabled,
        animated,
        validity,
        nodeProgress,
        isCollapsed = false,
        toggleCollapse,
    }: NodeHeaderProps) => {
        const bgColor = useThemeColor('--bg-700');
        const gradL = interpolateColor(accentColor, bgColor, 0.9);
        const gradR = bgColor;

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
                    <Center w="24px">
                        {toggleCollapse && (
                            <IconButton
                                aria-label={isCollapsed ? 'Expand' : 'Collapse'}
                                backgroundColor="transparent"
                                className="nodrag"
                                icon={isCollapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
                                size="xs"
                                onClick={toggleCollapse}
                            />
                        )}
                    </Center>
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
                                icon={nodeState.schema.icon}
                            />
                        </Center>
                        <Center verticalAlign="middle">
                            <Heading
                                alignContent="center"
                                as="h5"
                                fontWeight={700}
                                lineHeight="auto"
                                m={0}
                                opacity={isEnabled ? 1 : 0.5}
                                p={0}
                                size="sm"
                                textAlign="center"
                                textTransform="uppercase"
                                verticalAlign="middle"
                                whiteSpace="nowrap"
                            >
                                {nodeState.schema.name}
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
                {nodeProgress && (
                    <IteratorProcess
                        nodeProgress={nodeProgress}
                        progressColor={interpolateColor(accentColor, bgColor, 0.5)}
                    />
                )}
            </VStack>
        );
    }
);
