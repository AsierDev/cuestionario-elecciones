import './styles/tokens.css';
import './styles/base.css';

import { mountApp } from './ui/app';

const container = document.querySelector<HTMLElement>('#app');

if (container) {
  mountApp(container);
}
