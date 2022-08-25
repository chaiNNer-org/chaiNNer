import {
    Box,
    Flex,
    HStack,
    Heading,
    IconButton,
    Image,
    Spacer,
    Tag,
    Tooltip,
} from '@chakra-ui/react';
import { memo, useState } from 'react';
import { IoPause, IoPlay, IoStop } from 'react-icons/io5';
import { useContext } from 'use-context-selector';
import { ipcRenderer } from '../../common/safeIpc';
import logo from '../../public/icons/png/256x256.png';
import { ExecutionContext, ExecutionStatus } from '../contexts/ExecutionContext';
import { useAsyncEffect } from '../hooks/useAsyncEffect';
import { DependencyManagerButton } from './DependencyManagerButton';
import { SettingsButton } from './SettingsModal';
import { SystemStats } from './SystemStats';

export const Header = memo(() => {
    const { run, pause, kill, status } = useContext(ExecutionContext);

    const [appVersion, setAppVersion] = useState('#.#.#');
    useAsyncEffect(
        {
            supplier: () => ipcRenderer.invoke('get-app-version'),
            successEffect: setAppVersion,
        },
        []
    );

    return (
        <Box
            bg="var(--header-bg)"
            borderRadius="lg"
            borderWidth="0px"
            h="56px"
            w="100%"
        >
            <Flex
                align="center"
                h="100%"
                p={2}
            >
                <HStack>
                    {/* <LinkIcon /> */}
                    <Image
                        boxSize="36px"
                        draggable={false}
                        src={logo}
                    />
                    <Heading size="md">chaiNNer</Heading>
                    <Tag>Alpha</Tag>
                    <Tag>{`v${appVersion}`}</Tag>
                </HStack>
                <Spacer />

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
                                !(
                                    status === ExecutionStatus.READY ||
                                    status === ExecutionStatus.PAUSED
                                )
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
                                !(
                                    status === ExecutionStatus.RUNNING ||
                                    status === ExecutionStatus.PAUSED
                                )
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
                <Spacer />
                <HStack>
                    <SystemStats />
                    <DependencyManagerButton />
                    <SettingsButton />
                </HStack>
            </Flex>
        </Box>
    );
});
