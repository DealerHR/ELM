import { useEffect, useState } from 'react';

/**
 * Tiny hash router: the address bar holds #/<view>[/<id>][?key=value].
 * - App keeps activeView in step with it, so Back/Forward and refresh work and
 *   links in emails or the work queue can open a specific record.
 * - Screens read the id through useRoute() and preselect that record.
 * - The candidate portal keeps its own #/assess route and is left alone here.
 */

export interface Route {
  view: string;
  id: string | null;
  params: Record<string, string>;
}

export function parseHash(hash: string = window.location.hash): Route {
  const raw = hash.replace(/^#\/?/, '');
  const [pathPart, query = ''] = raw.split('?');
  const [view = 'dashboard', id = null] = pathPart.split('/').filter(Boolean);
  const params: Record<string, string> = {};
  new URLSearchParams(query).forEach((v, k) => { params[k] = v; });
  return { view: view || 'dashboard', id, params };
}

export function hrefFor(view: string, id?: string | null, params?: Record<string, string>): string {
  const q = params && Object.keys(params).length ? '?' + new URLSearchParams(params).toString() : '';
  return `#/${view}${id ? `/${encodeURIComponent(id)}` : ''}${q}`;
}

/** Navigates by changing the hash; App hears the change and switches the view. */
export function navigate(view: string, id?: string | null, params?: Record<string, string>) {
  const next = hrefFor(view, id, params);
  if (window.location.hash === next) {
    // Same address: still tell listeners, so re-selecting the same record works.
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = next;
  }
}

/** Replaces the current address without adding a history entry (e.g. after consuming an id). */
export function replaceRoute(view: string, id?: string | null) {
  history.replaceState(null, '', hrefFor(view, id));
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash());
  useEffect(() => {
    const onChange = () => setRoute(parseHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
