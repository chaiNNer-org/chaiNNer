import {
    Box,
    Flex,
    Heading,
    HStack,
    IconButton,
    Image,
    Spacer,
    Tag,
    Tooltip,
    useColorModeValue,
} from '@chakra-ui/react';
import { memo, useState } from 'react';
import { IoPause, IoPlay, IoStop } from 'react-icons/io5';
import { useContext } from 'use-context-selector';
import { ExecutionContext } from '../helpers/contexts/ExecutionContext';
import { useAsyncEffect } from '../helpers/hooks/useAsyncEffect';
import { ipcRenderer } from '../helpers/safeIpc';
import logo from '../public/icons/png/256x256.png';
import { DependencyManagerButton } from './DependencyManager';
import { SettingsButton } from './SettingsModal';
import SystemStats from './SystemStats';

const Header = () => {
    const { run, pause, kill, isRunning } = useContext(ExecutionContext);

    const [appVersion, setAppVersion] = useState('#.#.#');
    useAsyncEffect(
        {
            supplier: () => ipcRenderer.invoke('get-app-version'),
            successEffect: setAppVersion,
        },
        []
    );

    return (
        <>
            <Box
                bg={useColorModeValue('gray.100', 'gray.800')}
                borderRadius="lg"
                borderWidth="1px"
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
                            label="Start/Resume"
                            px={2}
                            py={1}
                        >
                            <IconButton
                                aria-label="Start button"
                                colorScheme="green"
                                disabled={isRunning}
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
                            label="Pause"
                            px={2}
                            py={1}
                        >
                            <IconButton
                                aria-label="Pause button"
                                colorScheme="yellow"
                                disabled={!isRunning}
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
                            label="Stop"
                            px={2}
                            py={1}
                        >
                            <IconButton
                                aria-label="Stop button"
                                colorScheme="red"
                                disabled={!isRunning}
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
        </>
    );
};

export default memo(Header);
