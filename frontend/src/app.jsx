import { ChakraProvider, ColorModeScript } from '@chakra-ui/react';
import React from 'react';
// eslint-disable-next-line import/extensions
import './global.css';
// eslint-disable-next-line import/extensions
import Main from './pages/main.jsx';
import theme from './theme';

function App() {
  return (
    <ChakraProvider>
      <ColorModeScript initialColorMode={theme.config.initialColorMode} />
      <Main />
    </ChakraProvider>
  );
}

export default App;
