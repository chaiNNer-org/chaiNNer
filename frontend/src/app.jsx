import { ChakraProvider, ColorModeScript } from '@chakra-ui/react';
import React from 'react';
import {
  QueryClient,
  QueryClientProvider,
} from 'react-query';
// eslint-disable-next-line import/extensions
import './index.css';
// eslint-disable-next-line import/extensions
import Main from './pages/main.jsx';
import theme from './theme';

// Create a client
const queryClient = new QueryClient();

function App() {
  return (
    <ChakraProvider>
      <ColorModeScript initialColorMode={theme.config.initialColorMode} />
      <QueryClientProvider client={queryClient}>
        <Main />
      </QueryClientProvider>
    </ChakraProvider>
  );
}

export default App;
