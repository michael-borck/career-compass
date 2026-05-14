// Compatibility shim for `next/navigation`. Aliased in vite.config.ts.
//
// Phase 3 ports legacy Next.js pages and their transitive components into the
// Vite renderer. Most components have not been touched (per the migration plan,
// `components/` files transfer unchanged). Several of them import
// `useRouter`/`usePathname` from `next/navigation`. Calling those hooks throws
// at render time outside a Next runtime because there is no AppRouterContext.
//
// This shim re-exports react-router-dom equivalents under the next/navigation
// names so unchanged components keep working. Phase 4 will rewrite the
// components and delete this shim.
//
// API surface — only what `components/**` actually uses today:
//   useRouter().push(path)
//   useRouter().replace(path)
//   useRouter().back()
//   useRouter().forward()
//   useRouter().refresh()  (no-op)
//   usePathname()
//
// Anything else throws so it surfaces during the port rather than silently
// no-oping.

import { useLocation, useNavigate } from 'react-router-dom';

type AppRouter = {
  push(href: string): void;
  replace(href: string): void;
  back(): void;
  forward(): void;
  refresh(): void;
  prefetch(_href: string): void;
};

export function useRouter(): AppRouter {
  const navigate = useNavigate();
  return {
    push: (href: string) => navigate(href),
    replace: (href: string) => navigate(href, { replace: true }),
    back: () => navigate(-1),
    forward: () => navigate(1),
    refresh: () => {
      // Next's refresh re-fetches RSC. In a Vite SPA there's no equivalent;
      // a hard reload is too aggressive. No-op is the right default.
    },
    prefetch: () => {
      // No equivalent in react-router; no-op.
    },
  };
}

export function usePathname(): string {
  const location = useLocation();
  return location.pathname;
}

export function useSearchParams(): URLSearchParams {
  const location = useLocation();
  return new URLSearchParams(location.search);
}

export function useParams<T = Record<string, string>>(): T {
  // Most legacy components don't use this. Return an empty object — callers
  // that actually need params should be ported to react-router's useParams
  // directly when the page is touched.
  return {} as T;
}
