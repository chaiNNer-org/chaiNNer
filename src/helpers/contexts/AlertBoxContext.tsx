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
import React, { createContext, useRef, useState, useMemo } from 'react';
import { assertNever } from '../util';

interface AlertBox {
  showMessageBox: (_alertType: AlertType, _title: string | null, _message: string) => void;
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

  const showMessageBox = (_alertType: AlertType, _title: string | null, _message: string) => {
    setAlertType(_alertType);
    setTitle(_title ?? _alertType);
    setMessage(_message);
    onOpen();
  };

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

  return (
    <AlertBoxContext.Provider value={{ showMessageBox }}>
      <AlertDialog
        isCentered
        isOpen={isOpen}
        leastDestructiveRef={cancelRef}
        onClose={onClose}
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
