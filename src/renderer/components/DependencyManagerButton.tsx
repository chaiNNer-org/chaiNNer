import { DownloadIcon } from '@chakra-ui/icons';
import {
    Button,
    ButtonGroup,
    IconButton,
    Popover,
    PopoverArrow,
    PopoverBody,
    PopoverCloseButton,
    PopoverContent,
    PopoverFooter,
    PopoverHeader,
    PopoverTrigger,
    Tag,
    TagLabel,
    Tooltip,
    VStack,
    useDisclosure,
} from '@chakra-ui/react';
import { memo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useContext } from 'use-context-selector';
import { DependencyContext } from '../contexts/DependencyContext';

export const DependencyManagerButton = memo(() => {
    const { t } = useTranslation();

    const { openDependencyManager, availableUpdates } = useContext(DependencyContext);

    const { isOpen, onToggle, onClose } = useDisclosure();

    const shownOnce = useRef(false);
    useEffect(() => {
        if (shownOnce.current) {
            return;
        }

        if (availableUpdates > 0) {
            // Delay the popup a bit to make it more obviously pop up
            setTimeout(() => {
                onToggle();
                shownOnce.current = true;
                setTimeout(() => {
                    onClose();
                }, 10000);
            }, 1000);
        }
    }, [availableUpdates, onClose, onToggle]);

    const initialFocusRef = useRef(null);

    return (
        <Popover
            closeOnBlur
            isLazy
            initialFocusRef={initialFocusRef}
            isOpen={isOpen}
            placement="bottom"
            returnFocusOnClose={false}
            onClose={onClose}
        >
            <Tooltip
                closeOnClick
                closeOnMouseDown
                borderRadius={8}
                label={t('dependencyManager.manageDependencies', 'Manage Dependencies')}
                px={2}
                py={1}
            >
                <VStack
                    m={0}
                    spacing={0}
                >
                    {availableUpdates > 0 ? (
                        <Tag
                            borderRadius="full"
                            colorScheme="blue"
                            ml={-7}
                            mt={-1}
                            position="fixed"
                            size="sm"
                        >
                            <TagLabel textAlign="center">{availableUpdates}</TagLabel>
                        </Tag>
                    ) : null}
                    <PopoverTrigger>
                        <IconButton
                            aria-label={t(
                                'dependencyManager.manageDependencies',
                                'Manage Dependencies'
                            )}
                            icon={<DownloadIcon />}
                            position="relative"
                            size="md"
                            variant="outline"
                            onClick={openDependencyManager}
                        />
                    </PopoverTrigger>
                </VStack>
            </Tooltip>
            <PopoverContent>
                <PopoverHeader fontWeight="semibold">
                    {t('dependencyManager.updatesAvailable', 'Updates Available')}
                </PopoverHeader>
                <PopoverArrow />
                <PopoverCloseButton />
                <PopoverBody>
                    {t(
                        'dependencyManager.updatesAvailableDescription',
                        'There are {{count}} packages with available dependency updates.',
                        { count: availableUpdates }
                    )}
                </PopoverBody>
                <PopoverFooter
                    display="flex"
                    justifyContent="flex-end"
                >
                    <ButtonGroup size="sm">
                        <Button
                            variant="outline"
                            onClick={onClose}
                        >
                            {t('common.cancel', 'Cancel')}
                        </Button>
                        <Button
                            colorScheme="blue"
                            ref={initialFocusRef}
                            onClick={openDependencyManager}
                        >
                            {t('dependencyManager.openDependencyManager', 'Open Dependency Manager')}
                        </Button>
                    </ButtonGroup>
                </PopoverFooter>
            </PopoverContent>
        </Popover>
    );
});
