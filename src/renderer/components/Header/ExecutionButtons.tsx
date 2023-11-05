import { HStack, IconButton, Tooltip } from '@chakra-ui/react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { IoPause, IoPlay, IoStop } from 'react-icons/io5';
import { useContext } from 'use-context-selector';
import { ExecutionContext, ExecutionStatus } from '../../contexts/ExecutionContext';

export const ExecutionButtons = memo(() => {
    const { t } = useTranslation();

    const { run, pause, kill, status } = useContext(ExecutionContext);

    return (
        <HStack>
            <Tooltip
                closeOnClick
                closeOnMouseDown
                borderRadius={8}
                label={
                    status === ExecutionStatus.PAUSED
                        ? `${t('header.resume', 'Resume')} (F5)`
                        : `${t('header.run', 'Run')} (F5)`
                }
                px={2}
                py={1}
            >
                <IconButton
                    aria-label={t('header.runButton', 'Run button')}
                    colorScheme="green"
                    isDisabled={
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
                label={`${t('header.pause', 'Pause')} (F6)`}
                px={2}
                py={1}
            >
                <IconButton
                    aria-label={t('header.pauseButton', 'Pause button')}
                    colorScheme="yellow"
                    isDisabled={status !== ExecutionStatus.RUNNING}
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
                label={`${t('header.stop', 'Stop')} (F7)`}
                px={2}
                py={1}
            >
                <IconButton
                    aria-label={t('header.stopButton', 'Stop button')}
                    colorScheme="red"
                    isDisabled={![ExecutionStatus.RUNNING, ExecutionStatus.PAUSED].includes(status)}
                    icon={<IoStop />}
                    isLoading={ExecutionStatus.KILLING === status}
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
