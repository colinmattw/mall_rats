import '@fontsource/bungee/400.css';
import '@fontsource/permanent-marker/400.css';
import '@fontsource/rubik/400.css';
import '@fontsource/rubik/600.css';
import '@fontsource/rubik/800.css';
import './styles/global.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';

// Canvas textures (store signs, banners) bake text, so wait for the bundled fonts first.
async function fontsReady(): Promise<void> {
  if (!('fonts' in document)) return;
  const loads = Promise.all([
    document.fonts.load('32px "Bungee"'),
    document.fonts.load('32px "Permanent Marker"'),
    document.fonts.load('16px "Rubik"'),
  ]);
  await Promise.race([loads, new Promise((r) => setTimeout(r, 2000))]);
}

void fontsReady().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
