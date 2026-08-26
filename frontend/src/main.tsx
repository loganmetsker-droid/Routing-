import ReactDOM from 'react-dom/client';
import './styles/index.css';

const publicMarketingPaths = new Set([
  '/',
  '/platform',
  '/platform/plan',
  '/platform/dispatch',
  '/platform/drive',
  '/platform/track',
  '/platform/proof',
  '/demo',
  '/pricing',
  '/testimonials',
  '/security',
  '/accessibility',
  '/resources',
  '/resources/downloads',
  '/support',
  '/company',
  '/mission',
  '/careers',
  '/legal/privacy',
  '/legal/terms',
  '/legal/cookies',
  '/legal/exercise-rights',
]);

function normalizedPathname(pathname: string) {
  return pathname !== '/' && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

async function bootstrap() {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Trovan root element is missing.');
  }

  const pathname = normalizedPathname(window.location.pathname);
  const Root = publicMarketingPaths.has(pathname)
    ? (await import('./PublicRoot')).PublicRoot
    : (await import('./ApplicationRoot')).ApplicationRoot;

  ReactDOM.createRoot(rootElement).render(<Root />);
}

void bootstrap();
