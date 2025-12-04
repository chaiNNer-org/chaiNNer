import { DownloadIcon } from '@chakra-ui/icons';
import {
    AlertDialog,
    AlertDialogBody,
    AlertDialogContent,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogOverlay,
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
import { memo, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import semver from 'semver';
import logo from '../../../public/icons/png/256x256.png';
import { appVersion } from '../../appConstants';
import { GitHubRelease, getLatestVersionIfUpdateAvailable } from '../../helpers/github';
import { useSettings } from '../../hooks/useSettings';
import { useStored } from '../../hooks/useStored';
import { Markdown } from '../Markdown';

export const AppInfo = memo(() => {
    const { t } = useTranslation();
    const { checkForUpdatesOnStartup } = useSettings();

    const [updateVersion, setUpdateVersion] = useState<GitHubRelease>();
    const [changelog, setChangelog] = useState<string>();

    useEffect(() => {
        getLatestVersionIfUpdateAvailable(appVersion)
            .then((data) => {
                if (data) {
                    setUpdateVersion(data.version);
                    setChangelog(data.changelog);
                }
            })
            .catch(() => {});
    }, []);

    const { isOpen: isModalOpen, onOpen: onModalOpen, onClose: onModalClose } = useDisclosure();
    const { isOpen: isAlertOpen, onOpen: onAlertOpen, onClose: onAlertClose } = useDisclosure();

    const [lastIgnoredUpdate, setLastIgnoredUpdate] = useStored<string | undefined>(
        'ignored-update',
        undefined
    );

    const leastDestructiveRef = useRef(null);

    useEffect(() => {
        if (checkForUpdatesOnStartup) {
            if (updateVersion) {
                if (lastIgnoredUpdate && semver.lte(lastIgnoredUpdate, updateVersion.tag_name)) {
                    return;
                }
                onAlertOpen();
            }
        }
    }, [lastIgnoredUpdate, checkForUpdatesOnStartup, onAlertOpen, updateVersion]);

    return (
        <>
            <HStack>
                <Image
                    boxSize="36px"
                    draggable={false}
                    src={logo}
                />
                <Heading
                    display={{ base: 'none', lg: 'inherit' }}
                    size="md"
                    // eslint-disable-next-line i18next/no-literal-string
                >
                    chaiNNer
                </Heading>
                <Tag display={{ base: 'none', lg: 'inherit' }}>{t('header.alpha', 'Alpha')}</Tag>
                {/* eslint-disable-next-line i18next/no-literal-string */}
                <Tag>v{appVersion}</Tag>
                {updateVersion && (
                    <Tooltip
                        closeOnClick
                        closeOnMouseDown
                        borderRadius={8}
                        label={t('header.updateAvailable', 'Update available ({{version}})', {
                            version: updateVersion.tag_name,
                        })}
                        px={2}
                        py={1}
                    >
                        <IconButton
                            aria-label={t('header.updateAvailableAria', 'Update available')}
                            colorScheme="green"
                            icon={<DownloadIcon />}
                            variant="ghost"
                            onClick={onModalOpen}
                        />
                    </Tooltip>
                )}
            </HStack>
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
                    <ModalHeader>{t('header.updateChangelog', 'Update Changelog')}</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody bgColor="var(--bg-900)">
                        <Markdown>{changelog ?? ''}</Markdown>
                    </ModalBody>

                    <ModalFooter>
                        <HStack>
                            <Button
                                variant="ghost"
                                onClick={onModalClose}
                            >
                                {t('common.close', 'Close')}
                            </Button>
                            <Button
                                isExternal
                                as={Link}
                                colorScheme="gray"
                                href={updateVersion?.html_url}
                            >
                                {t('header.viewReleaseOnGitHub', 'View release on GitHub')}
                            </Button>
                            <Button
                                isExternal
                                as={Link}
                                colorScheme="green"
                                href="https://chaiNNer.app/download"
                            >
                                {t('header.downloadFromWebsite', 'Download from chaiNNer.app')}
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
                            {t('header.updateAvailableTitle', 'Update Available ({{version}})', {
                                version: updateVersion?.tag_name,
                            })}
                        </AlertDialogHeader>

                        <AlertDialogBody>
                            {t(
                                'header.updateAvailableMessage',
                                'There is an update available for version {{version}}. Would you like to view the changelog?',
                                { version: updateVersion?.tag_name }
                            )}
                        </AlertDialogBody>

                        <AlertDialogFooter>
                            <HStack>
                                <Button
                                    ref={leastDestructiveRef}
                                    variant="ghost"
                                    onClick={onAlertClose}
                                >
                                    {t('common.close', 'Close')}
                                </Button>
                                <Button
                                    onClick={() => {
                                        if (updateVersion?.tag_name) {
                                            setLastIgnoredUpdate(updateVersion.tag_name);
                                        }
                                        onAlertClose();
                                    }}
                                >
                                    {t('header.ignoreUpdate', 'Ignore Update')}
                                </Button>
                                <Button
                                    colorScheme="green"
                                    onClick={() => {
                                        onModalOpen();
                                        onAlertClose();
                                    }}
                                >
                                    {t('header.viewUpdate', 'View Update')}
                                </Button>
                            </HStack>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialogOverlay>
            </AlertDialog>
        </>
    );
});
