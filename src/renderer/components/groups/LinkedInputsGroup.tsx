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
                [linked, setInputValue, inputs]
            ),
        });

        const allConnected = inputs.every((input) => nodeState.connectedInputs.has(input.id));

        const ttLabel = linked
            ? `The values of ${joinEnglish(
                  inputs.map((input) => input.label),
                  'and'
              )} are currently linked to the same value. Click here to undo this link.`
            : `Click here to link ${joinEnglish(
                  inputs.map((input) => input.label),
                  'and'
              )} to the same value.`;

        return (
            <HStack spacing={0}>
                <Box w="full">
                    {inputs.map((item) => (
                        <ItemRenderer
                            item={item}
                            key={item.id}
                            nodeState={modifiedNodeState}
                        />
                    ))}
                </Box>
                <Box pr={2}>
                    <Tooltip
                        closeOnClick
                        closeOnPointerDown
                        hasArrow
                        borderRadius={8}
                        isDisabled={isLocked || allConnected}
                        label={ttLabel}
                        openDelay={2000}
                    >
                        <IconButton
                            aria-label={ttLabel}
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
                            size="md"
                            variant="outline"
                            w="1.4rem"
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
                                            (input) => !nodeState.connectedInputs.has(input.id)
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
    }
);
