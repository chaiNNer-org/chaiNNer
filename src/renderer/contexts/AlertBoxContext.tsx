import { CopyIcon, InfoIcon, WarningIcon, WarningTwoIcon } from '@chakra-ui/icons';
import {
    AlertDialog,
    AlertDialogBody,
    AlertDialogCloseButton,
    AlertDialogContent,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogOverlay,
    Box,
    Button,
    Code,
    HStack,
    IconButton,
    UseToastOptions,
    useDisclosure,
    useToast,
} from '@chakra-ui/react';
import { clipboard, shell } from 'electron/common';
import path from 'path';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createContext, useContext, useContextSelector } from 'use-context-selector';
import { log } from '../../common/log';
import { assertNever, noop } from '../../common/util';
import { useMemoObject } from '../hooks/useMemo';
import { ipcRenderer } from '../safeIpc';
import { ContextMenuContext } from './ContextMenuContext';
import { HotkeysContext } from './HotKeyContext';

export type AlertId = number & { __alertId: never };

interface AlertBox {
    sendToast: (options: UseToastOptions) => void;
    sendAlert: (message: Pick<AlertOptions, 'type' | 'title' | 'message' | 'trace'>) => AlertId;
    forgetAlert: (id: AlertId) => void;
    showAlert: (message: AlertOptions) => Promise<number>;
}

export enum AlertType {
    INFO = 'Info',
    WARN = 'Warning',
    ERROR = 'Error',
    CRIT_ERROR = 'Critical Error',
}

export interface AlertOptions {
    type: AlertType;
    title?: string;
    message: string;
    trace?: string;
    buttons?: string[];
    /**
     * The button to that will be selected by default. Defaults to `0`.
     */
    defaultId?: number;
    /**
     * The button that will be entered when the user escapes the popup. Defaults to `defaultId`.
     */
    cancelId?: number;
}

interface InternalMessage extends AlertOptions {
    id: AlertId;
    title: string;
    resolve: (button: number) => void;
}

const EMPTY_MESSAGE: InternalMessage = {
    type: AlertType.INFO,
    id: -1 as AlertId,
    title: '',
    message: '',
    resolve: noop,
};

let idCounter = 1;
const newAlertId = (): AlertId => {
    const id = idCounter;
    idCounter += 1;
    return id as AlertId;
};

const ALERT_FOCUS_ID = 'alert-focus-button';

const pickAlertIcon = (type: AlertType): JSX.Element => {
    switch (type) {
        case AlertType.INFO:
            return (
                <InfoIcon
                    boxSize={4}
                    color="gray.500"
                    mr={2}
                    mt={-1}
                />
            );
        case AlertType.WARN:
            return (
                <WarningTwoIcon
                    boxSize={4}
                    color="yellow.500"
                    mr={2}
                    mt={-1}
                />
            );
        case AlertType.ERROR:
            return (
                <WarningIcon
                    boxSize={4}
                    color="red.500"
                    mr={2}
                    mt={-1}
                />
            );
        case AlertType.CRIT_ERROR:
            return (
                <WarningIcon
                    boxSize={4}
                    color="red.500"
                    mr={2}
                    mt={-1}
                />
            );
        default:
            return assertNever(type);
    }
};

const getButtons = (
    { type, buttons, defaultId = 0, cancelId }: InternalMessage,
    onClose: (button: number) => void,
    cancelRef: React.Ref<HTMLButtonElement>,
    focusId: string
): JSX.Element => {
    const buttonElements: JSX.Element[] = [];

    if (buttons && buttons.length) {
        // eslint-disable-next-line no-param-reassign
        defaultId = Math.min(Math.max(0, defaultId), buttons.length - 1);
        // eslint-disable-next-line no-param-reassign
        cancelId = Math.min(Math.max(0, cancelId ?? defaultId), buttons.length - 1);

        for (let i = 0; i < buttons.length; i += 1) {
            const button = buttons[i];

            buttonElements.push(
                <Button
                    autoFocus={i === defaultId}
                    id={i === defaultId ? focusId : undefined}
                    key={i}
                    ref={i === cancelId ? cancelRef : undefined}
                    onClick={() => onClose(i)}
                >
                    {button}
                </Button>
            );
        }
    } else {
        switch (type) {
            case AlertType.INFO:
            case AlertType.WARN:
            case AlertType.ERROR:
                buttonElements.push(
                    <Button
                        id={focusId}
                        key="ok"
                        ref={cancelRef}
                        onClick={() => onClose(0)}
                    >
                        OK
                    </Button>
                );
                break;
            case AlertType.CRIT_ERROR:
                buttonElements.push(
                    <Button
                        colorScheme="gray"
                        id={focusId}
                        key="logs"
                        ml={3}
                        ref={cancelRef}
                        onClick={() => {
                            ipcRenderer
                                .invoke('get-appdata')
                                .then((appDataPath) => {
                                    shell.openPath(path.join(appDataPath, 'logs')).catch(() => {
                                        log.error('Failed to open logs folder');
                                    });
                                })
                                .catch(() => {
                                    log.error('Failed to get appdata path');
                                });
                        }}
                    >
                        Open Logs Folder
                    </Button>
                );
                buttonElements.push(
                    <Button
                        colorScheme="red"
                        id={focusId}
                        key="exit"
                        ml={3}
                        ref={cancelRef}
                        onClick={() => {
                            window.close();
                            ipcRenderer.invoke('app-quit').catch(log.error);
                        }}
                    >
                        Exit Application
                    </Button>
                );
                break;
            default:
                return assertNever(type);
        }
    }
    // eslint-disable-next-line react/jsx-no-useless-fragment
    return <>{buttonElements}</>;
};

const getCopyText = (message: InternalMessage): string => {
    let text = `${message.title}\n\n${message.message}`;
    if (message.trace) {
        text += `\n\nStack Trace:\n${message.trace}`;
    }
    return text;
};

interface AlertBoxDialogProps {
    isOpen: boolean;
    current: InternalMessage | undefined;
    onClose: (button: number) => void;
    cancelRef: React.RefObject<HTMLButtonElement>;
    progressTotal: number;
    progressCurrent: number;
}
const AlertBoxDialog = memo(
    ({
        isOpen,
        current,
        onClose,
        cancelRef,
        progressTotal,
        progressCurrent,
    }: AlertBoxDialogProps) => {
        const buttons = useMemo(() => {
            return getButtons(current ?? EMPTY_MESSAGE, onClose, cancelRef, ALERT_FOCUS_ID);
        }, [current, onClose, cancelRef]);

        useEffect(() => {
            const timerId = setTimeout(() => {
                if (isOpen) {
                    document.querySelector<HTMLElement>(`#${ALERT_FOCUS_ID}`)?.focus();
                }
            }, 50);
            return () => clearTimeout(timerId);
        }, [isOpen, buttons]);

        const copyText = current ? getCopyText(current) : '';
        const displayTrace = current?.trace?.replace(
            /File "(?:[^\\/]*[\\/])*?backend[\\/]src[\\/]/g,
            'File "'
        );

        return (
            <AlertDialog
                isCentered
                isOpen={isOpen && current !== undefined}
                leastDestructiveRef={cancelRef}
                scrollBehavior="inside"
                onClose={() => cancelRef.current?.click()}
            >
                <AlertDialogOverlay />

                <AlertDialogContent
                    bgColor="var(--chain-editor-bg)"
                    maxWidth="xl"
                >
                    <AlertDialogHeader>
                        {pickAlertIcon(current?.type ?? AlertType.INFO)}
                        {current?.title}
                        {progressTotal > 1 ? ` (${progressCurrent}/${progressTotal})` : ''}
                    </AlertDialogHeader>

                    <AlertDialogCloseButton />
                    <AlertDialogBody
                        userSelect="text"
                        whiteSpace="pre-wrap"
                    >
                        {current?.message}

                        {displayTrace && (
                            <Box mt={4}>
                                <details>
                                    <summary style={{ cursor: 'pointer' }}>Stack Trace</summary>
                                    <Code
                                        display="block"
                                        overflow="auto"
                                        px={4}
                                        py={2}
                                        userSelect="text"
                                        whiteSpace="pre"
                                    >
                                        {displayTrace}
                                    </Code>
                                </details>
                            </Box>
                        )}
                    </AlertDialogBody>
                    <AlertDialogFooter>
                        <HStack width="full">
                            <IconButton
                                _hover={{ background: 'var(--chakra-colors-whiteAlpha-300)' }}
                                aria-label="Copy to Clipboard"
                                background="transparent"
                                icon={<CopyIcon />}
                                title="Copy to Clipboard"
                                onClick={() => clipboard.writeText(copyText)}
                            />
                            <HStack
                                justifyContent="flex-end"
                                width="full"
                            >
                                {buttons}
                            </HStack>
                        </HStack>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        );
    }
);

export const AlertBoxContext = createContext<Readonly<AlertBox>>({} as AlertBox);

export const AlertBoxProvider = memo(({ children }: React.PropsWithChildren<unknown>) => {
    const { closeContextMenu } = useContext(ContextMenuContext);
    const setHotkeysEnabled = useContextSelector(HotkeysContext, (c) => c.setHotkeysEnabled);

    const [queue, setQueue] = useState<readonly InternalMessage[]>([]);
    const current = queue[0] as InternalMessage | undefined;

    const [done, setDone] = useState(0);
    useEffect(() => {
        if (current === undefined) {
            setDone(0);
        }
    }, [current]);

    const push = useCallback((message: InternalMessage) => setQueue((q) => [...q, message]), []);
    const showAlertInternal = useCallback(
        (message: AlertOptions, id: AlertId) => {
            closeContextMenu();
            return new Promise<number>((resolve) => {
                push({ ...message, id, title: message.title ?? message.type, resolve });
            });
        },
        [push, closeContextMenu]
    );
    const showAlert = useCallback(
        (message: AlertOptions) => showAlertInternal(message, newAlertId()),
        [showAlertInternal]
    );
    const sendAlert = useCallback(
        (message: AlertOptions): AlertId => {
            const id = newAlertId();
            showAlertInternal(message, id).catch(log.error);
            return id;
        },
        [showAlertInternal]
    );

    const { isOpen, onOpen, onClose: onDisclosureClose } = useDisclosure();
    const cancelRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (current && !isOpen) {
            setHotkeysEnabled(false);
            onOpen();
        }
    }, [current, isOpen, onOpen, setHotkeysEnabled]);
    useEffect(() => {
        if (!current && isOpen) {
            onDisclosureClose();
            setHotkeysEnabled(true);
        }
    }, [current, isOpen, onDisclosureClose, setHotkeysEnabled]);

    const forgetAlert = useCallback((id: AlertId): void => {
        setQueue((q) => q.filter((a) => a.id !== id));
    }, []);

    const onClose = useCallback(
        (button: number) => {
            setQueue((q) => q.slice(1));
            setDone((prev) => prev + 1);
            current?.resolve(button);
        },
        [current]
    );

    const toast = useToast();
    const sendToast = useCallback(
        (options: UseToastOptions) => {
            // eslint-disable-next-line no-param-reassign
            options.position ??= 'bottom-right';
            // eslint-disable-next-line no-param-reassign
            options.isClosable ??= true;
            if (options.id !== undefined && toast.isActive(options.id)) {
                toast.update(options.id, options);
                return;
            }
            toast(options);
        },
        [toast]
    );

    const value = useMemoObject<AlertBox>({ sendAlert, forgetAlert, showAlert, sendToast });

    return (
        <AlertBoxContext.Provider value={value}>
            <AlertBoxDialog
                cancelRef={cancelRef}
                current={current}
                isOpen={isOpen}
                progressCurrent={done + 1}
                progressTotal={done + queue.length}
                onClose={onClose}
            />
            {children}
        </AlertBoxContext.Provider>
    );
});
