import { HStack, IconButton, Tooltip } from '@chakra-ui/react';
import { memo } from 'react';
import { IoPause, IoPlay, IoStop } from 'react-icons/io5';
import { useContext } from 'use-context-selector';
import { ExecutionContext, ExecutionStatus } from '../../contexts/ExecutionContext';

export const ExecutionButtons = memo(() => {
    const { run, pause, kill, status } = useContext(ExecutionContext);

    return (
        <HStack>
            <Tooltip
                closeOnClick
                closeOnMouseDown
                borderRadius={8}
                label={status === ExecutionStatus.PAUSED ? 'Resume (F5)' : 'Run (F5)'}
                px={2}
                py={1}
            >
                <IconButton
                    aria-label="Run button"
                    colorScheme="green"
                    disabled={
                        !(status === ExecutionStatus.READY || status === ExecutionStatus.PAUSED)
                    }
                    icon={<IoPlay />}
                    size="md"
                    variant="outline"
                    onClick={() => {
                        // eslint-disable-next-line @typescript-eslint/no-floating-promises
                        run();
                    }}
                />
            </Tooltip>
            <Tooltip
                closeOnClick
                closeOnMouseDown
                borderRadius={8}
                label="Pause (F6)"
                px={2}
                py={1}
            >
                <IconButton
                    aria-label="Pause button"
                    colorScheme="yellow"
                    disabled={status !== ExecutionStatus.RUNNING}
                    icon={<IoPause />}
                    size="md"
                    variant="outline"
                    onClick={() => {
                        // eslint-disable-next-line @typescript-eslint/no-floating-promises
                        pause();
                    }}
                />
            </Tooltip>
            <Tooltip
                closeOnClick
                closeOnMouseDown
                borderRadius={8}
                label="Stop (F7)"
                px={2}
                py={1}
            >
                <IconButton
                    aria-label="Stop button"
                    colorScheme="red"
                    disabled={
                        !(status === ExecutionStatus.RUNNING || status === ExecutionStatus.PAUSED)
                    }
                    icon={<IoStop />}
                    size="md"
                    variant="outline"
                    onClick={() => {
                        // eslint-disable-next-line @typescript-eslint/no-floating-promises
                        kill();
                    }}
                />
            </Tooltip>
        </HStack>
    );
});
