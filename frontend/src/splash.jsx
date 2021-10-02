import {
  Center, ChakraProvider, Flex, Spinner, Text,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  CloseButton,
} from '@chakra-ui/react';
import React from 'react';
import ReactDOM from 'react-dom';
// eslint-disable-next-line import/extensions
import './splash.css';

ReactDOM.render(<Splash />, document.getElementById('root'));

function Splash() {
  let inner = (
    <>
      <Center>
        <Spinner color="cyan.500" />
      </Center>
      <Center>
        <Text color="gray.500" isTruncated>
          Loading...
        </Text>
      </Center>
    </>
  );
  setTimeout(() => {
    inner = (
      <>
        <Center>
          <Alert status="error">
            <AlertIcon />
            <AlertTitle mr={2}>Error establishing connection to internal backend</AlertTitle>
            <AlertDescription>
              chaiNNer cannot function without its backend connection.
              Ensure nothing is running on port 3000.
            </AlertDescription>
            <CloseButton position="absolute" right="8px" top="8px" />
          </Alert>
        </Center>
      </>
    );
  }, 1000);

  return (
    <ChakraProvider bg="gray.700">
      <Center bg="gray.700" h="400px" color="white">
        <Flex flexDirection="column">
          {inner}
        </Flex>
      </Center>
    </ChakraProvider>
  );
}

export default Splash;
