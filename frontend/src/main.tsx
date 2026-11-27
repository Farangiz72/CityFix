import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AuthProvider } from './auth/AuthContext';
// Токены идут первыми: index.css только использует их переменные (BL-T5)
import './styles/tokens.css';
import './styles/index.css';
import './styles/landing.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Не найден #root / #root element is missing');
}

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
