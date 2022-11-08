import {
    AlertDialog,
    AlertDialogBody,
    AlertDialogCloseButton,
    AlertDialogContent,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogOverlay,
    Button,
    HStack,
    UseToastOptions,
    useDisclosure,
    useToast,
} from '@chakra-ui/react';
import { app, clipboard, shell } from 'electron';
import log from 'electron-log';
import path from 'path';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createContext, useContext } from 'use-context-selector';
import { ipcRenderer } from '../../common/safeIpc';
import { assertNever, noop } from '../../common/util';
import { useMemoObject } from '../hooks/useMemo';
import { ContextMenuContext } from './ContextMenuContext';

interface AlertBox {
    sendToast: (options: UseToastOptions) => void;
    sendAlert: ((alertType: AlertType, title: string | null, message: string) => void) &
        ((message: AlertOptions) => void);
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
    /** Whether to show a "Copy to Clipboard" button. */
    copyToClipboard?: boolean;
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
    title: string;
    resolve: (button: number) => void;
}

const EMPTY_MESSAGE: InternalMessage = {
    type: AlertType.INFO,
    title: '',
    message: '',
    resolve: noop,
};

const ALERT_FOCUS_ID = 'alert-focus-button';

const getButtons = (
    { type, message, copyToClipboard, buttons, defaultId = 0, cancelId }: InternalMessage,
    onClose: (button: number) => void,
    cancelRef: React.Ref<HTMLButtonElement>,
    focusId: string
): JSX.Element => {
    const buttonElements: JSX.Element[] = [];

    // eslint-disable-next-line no-param-reassign
    copyToClipboard ??= type === AlertType.ERROR;
    if (copyToClipboard) {
        buttonElements.push(
            <Button
                key="copy-to-clipboard"
                onClick={() => clipboard.writeText(message)}
            >
                Copy to Clipboard
            </Button>
        );
    }

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
                            app.quit();
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

export const AlertBoxContext = createContext<Readonly<AlertBox>>({} as AlertBox);

export const AlertBoxProvider = memo(({ children }: React.PropsWithChildren<unknown>) => {
    const { closeContextMenu } = useContext(ContextMenuContext);

    const [queue, setQueue] = useState<readonly InternalMessage[]>([]);
    const current = queue[0] as InternalMessage | undefined;
    const isLast = queue.length < 2;

    const push = useCallback(
        (message: InternalMessage) => setQueue((q) => [...q, message]),
        [setQueue]
    );
    const showAlert = useCallback(
        (message: AlertOptions) => {
            closeContextMenu();
            return new Promise<number>((resolve) => {
                push({ ...message, title: message.title ?? message.type, resolve });
            });
        },
        [push, closeContextMenu]
    );
    const sendAlert = useCallback<AlertBox['sendAlert']>(
        (type: AlertType | AlertOptions, title?: string | null, message?: string) => {
            if (typeof type === 'object') {
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                showAlert(type);
            } else {
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                showAlert({ type, title: title ?? undefined, message: message! });
            }
        },
        [showAlert]
    );

    const { isOpen, onOpen, onClose: onDisclosureClose } = useDisclosure();
    const cancelRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (current && !isOpen) {
            ipcRenderer.send('disable-menu');
            onOpen();
        }
    }, [current, isOpen, onOpen]);

    const onClose = useCallback(
        (button: number) => {
            current?.resolve(button);
            setQueue((q) => q.slice(1));
            if (isLast) {
                onDisclosureClose();
                ipcRenderer.send('enable-menu');
            }
        },
        [current, isLast, setQueue, onDisclosureClose]
    );

    const buttons = useMemo(() => {
        return getButtons(current ?? EMPTY_MESSAGE, onClose, cancelRef, ALERT_FOCUS_ID);
    }, [current, onClose]);

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

    const value = useMemoObject<AlertBox>({ sendAlert, showAlert, sendToast });

    useEffect(() => {
        const timerId = setTimeout(() => {
            if (isOpen) {
                document.querySelector<HTMLElement>(`#${ALERT_FOCUS_ID}`)?.focus();
            }
        }, 50);
        return () => clearTimeout(timerId);
    }, [isOpen, buttons]);

    return (
        <AlertBoxContext.Provider value={value}>
            <AlertDialog
                isCentered
                isOpen={isOpen}
                leastDestructiveRef={cancelRef}
                scrollBehavior="inside"
                onClose={() => cancelRef.current?.click()}
            >
                <AlertDialogOverlay />

                <AlertDialogContent>
                    <AlertDialogHeader>{current?.title}</AlertDialogHeader>
                    <AlertDialogCloseButton />
                    <AlertDialogBody whiteSpace="pre-wrap">{current?.message}</AlertDialogBody>
                    <AlertDialogFooter>
                        <HStack>{buttons}</HStack>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            {children}
        </AlertBoxContext.Provider>
    );
});
