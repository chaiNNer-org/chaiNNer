import { Box, Button, Center, Icon } from '@chakra-ui/react';
import { memo, useEffect, useMemo, useState } from 'react';
import { IoAddOutline } from 'react-icons/io5';
import { useContextSelector } from 'use-context-selector';
import { getUniqueKey } from '../../../common/group-inputs';
import { findLastIndex, getInputValue } from '../../../common/util';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { GroupProps } from './props';
import { someInput } from './util';

export const OptionalInputsGroup = memo(
    ({ inputs, nodeState, ItemRenderer }: GroupProps<'optional-list'>) => {
        const { id: nodeId, inputData } = nodeState;

        const isNodeInputLocked = useContextSelector(
            GlobalVolatileContext,
            (c) => c.isNodeInputLocked
        );

        // number of edges that need to be uncovered due to either having a value or an edge
        const uncoveredDueToValue = useMemo(() => {
            return (
                findLastIndex(inputs, (item) => {
                    return someInput(item, (input) => {
                        const value = getInputValue(input.id, inputData);
                        return value !== undefined || isNodeInputLocked(nodeId, input.id);
                    });
                }) + 1
            );
        }, [inputs, inputData, nodeId, isNodeInputLocked]);

        // number of inputs the user set to be uncovered
        const [userUncovered, setUserUncovered] = useState(0);

        useEffect(() => {
            setUserUncovered(Math.max(userUncovered, uncoveredDueToValue));
        }, [userUncovered, uncoveredDueToValue]);

        const uncovered = Math.max(uncoveredDueToValue, userUncovered);
        const showMoreButton = uncovered < inputs.length;

        return (
            <>
                {inputs.slice(0, uncovered).map((item) => (
                    <ItemRenderer
                        item={item}
                        key={getUniqueKey(item)}
                        nodeState={nodeState}
                    />
                ))}
                {showMoreButton && (
                    <Box
                        bg="var(--node-bg-color)"
                        w="full"
                    >
                        <Center>
                            <Button
                                _hover={{
                                    background: 'var(--bg-600)',
                                }}
                                aria-label="Add Input"
                                bg="var(--bg-700)"
                                className="nodrag"
                                height="auto"
                                mb={-1}
                                minWidth={0}
                                mt={1}
                                p={1}
                                width="66%"
                                onClick={() => setUserUncovered(uncovered + 1)}
                            >
                                <Icon
                                    as={IoAddOutline}
                                    boxSize="1rem"
                                    color="var(--fg-700)"
                                />
                            </Button>
                        </Center>
                    </Box>
                )}
            </>
        );
    }
);
