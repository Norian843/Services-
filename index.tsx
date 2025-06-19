
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { HashRouter } from 'react-router-dom';
import { NhostProvider } from '@nhost/react';
import { nhost } from './src/nhostConfig'; // Import the initialized Nhost client

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <NhostProvider nhost={nhost}>
      <HashRouter>
        <App />
      </HashRouter>
    </NhostProvider>
  </React.StrictMode>
);