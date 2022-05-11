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
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { createContext } from 'use-context-selector';
import { assertNever } from '../util';

interface AlertBox {
    showMessageBox: (newAlertType: AlertType, newTitle: string | null, newMessage: string) => void;
}

export enum AlertType {
    INFO = 'Info',
    WARN = 'Warning',
    ERROR = 'Error',
    CRIT_ERROR = 'Critical Error',
}

export const AlertBoxContext = createContext<Readonly<AlertBox>>({} as AlertBox);

// eslint-disable-next-line @typescript-eslint/ban-types
export const AlertBoxProvider = ({ children }: React.PropsWithChildren<{}>) => {
    const { isOpen, onOpen, onClose } = useDisclosure();
    const [alertType, setAlertType] = useState<AlertType>(AlertType.INFO);
    const [title, setTitle] = useState<string | null>(null);
    const [message, setMessage] = useState<string>('');
    const cancelRef = useRef<HTMLButtonElement>(null);

    const showMessageBox = useCallback(
        // eslint-disable-next-line @typescript-eslint/no-shadow
        (alertType: AlertType, title: string | null, message: string) => {
            setAlertType(alertType);
            setTitle(title ?? alertType);
            setMessage(message);
            onOpen();
        },
        [setAlertType, setTitle, setMessage, onOpen]
    );

    const getButtons = (type: AlertType): JSX.Element => {
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

    const buttons = useMemo(() => getButtons(alertType), [alertType, cancelRef, message, onClose]);

    const closeApp = () => {
        window.close();
        app.quit();
    };

    let value: AlertBox = { showMessageBox };
    value = useMemo(() => value, Object.values(value));

    return (
        <AlertBoxContext.Provider value={value}>
            <AlertDialog
                isCentered
                isOpen={isOpen}
                leastDestructiveRef={cancelRef}
                onClose={alertType === AlertType.CRIT_ERROR ? closeApp : onClose}
            >
                <AlertDialogOverlay />

                <AlertDialogContent>
                    <AlertDialogHeader>{title}</AlertDialogHeader>
                    <AlertDialogCloseButton />
                    <AlertDialogBody whiteSpace="pre-wrap">{message}</AlertDialogBody>
                    <AlertDialogFooter>
                        <HStack>{buttons}</HStack>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            {children}
        </AlertBoxContext.Provider>
    );
};
