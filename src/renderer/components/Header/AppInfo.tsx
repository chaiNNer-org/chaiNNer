import { DownloadIcon } from '@chakra-ui/icons';
import {
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
import { memo, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { LatestReleaseType, getLatestVersionIfUpdateAvailable } from '../../../common/api/github';
import { ipcRenderer } from '../../../common/safeIpc';
import logo from '../../../public/icons/png/256x256.png';
import { useAsyncEffect } from '../../hooks/useAsyncEffect';

export const AppInfo = memo(() => {
    const [appVersion, setAppVersion] = useState<string | null>(null);
    useAsyncEffect(
        () => ({
            supplier: () => ipcRenderer.invoke('get-app-version'),
            successEffect: setAppVersion,
        }),
        []
    );

    const [updateVersion, setUpdateVersion] = useState<LatestReleaseType>();
    const [changelog, setChangelog] = useState<string>();

    useEffect(() => {
        if (!appVersion) {
            return;
        }
        getLatestVersionIfUpdateAvailable('0.18.2')
            .then((data) => {
                if (data) {
                    setUpdateVersion(data.version);
                    setChangelog(data.changelog);
                }
            })
            .catch(console.error);
    }, [appVersion]);

    const { isOpen, onOpen, onClose } = useDisclosure();

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
                                onClick={() => onOpen()}
                            />
                        </Tooltip>
                    )}
                </HStack>
            </Box>
            <Modal
                isCentered
                isOpen={isOpen}
                scrollBehavior="inside"
                size="xl"
                onClose={onClose}
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
                                onClick={onClose}
                            >
                                Close
                            </Button>
                            <Button
                                isExternal
                                as={Link}
                                colorScheme="green"
                                href={updateVersion?.html_url}
                            >
                                Download from Github
                            </Button>
                            <Button
                                isExternal
                                as={Link}
                                colorScheme="blue"
                                href="https://chaiNNer.app/download"
                            >
                                Download from chaiNNer.app
                            </Button>
                        </HStack>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </>
    );
});
