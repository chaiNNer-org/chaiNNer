import { ipcRenderer } from 'electron';
import React, { useState } from 'react';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from 'react-query';
import { fetchNodes } from './api/nodes';

// Create a client
const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Testing />
    </QueryClientProvider>
  );
}

function Testing() {
  // Queries
  const [backendReady, setBackendReady] = useState(false);
  const {
    isLoading, isError, data, error,
  } = useQuery('nodes', fetchNodes);
  if (data && !isLoading && !isError && !backendReady) {
    setBackendReady(true);
    ipcRenderer.send('backend-ready');
  }

  if (isLoading) {
    return <span>Loading...</span>;
  }

  if (isError) {
    return (
      <span>
        Error:
        {error.message}
      </span>
    );
  }

  return (
    <div>
      <ul>
        {data.map(({ category, nodes }) => (
          <>
            <li key={category}>{category}</li>
            <ul>
              {nodes.map((node) => (
                <li key={node.name}>{node.name}</li>
              ))}
            </ul>
          </>
        ))}
      </ul>
    </div>
  );
}

export default App;
