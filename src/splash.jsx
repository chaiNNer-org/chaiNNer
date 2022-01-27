import {
  Center, ChakraProvider, Flex, Progress, Spinner, Text,
} from '@chakra-ui/react';
import { ipcRenderer } from 'electron';
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
// eslint-disable-next-line import/extensions
import './global.css';

const Splash = () => {
  const [status, setStatus] = useState('Loading...');
  const [progressPercentage, setProgressPercentage] = useState(0);
  const [showProgressBar, setShowProgressBar] = useState(false);

  // Register event listeners
  useEffect(() => {
    ipcRenderer.on('checking-port', () => {
      setShowProgressBar(false);
      setStatus('Checking for available port...');
    });

    ipcRenderer.on('checking-python', () => {
      setShowProgressBar(false);
      setStatus('Checking system environment for valid Python...');
    });

    ipcRenderer.on('checking-deps', () => {
      setShowProgressBar(false);
      setStatus('Checking dependencies...');
    });

    ipcRenderer.on('installing-deps', () => {
      setShowProgressBar(false);
      setStatus('Installing dependencies...');
    });

    ipcRenderer.on('spawning-backend', () => {
      setShowProgressBar(false);
      setStatus('Starting up backend process...');
    });

    ipcRenderer.on('splash-finish', () => {
      setShowProgressBar(false);
      setStatus('Loading main application...');
    });

    ipcRenderer.on('downloading-python', () => {
      setShowProgressBar(true);
      setStatus('Downloading Integrated Python...');
    });

    ipcRenderer.on('extracting-python', () => {
      setShowProgressBar(true);
      setStatus('Extracting downloaded files...');
    });

    ipcRenderer.on('installing-main-deps', () => {
      setShowProgressBar(true);
      setStatus('Installing required dependencies...');
    });

    ipcRenderer.on('progress', (event, percentage) => {
      setProgressPercentage(percentage);
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
          {showProgressBar && (
          <Center>
            <Progress m={5} w="350px" hasStripe value={progressPercentage} />
          </Center>
          )}
        </Flex>
      </Center>
    </ChakraProvider>
  );
};

ReactDOM.render(<Splash />, document.getElementById('root'));

export default Splash;
