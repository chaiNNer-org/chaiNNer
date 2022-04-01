import React from 'react';
import * as ReactDOMClient from 'react-dom/client';
// eslint-disable-next-line import/extensions
import App from './app.jsx';
import './global.css';

const container = document.getElementById('root');
const root = ReactDOMClient.createRoot(container);

root.render(<App />);
