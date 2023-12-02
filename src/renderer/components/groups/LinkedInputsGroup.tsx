import { Box, HStack, IconButton, Tooltip } from '@chakra-ui/react';
import { memo, useCallback, useState } from 'react';
import { IoMdLink } from 'react-icons/io';
import { IoUnlink } from 'react-icons/io5';
import { InputId, InputValue } from '../../../common/common-types';
import { joinEnglish } from '../../../common/util';
import { NodeState } from '../../helpers/nodeState';
import { useMemoObject } from '../../hooks/useMemo';
import { GroupProps } from './props';

export const LinkedInputsGroup = memo(
    ({ inputs, nodeState, ItemRenderer }: GroupProps<'linked-inputs'>) => {
        const { inputData, setInputValue, isLocked } = nodeState;

        const [linked, setLinked] = useState<boolean>(() => {
            const allSameValue = inputs.every((input) => {
                const value = inputData[input.id];
                return value === inputData[inputs[0].id];
            });
            return allSameValue;
        });

        const [lastUsedInput, setLastUsedInput] = useState<InputId | null>(null);

        const modifiedNodeState = useMemoObject<NodeState>({
            ...nodeState,
            setInputValue: useCallback(
                (inputId: InputId, value: InputValue): void => {
                    setInputValue(inputId, value);
                    setLastUsedInput(inputId);

                    if (linked && typeof value === 'number') {
                        for (const input of inputs) {
                            if (input.id !== inputId) {
                                setInputValue(input.id, value);
                            }
                        }
                    }
                },
                [linked, setInputValue, inputs],
            ),
        });

        const allConnected = inputs.every((input) => nodeState.connectedInputs.has(input.id));

        const label = linked
            ? `The values of ${joinEnglish(
                  inputs.map((input) => input.label),
                  'and',
              )} are currently linked to the same value. Click here to undo this link.`
            : `Click here to link ${joinEnglish(
                  inputs.map((input) => input.label),
                  'and',
              )} to the same value.`;

        const linkButtonWidth = 1.4;
        const linkButtonHeight = 1.6;

        return (
            <HStack
                alignItems="normal"
                pr={1}
                spacing={0}
            >
                <Box w="full">
                    {inputs.map((item) => (
                        <ItemRenderer
                            item={item}
                            key={item.id}
                            nodeState={modifiedNodeState}
                        />
                    ))}
                </Box>
                <Box
                    alignItems="center"
                    display="flex"
                    position="relative"
                >
                    <Box
                        borderColor="white white transparent transparent"
                        borderRadius="0 .5rem 0 0"
                        borderStyle="solid"
                        borderWidth="1px 2px 0 0"
                        bottom={`calc(50% + ${linkButtonHeight / 2}rem)`}
                        opacity={allConnected ? 0.25 : 0.5}
                        position="absolute"
                        right={`calc(${linkButtonWidth / 2}rem - 1px)`}
                        top=".5rem"
                        w={2}
                    />
                    <Box
                        borderColor="transparent white white transparent"
                        borderRadius="0 0 .5rem 0"
                        borderStyle="solid"
                        borderWidth="0 2px 1px 0"
                        bottom=".5rem"
                        opacity={allConnected ? 0.25 : 0.5}
                        position="absolute"
                        right={`calc(${linkButtonWidth / 2}rem - 1px)`}
                        top={`calc(50% + ${linkButtonHeight / 2}rem)`}
                        w={2}
                    />
                    <Tooltip
                        closeOnClick
                        closeOnPointerDown
                        hasArrow
                        borderRadius={8}
                        isDisabled={isLocked || allConnected}
                        label={label}
                        openDelay={2000}
                    >
                        <IconButton
                            aria-label={label}
                            className="nodrag"
                            h="2rem"
                            icon={
                                linked ? (
                                    <IoMdLink style={{ transform: 'rotate(90deg)' }} />
                                ) : (
                                    <IoUnlink style={{ transform: 'rotate(90deg)' }} />
                                )
                            }
                            isDisabled={isLocked || allConnected}
                            minWidth={0}
                            ml="-0.25rem"
                            size="md"
                            variant="ghost"
                            w={`${linkButtonWidth}rem`}
                            onClick={() => {
                                if (linked) {
                                    // just unlink
                                    setLinked(false);
                                } else {
                                    // link and set inputs to the same value
                                    setLinked(true);

                                    let value: InputValue;
                                    if (
                                        lastUsedInput !== null &&
                                        !nodeState.connectedInputs.has(lastUsedInput)
                                    ) {
                                        // use the value of the last used input (if not connected)
                                        value = nodeState.inputData[lastUsedInput];
                                    } else {
                                        // use the value of the first unconnected input
                                        const firstUnconnectedInput = inputs.find(
                                            (input) => !nodeState.connectedInputs.has(input.id),
                                        );
                                        if (firstUnconnectedInput) {
                                            value = nodeState.inputData[firstUnconnectedInput.id];
                                        }
                                    }

                                    if (value !== undefined) {
                                        for (const input of inputs) {
                                            setInputValue(input.id, value);
                                        }
                                    }
                                }
                            }}
                        />
                    </Tooltip>
                </Box>
            </HStack>
        );
    },
);
