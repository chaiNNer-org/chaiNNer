import {
  Box, Center, ChakraProvider, ColorModeScript, Spinner,
} from '@chakra-ui/react';
import { ipcRenderer } from 'electron';
import { useEffect, useState } from 'react';
// eslint-disable-next-line import/extensions
import './global.css';
// eslint-disable-next-line import/extensions
import Main from './pages/main.jsx';
import theme from './theme';

const App = () => {
  const [port, setPort] = useState(null);

  useEffect(() => {
    (async () => {
      setPort(await ipcRenderer.invoke('get-port'));
    })();
  }, []);

  let Component = () => (<></>);

  if (!port) {
    Component = () => (
      <Box
        h="full"
        w="full"
      >
        <Center
          h="full"
          w="full"
        >
          <Spinner />
        </Center>
      </Box>
    );
  } else {
    Component = () => (<Main port={port} />);
  }

  return (
    <ChakraProvider theme={theme}>
      <ColorModeScript initialColorMode={theme.config.initialColorMode} />
      <Component />
    </ChakraProvider>
  );
};

export default App;
