import React, { useState, useEffect } from 'react';
import { fetchMain } from './api/main';

function App() {
  const [info, setInfo] = useState({});

  useEffect(async () => {
    const data = await fetchMain();
    setInfo(data);
  });

  return (
    <div>
      <h1>{JSON.stringify(info)}</h1>
    </div>
  );
}

export default App;
