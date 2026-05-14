// Compatibility shim for `next/link`. Aliased in vite.config.ts.
//
// Wraps react-router-dom's Link so legacy components written against Next's
// API (which uses `href`) keep working without edits. Phase 4 will rewrite
// the components and delete this shim.
//
// Only `href` and child/className/style/onClick are forwarded — that is all
// the legacy components use today. Anything else (prefetch, scroll, replace)
// is accepted but ignored to avoid surprising the caller.

import type { ReactNode, MouseEvent } from 'react';
import { Link as RRLink } from 'react-router-dom';

type Props = {
  href: string;
  children?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
  target?: string;
  rel?: string;
  title?: string;
  // Accepted-and-ignored next/link props
  prefetch?: boolean;
  scroll?: boolean;
  replace?: boolean;
  shallow?: boolean;
  passHref?: boolean;
  legacyBehavior?: boolean;
};

export default function Link({
  href,
  children,
  className,
  style,
  onClick,
  target,
  rel,
  title,
}: Props) {
  return (
    <RRLink
      to={href}
      className={className}
      style={style}
      onClick={onClick}
      target={target}
      rel={rel}
      title={title}
    >
      {children}
    </RRLink>
  );
}
