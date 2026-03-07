import './index.css';
import { mountSettings } from './renderer/views/settings';

const views = { settings: mountSettings };

function mount() {
  const viewName = document.body.dataset.view || 'settings';
  const mountView = views[viewName];
  if (mountView && typeof window.printerAgent !== 'undefined') mountView();
}

mount();
