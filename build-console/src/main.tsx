import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app.tsx';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('构建控制台根节点缺失');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
