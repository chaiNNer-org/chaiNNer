import { IconButton, Tooltip } from '@chakra-ui/react';
import { memo, useCallback } from 'react';
import { HiOutlineRefresh } from 'react-icons/hi';
import { useContextSelector } from 'use-context-selector';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { SchemaInput } from '../inputs/SchemaInput';
import { GroupProps } from './props';

export const SeedGroup = memo(
    ({
        inputs,
        inputData,
        setInputValue,
        inputSize,
        isLocked,
        nodeId,
        schemaId,
    }: GroupProps<'seed'>) => {
        const [input] = inputs;

        const isInputLocked = useContextSelector(GlobalVolatileContext, (c) => c.isNodeInputLocked)(
            nodeId,
            input.id
        );

        const setRandom = useCallback(() => {
            const RANDOM_MAX = 1e6;
            const randomValue = Math.floor(Math.random() * RANDOM_MAX);
            setInputValue(input.id, randomValue);
        }, [input.id, setInputValue]);

        return (
            <SchemaInput
                afterInput={
                    <Tooltip
                        closeOnClick
                        closeOnPointerDown
                        hasArrow
                        borderRadius={8}
                        label="Random seed"
                        openDelay={500}
                    >
                        <IconButton
                            aria-label="Random Seed"
                            h="2rem"
                            icon={<HiOutlineRefresh />}
                            isDisabled={isLocked || isInputLocked}
                            minWidth={0}
                            size="md"
                            variant="outline"
                            w="2.4rem"
                            onClick={setRandom}
                        />
                    </Tooltip>
                }
                input={input}
                inputData={inputData}
                inputSize={inputSize}
                isLocked={isLocked}
                nodeId={nodeId}
                schemaId={schemaId}
                setInputValue={setInputValue}
            />
        );
    }
);
