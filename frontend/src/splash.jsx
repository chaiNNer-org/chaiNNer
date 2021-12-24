import {
  Center,
  ChakraProvider, Flex, Spinner, Text,
} from '@chakra-ui/react';
import { ipcRenderer } from 'electron';
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
// eslint-disable-next-line import/extensions
import './global.css';

ReactDOM.render(<Splash />, document.getElementById('root'));

const Splash = () => {
  const [status, setStatus] = useState('Loading...');

  // Register event listeners
  useEffect(() => {
    ipcRenderer.on('checking-port', () => {
      setStatus('Checking for available port...');
    });

    ipcRenderer.on('checking-python', () => {
      setStatus('Checking system environment for valid Python...');
    });

    ipcRenderer.on('checking-deps', () => {
      setStatus('Checking dependencies...');
    });

    ipcRenderer.on('installing-deps', () => {
      setStatus('Installing dependencies...');
    });

    ipcRenderer.on('spawning-backend', () => {
      setStatus('Starting up backend process...');
    });

    ipcRenderer.on('splash-finish', () => {
      setStatus('Loading main application...');
    });
  }, []);

  return (
    <ChakraProvider bg="gray.700">
      <Center w="full" bg="gray.700" h="400px" color="white">
        <Flex w="full" flexDirection="column">
          <Center>
            <Spinner color="cyan.500" />
          </Center>
          <Center>
            <Text color="gray.500" isTruncated>
              {status}
            </Text>
          </Center>
        </Flex>
      </Center>
    </ChakraProvider>
  );
};

export default Splash;
