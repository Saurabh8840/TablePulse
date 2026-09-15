import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { ThemedApp } from './components/ThemedApp.jsx';
import { ColorModeProvider } from './context/ColorModeProvider.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ColorModeProvider>
      <ThemedApp />
    </ColorModeProvider>
  </StrictMode>,
);
