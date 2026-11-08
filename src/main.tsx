import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './styles/demo-light.css';
import './styles/motion-smooth.css';
import './styles/demo-stage.css';

const DEMO_W = 1440;
const DEMO_H = 960;

function fitDemoStage() {
  const scale = Math.min(
    window.innerWidth / DEMO_W,
    window.innerHeight / DEMO_H,
  );
  document.documentElement.style.setProperty(
    '--demo-stage-scale',
    String(Number.isFinite(scale) && scale > 0 ? scale : 1),
  );
}

fitDemoStage();
window.addEventListener('resize', fitDemoStage);

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('未找到 #root 节点');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
