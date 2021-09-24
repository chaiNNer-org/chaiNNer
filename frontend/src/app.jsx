import React, { useEffect, useState } from 'react';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from 'react-query';
import { fetchNodes } from './api/nodes';

// Create a client
const queryClient = new QueryClient();

function App() {
  const [info, setInfo] = useState({});

  useEffect(async () => {
    const data = await fetchNodes();
    setInfo(data);
  });

  console.log(info);
  return (
    <QueryClientProvider client={queryClient}>
      <Testing />
    </QueryClientProvider>
  );
}

function Testing() {
  // Queries
  const {
    isLoading, isError, data, error,
  } = useQuery('nodes', fetchNodes);
  console.log(data);

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
        {data.map((node) => (
          <li key={node.category}>{node.category}</li>
        ))}
      </ul>
    </div>
  );
}

export default App;
