import { DownloadIcon } from '@chakra-ui/icons';
import {
    AlertDialog,
    AlertDialogBody,
    AlertDialogContent,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogOverlay,
    Box,
    Button,
    HStack,
    Heading,
    IconButton,
    Image,
    Link,
    Modal,
    ModalBody,
    ModalCloseButton,
    ModalContent,
    ModalFooter,
    ModalHeader,
    ModalOverlay,
    Tag,
    Tooltip,
    useDisclosure,
} from '@chakra-ui/react';
import ChakraUIRenderer from 'chakra-ui-markdown-renderer';
import { memo, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import semver from 'semver';
import { useContext } from 'use-context-selector';
import { GitHubRelease, getLatestVersionIfUpdateAvailable } from '../../../common/api/github';
import { ipcRenderer } from '../../../common/safeIpc';
import logo from '../../../public/icons/png/256x256.png';
import { SettingsContext } from '../../contexts/SettingsContext';
import { useAsyncEffect } from '../../hooks/useAsyncEffect';

export const AppInfo = memo(() => {
    const { useCheckUpdOnStrtUp } = useContext(SettingsContext);
    const [checkUpdOnStrtUp] = useCheckUpdOnStrtUp;

    const [appVersion, setAppVersion] = useState<string | null>(null);
    useAsyncEffect(
        () => ({
            supplier: () => ipcRenderer.invoke('get-app-version'),
            successEffect: setAppVersion,
        }),
        []
    );

    const [updateVersion, setUpdateVersion] = useState<GitHubRelease>();
    const [changelog, setChangelog] = useState<string>();

    useEffect(() => {
        if (!appVersion) {
            return;
        }
        getLatestVersionIfUpdateAvailable(appVersion)
            .then((data) => {
                if (data) {
                    setUpdateVersion(data.version);
                    setChangelog(data.changelog);
                }
            })
            .catch(() => {});
    }, [appVersion]);

    const { isOpen: isModalOpen, onOpen: onModalOpen, onClose: onModalClose } = useDisclosure();
    const { isOpen: isAlertOpen, onOpen: onAlertOpen, onClose: onAlertClose } = useDisclosure();

    const leastDestructiveRef = useRef(null);

    useEffect(() => {
        if (checkUpdOnStrtUp) {
            if (appVersion && updateVersion) {
                const lastIgnoredUpdate = localStorage.getItem(`ignored-update`);
                if (lastIgnoredUpdate && semver.lte(lastIgnoredUpdate, updateVersion.tag_name)) {
                    return;
                }
                onAlertOpen();
            }
        }
    }, [appVersion, checkUpdOnStrtUp, onAlertOpen, updateVersion]);

    return (
        <>
            <Box w="full">
                <HStack
                    ml={0}
                    mr="auto"
                >
                    <Image
                        boxSize="36px"
                        draggable={false}
                        src={logo}
                    />
                    <Heading size="md">chaiNNer</Heading>
                    <Tag>Alpha</Tag>
                    <Tag>{`v${appVersion ?? '#.#.#'}`}</Tag>
                    {updateVersion && (
                        <Tooltip
                            closeOnClick
                            closeOnMouseDown
                            borderRadius={8}
                            label={`Update available (${updateVersion.tag_name})`}
                            px={2}
                            py={1}
                        >
                            <IconButton
                                aria-label="Update available"
                                colorScheme="green"
                                icon={<DownloadIcon />}
                                variant="ghost"
                                onClick={onModalOpen}
                            />
                        </Tooltip>
                    )}
                </HStack>
            </Box>
            <Modal
                isCentered
                isOpen={isModalOpen}
                scrollBehavior="inside"
                size="xl"
                onClose={onModalClose}
            >
                <ModalOverlay />
                <ModalContent
                    bgColor="var(--chain-editor-bg)"
                    h="calc(100% - 7.5rem)"
                    maxW="unset"
                    my={0}
                    overflow="hidden"
                    w="calc(100% - 7.5rem)"
                >
                    <ModalHeader>Update Changelog</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody bgColor="var(--bg-900)">
                        <ReactMarkdown
                            skipHtml
                            components={ChakraUIRenderer()}
                        >
                            {changelog ?? ''}
                        </ReactMarkdown>
                    </ModalBody>

                    <ModalFooter>
                        <HStack>
                            <Button
                                variant="ghost"
                                onClick={onModalClose}
                            >
                                Close
                            </Button>
                            <Button
                                isExternal
                                as={Link}
                                colorScheme="gray"
                                href={updateVersion?.html_url}
                            >
                                View release on GitHub
                            </Button>
                            <Button
                                isExternal
                                as={Link}
                                colorScheme="green"
                                href="https://chaiNNer.app/download"
                            >
                                Download from chaiNNer.app
                            </Button>
                        </HStack>
                    </ModalFooter>
                </ModalContent>
            </Modal>
            <AlertDialog
                isCentered
                isOpen={isAlertOpen}
                leastDestructiveRef={leastDestructiveRef}
                onClose={onAlertClose}
            >
                <AlertDialogOverlay>
                    <AlertDialogContent bgColor="var(--chain-editor-bg)">
                        <AlertDialogHeader
                            fontSize="lg"
                            fontWeight="bold"
                        >
                            Update Available ({updateVersion?.tag_name})
                        </AlertDialogHeader>

                        <AlertDialogBody>
                            There is an update available for version {updateVersion?.tag_name}.
                            Would you like to view the changelog?
                        </AlertDialogBody>

                        <AlertDialogFooter>
                            <HStack>
                                <Button
                                    ref={leastDestructiveRef}
                                    variant="ghost"
                                    onClick={onAlertClose}
                                >
                                    Close
                                </Button>
                                <Button
                                    onClick={() => {
                                        if (updateVersion?.tag_name) {
                                            localStorage.setItem(
                                                `ignored-update`,
                                                updateVersion.tag_name
                                            );
                                        }
                                        onAlertClose();
                                    }}
                                >
                                    Ignore Update
                                </Button>
                                <Button
                                    colorScheme="green"
                                    onClick={() => {
                                        onModalOpen();
                                        onAlertClose();
                                    }}
                                >
                                    View Update
                                </Button>
                            </HStack>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialogOverlay>
            </AlertDialog>
        </>
    );
});
