import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from 'react';

export type RouterLocation = {
  pathname: string;
  search: string;
  hash: string;
  state: unknown;
};

export type NavigateTo = string | {
  pathname?: string;
  search?: string;
  hash?: string;
};

export type NavigateOptions = {
  replace?: boolean;
  state?: unknown;
};

export type NavigateFunction = (
  destination: NavigateTo | number,
  options?: NavigateOptions,
) => void;

type RouterContextValue = {
  location: RouterLocation;
  navigate: NavigateFunction;
};

const RouterContext = createContext<RouterContextValue | null>(null);
const ParamsContext = createContext<Record<string, string>>({});

function readBrowserLocation(): RouterLocation {
  return {
    pathname: window.location.pathname || '/',
    search: window.location.search,
    hash: window.location.hash,
    state: window.history.state,
  };
}

function normalizeSearch(search = '') {
  if (!search) return '';
  return search.startsWith('?') ? search : `?${search}`;
}

function normalizeHash(hash = '') {
  if (!hash) return '';
  return hash.startsWith('#') ? hash : `#${hash}`;
}

export function destinationHref(destination: NavigateTo, current: RouterLocation) {
  if (typeof destination === 'string') return destination;
  return `${destination.pathname ?? current.pathname}${normalizeSearch(destination.search ?? current.search)}${normalizeHash(destination.hash ?? current.hash)}`;
}

export function BrowserRouter({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<RouterLocation>(readBrowserLocation);

  useEffect(() => {
    const handlePopState = () => setLocation(readBrowserLocation());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback<NavigateFunction>((destination, options = {}) => {
    if (typeof destination === 'number') {
      window.history.go(destination);
      return;
    }

    const current = readBrowserLocation();
    const href = destinationHref(destination, current);
    if (options.replace) {
      window.history.replaceState(options.state ?? null, '', href);
    } else {
      window.history.pushState(options.state ?? null, '', href);
    }
    setLocation(readBrowserLocation());
  }, []);

  const value = useMemo(() => ({ location, navigate }), [location, navigate]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

function useRouterContext() {
  const context = useContext(RouterContext);
  if (!context) throw new Error('Router hooks must be used inside BrowserRouter.');
  return context;
}

export function useLocation() {
  return useRouterContext().location;
}

export function useNavigate() {
  return useRouterContext().navigate;
}

export function RouteParamsProvider({
  params,
  children,
}: {
  params: Record<string, string>;
  children: ReactNode;
}) {
  return <ParamsContext.Provider value={params}>{children}</ParamsContext.Provider>;
}

export function useParams<TParams extends Record<string, string | undefined> = Record<string, string>>() {
  return useContext(ParamsContext) as TParams;
}

export function useSearchParams(): [URLSearchParams, (next: URLSearchParams, options?: NavigateOptions) => void] {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const setParams = useCallback((next: URLSearchParams, options?: NavigateOptions) => {
    navigate({ pathname: location.pathname, search: next.toString(), hash: location.hash }, options);
  }, [location.hash, location.pathname, navigate]);
  return [params, setParams];
}

export type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  to: NavigateTo;
  replace?: boolean;
  state?: unknown;
};

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { to, replace = false, state, onClick, target, ...props },
  ref,
) {
  const location = useLocation();
  const navigate = useNavigate();
  const href = destinationHref(to, location);

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey ||
      (target && target !== '_self')
    ) return;
    event.preventDefault();
    navigate(to, { replace, state });
  };

  return <a {...props} ref={ref} href={href} target={target} onClick={handleClick} />;
});

export const NavLink = Link;

export function Navigate({ to, replace = false, state }: { to: NavigateTo; replace?: boolean; state?: unknown }) {
  const navigate = useNavigate();
  useEffect(() => navigate(to, { replace, state }), [navigate, replace, state, to]);
  return null;
}

function normalizedSegments(path: string) {
  const normalized = path === '/' ? '/' : path.replace(/\/+$/, '');
  return normalized === '/' ? [] : normalized.split('/').filter(Boolean);
}

export function matchPath(pattern: string, pathname: string): Record<string, string> | null {
  const patternSegments = normalizedSegments(pattern);
  const pathSegments = normalizedSegments(pathname);
  const params: Record<string, string> = {};

  for (let index = 0; index < patternSegments.length; index += 1) {
    const expected = patternSegments[index];
    const actual = pathSegments[index];
    if (expected === '*') return params;
    if (actual === undefined) return null;
    if (expected.startsWith(':')) {
      try {
        params[expected.slice(1)] = decodeURIComponent(actual);
      } catch {
        return null;
      }
    } else if (expected !== actual) {
      return null;
    }
  }

  return patternSegments.length === pathSegments.length ? params : null;
}
