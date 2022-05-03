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
import React, { createContext, useEffect, useRef, useState } from 'react';

interface AlertBox {
  showMessageBox: unknown;
}

export enum AlertType {
  INFO = 'Info',
  WARN = 'Warning',
  ERROR = 'Error',
  CRIT_ERROR = 'Critical Error',
}

type Props = {
  children: JSX.Element;
};

export const AlertBoxContext = createContext<Readonly<AlertBox>>({} as AlertBox);

export const AlertBoxProvider = ({ children }: Props) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [alertType, setAlertType] = useState<AlertType>(AlertType.INFO);
  const [title, setTitle] = useState<string | null>();
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
        return <></>;
    }
  };

  const [buttons, setButtons] = useState<JSX.Element>(<></>);
  useEffect(() => {
    setButtons(getButtons(alertType));
  }, [alertType]);

  return (
    <>
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
      </AlertBoxContext.Provider>
      {children}
    </>
  );
};
