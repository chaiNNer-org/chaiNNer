import {
  Center, ChakraProvider, Flex, Spinner, Text,
} from '@chakra-ui/react';
import React from 'react';
import ReactDOM from 'react-dom';
// eslint-disable-next-line import/extensions
import './splash.css';

ReactDOM.render(<Splash />, document.getElementById('root'));

function Splash() {
  return (
    <ChakraProvider bg="gray.700">
      <Center bg="gray.700" h="400px" color="white">
        <Flex flexDirection="column">
          <Center>
            <Spinner color="cyan.500" />
          </Center>
          <Center>
            <Text color="gray.500" isTruncated>
              Loading...
            </Text>
          </Center>
        </Flex>
      </Center>
    </ChakraProvider>
  );
}

export default Splash;
