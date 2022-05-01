import { Box, Center, ChakraProvider, ColorModeScript, Spinner } from '@chakra-ui/react';
import { LocalStorage } from 'node-localstorage';
import { useEffect, useState } from 'react';
import { ipcRenderer } from './helpers/safeIpc';
import './global.css';
import Main from './pages/main';
import theme from './theme';

const App = () => {
  const [port, setPort] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      setPort(await ipcRenderer.invoke('get-port'));
      const localStorageLocation = await ipcRenderer.invoke('get-localstorage-location');
      (global as Record<string, unknown>).customLocalStorage = new LocalStorage(
        localStorageLocation
      );
    })();
  }, []);

  let Component = () => <></>;

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
    Component = () => <Main port={port} />;
  }

  return (
    <ChakraProvider theme={theme}>
      <ColorModeScript initialColorMode={theme.config.initialColorMode} />
      <Component />
    </ChakraProvider>
  );
};

export default App;
