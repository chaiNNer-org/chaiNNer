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
                        ? `${t('RESUME', 'Resume')} (F5)`
                        : `${t('RUN', 'Run')} (F5)`
                }
                px={2}
                py={1}
            >
                <IconButton
                    aria-label={t('RUN_BUTTON', 'Run button')}
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
                label={`${t('PAUSE', 'Pause')} (F6)`}
                px={2}
                py={1}
            >
                <IconButton
                    aria-label={t('PAUSE_BUTTON', 'Pause button')}
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
                label={`${t('STOP', 'Stop')} (F7)`}
                px={2}
                py={1}
            >
                <IconButton
                    aria-label={t('STOP_BUTTON', 'Stop button')}
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
