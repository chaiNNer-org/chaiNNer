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
    useDisclosure,
} from '@chakra-ui/react';
import { app, clipboard } from 'electron';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createContext } from 'use-context-selector';
import { assertNever, noop } from '../util';

interface AlertBox {
    sendAlert: (alertType: AlertType, title: string | null, message: string) => void;
    showAlert: (message: AlertOptions) => Promise<void>;
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
}

interface InternalMessage extends AlertOptions {
    title: string;
    resolve: () => void;
}

const EMPTY_MESSAGE: InternalMessage = {
    type: AlertType.INFO,
    title: '',
    message: '',
    resolve: noop,
};

const getButtons = (
    type: AlertType,
    onClose: () => void,
    message: string,
    cancelRef: React.Ref<HTMLButtonElement>
): JSX.Element => {
    switch (type) {
        case AlertType.INFO:
            return (
                <Button
                    ref={cancelRef}
                    onClick={onClose}
                >
                    OK
                </Button>
            );
        case AlertType.WARN:
            return (
                <Button
                    ref={cancelRef}
                    onClick={onClose}
                >
                    OK
                </Button>
            );
        case AlertType.ERROR:
            return (
                <>
                    <Button
                        onClick={() => {
                            clipboard.writeText(message);
                        }}
                    >
                        Copy to Clipboard
                    </Button>
                    <Button
                        ref={cancelRef}
                        onClick={onClose}
                    >
                        OK
                    </Button>
                </>
            );
        case AlertType.CRIT_ERROR:
            return (
                <Button
                    colorScheme="red"
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
        default:
            return assertNever(type);
    }
};

export const AlertBoxContext = createContext<Readonly<AlertBox>>({} as AlertBox);

export const AlertBoxProvider = ({ children }: React.PropsWithChildren<unknown>) => {
    const [queue, setQueue] = useState<readonly InternalMessage[]>([]);
    const current = queue[0] as InternalMessage | undefined;
    const isLast = queue.length < 2;

    const push = useCallback(
        (message: InternalMessage) => setQueue((q) => [...q, message]),
        [setQueue]
    );
    const showAlert = useCallback(
        (message: AlertOptions): Promise<void> => {
            return new Promise<void>((resolve) => {
                push({ ...message, title: message.title ?? message.type, resolve });
            });
        },
        [push]
    );
    const sendAlert = useCallback(
        (type: AlertType, title: string | null, message: string) => {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            showAlert({ type, title: title ?? undefined, message });
        },
        [showAlert]
    );

    const { isOpen, onOpen, onClose: onDisclosureClose } = useDisclosure();
    const cancelRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (current && !isOpen) {
            onOpen();
        }
    }, [current, isOpen, onOpen]);

    const onClose = useCallback(() => {
        current?.resolve();
        setQueue((q) => q.slice(1));
        if (isLast) onDisclosureClose();
    }, [current, isLast, setQueue, onDisclosureClose]);

    const buttons = useMemo(() => {
        const { type, message } = current ?? EMPTY_MESSAGE;
        return getButtons(type, onClose, message, cancelRef);
    }, [current, cancelRef, onClose]);

    let value: AlertBox = { sendAlert, showAlert };
    value = useMemo(() => value, Object.values(value));

    return (
        <AlertBoxContext.Provider value={value}>
            <AlertDialog
                isCentered
                isOpen={isOpen}
                leastDestructiveRef={cancelRef}
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
};
