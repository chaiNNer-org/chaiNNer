import { ChevronDownIcon, ChevronRightIcon } from '@chakra-ui/icons';
import {
    Box,
    Center,
    HStack,
    Heading,
    IconButton,
    Input,
    Spacer,
    Text,
    VStack,
} from '@chakra-ui/react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import ReactTimeAgo from 'react-time-ago';
import { useContext } from 'use-context-selector';
import { getKeyInfo } from '../../../common/nodes/keyInfo';
import { Validity } from '../../../common/Validity';
import { AlertBoxContext, AlertType } from '../../contexts/AlertBoxContext';
import { ExecutionStatusContext, NodeProgress } from '../../contexts/ExecutionContext';
import { FakeNodeContext } from '../../contexts/FakeExampleContext';
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
    const { paused } = useContext(ExecutionStatusContext);

    const { progress, eta, index, total } = nodeProgress;
    const etaDate = new Date();
    etaDate.setSeconds(etaDate.getSeconds() + eta);

    let etaText;
    if (paused) {
        etaText = 'Paused';
    } else if (progress >= 1) {
        etaText = 'Finished';
    } else {
        etaText = (
            <>
                ETA:{' '}
                <ReactTimeAgo
                    future
                    date={etaDate}
                    locale="en-US"
                    timeStyle="round"
                    tooltip={false}
                />
            </>
        );
    }

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
                        {etaText}
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

interface KeyInfoLabelProps {
    nodeState: NodeState;
}

const KeyInfoLabel = memo(({ nodeState }: KeyInfoLabelProps) => {
    const { sendAlert } = useContext(AlertBoxContext);

    const { schema, inputData, type } = nodeState;
    const [info, error] = useMemo((): [string | undefined, unknown] => {
        try {
            return [getKeyInfo(schema, inputData, type.instance), undefined];
        } catch (e) {
            return [undefined, e];
        }
    }, [schema, inputData, type.instance]);

    useEffect(() => {
        if (error) {
            sendAlert({
                type: AlertType.ERROR,
                title: 'Implementation Error',
                message: `Unable to determine key info for node ${schema.name} (${
                    schema.schemaId
                }) due to an error in the implementation of the key info:\n\n${String(error)}`,
            });
        }
    }, [schema, error, sendAlert]);

    // eslint-disable-next-line react/jsx-no-useless-fragment
    if (!info) return <></>;

    return (
        <Text
            as="span"
            fontSize="sm"
            fontWeight="medium"
            h="full"
            lineHeight={0}
            my="auto"
            textTransform="none"
        >
            {info}
        </Text>
    );
});

interface RenameInputProps {
    name: string;
    onChangeName: (name: string) => void;
    onCancel: () => void;
}
const RenameInput = memo(({ name, onChangeName, onCancel }: RenameInputProps) => {
    const [tempName, setTempName] = useState<string>(name);

    useEffect(() => {
        setTempName(name);
    }, [name]);

    const inputRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        inputRef.current?.select();
    }, []);

    return (
        <Input
            autoFocus
            borderColor="transparent"
            className="nodrag"
            flex={1}
            height="auto"
            htmlSize={0}
            lineHeight="100%"
            my="-0.25rem"
            px={2}
            py="calc(0.25rem - 1px)"
            ref={inputRef}
            size="md"
            textAlign="center"
            value={tempName}
            onBlur={() => {
                onChangeName(tempName);
            }}
            onChange={(e) => {
                setTempName(e.target.value);
            }}
            onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') {
                    onChangeName(tempName);
                }
                if (e.key === 'Escape') {
                    onCancel();
                }
            }}
        />
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
        const { isFake } = useContext(FakeNodeContext);

        const bgColor = useThemeColor('--bg-700');
        const gradL = interpolateColor(accentColor, bgColor, 0.9);
        const gradR = bgColor;

        const maxConnected = Math.max(
            nodeState.connectedInputs.size,
            nodeState.connectedOutputs.size
        );
        const collapsedHandleHeight = '6px';
        const minHeight = `calc(${maxConnected} * ${collapsedHandleHeight})`;

        const name = nodeState.nodeName ?? nodeState.schema.name;
        const [isRenaming, setIsRenaming] = useState(false);

        return (
            <VStack
                spacing={0}
                w="full"
            >
                <Center
                    bgGradient={`linear(to-r, ${gradL}, ${gradR})`}
                    borderBottomColor={accentColor}
                    borderBottomWidth="2px"
                    gap="2px"
                    h="auto"
                    minHeight={isCollapsed ? minHeight : undefined}
                    p="2px"
                    verticalAlign="middle"
                    w="full"
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
                    {!isRenaming && <Spacer />}
                    <HStack
                        flex={isRenaming ? 1 : undefined}
                        style={{ contain: isRenaming ? 'size' : undefined }}
                        verticalAlign="middle"
                        onDoubleClick={(event) => {
                            event.stopPropagation();
                            if (!isFake) {
                                setIsRenaming(true);
                            }
                        }}
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
                                icon={nodeState.schema.icon}
                            />
                        </Center>
                        {isRenaming ? (
                            <RenameInput
                                name={name}
                                onCancel={() => {
                                    setIsRenaming(false);
                                }}
                                onChangeName={(newName) => {
                                    setIsRenaming(false);

                                    // clean up user input
                                    // eslint-disable-next-line no-param-reassign
                                    newName = newName.trim().replace(/\s+/g, ' ');

                                    if (
                                        !newName ||
                                        newName.toUpperCase() ===
                                            nodeState.schema.name.toUpperCase()
                                    ) {
                                        // reset to default name
                                        nodeState.setNodeName(undefined);
                                    } else {
                                        nodeState.setNodeName(newName);
                                    }
                                }}
                            />
                        ) : (
                            <HStack>
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
                                    {name}
                                </Heading>
                                {isCollapsed && nodeState.schema.keyInfo && (
                                    <KeyInfoLabel nodeState={nodeState} />
                                )}
                            </HStack>
                        )}
                    </HStack>
                    {!isRenaming && <Spacer />}
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
