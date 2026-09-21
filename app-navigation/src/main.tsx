import { createRoot } from 'react-dom/client';
import { App } from './App';
import styles from './styles.css?inline';

const hostId = 'perception-app-navigation';

function mount() {
  if (document.getElementById(hostId)) return;

  const host = document.createElement('div');
  host.id = hostId;
  host.setAttribute('data-perception-navigation', '');
  const shadowRoot = host.attachShadow({ mode: 'open' });
  const stylesheet = document.createElement('style');
  stylesheet.textContent = styles;
  const root = document.createElement('div');
  shadowRoot.append(stylesheet, root);
  document.body.prepend(host);
  createRoot(root).render(<App host={host} />);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount, { once: true });
} else {
  mount();
}
