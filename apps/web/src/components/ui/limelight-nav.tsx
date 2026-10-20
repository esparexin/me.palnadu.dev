'use client';

import {useEffect, useRef, useState, type FocusEvent} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {NAV_ITEMS} from '../../lib/navigation';

const activeIndexFor = (pathname: string) =>
  NAV_ITEMS.findIndex(({href}) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`),
  );

/**
 * Desktop limelight navigation.
 *
 * Adapts the 21st.dev Limelight Nav to the existing text routes: a single
 * spotlight beam slides to the hovered or focused item and returns to the
 * active route when the pointer or focus leaves. The links are the same
 * `NAV_ITEMS` consumed by the mobile floating menu, so order and destinations
 * cannot drift (UI_UX_STANDARDS 7.2, WCAG 3.2.3).
 */
export const LimelightNav = () => {
  const pathname = usePathname();
  const activeIndex = activeIndexFor(pathname);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const spotlightIndex = hoveredIndex ?? activeIndex;
  const listRef = useRef<HTMLUListElement>(null);
  const linkRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const [beam, setBeam] = useState<{left: number; width: number} | null>(null);

  useEffect(() => {
    setHoveredIndex(null);
  }, [pathname]);

  useEffect(() => {
    if (spotlightIndex < 0) {
      setBeam(null);
      return;
    }

    const measure = () => {
      const list = listRef.current;
      const link = linkRefs.current[spotlightIndex];
      if (!list || !link) return;
      const listBox = list.getBoundingClientRect();
      const linkBox = link.getBoundingClientRect();
      setBeam({
        left: linkBox.left - listBox.left - list.clientLeft,
        width: linkBox.width,
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    if (listRef.current) observer.observe(listRef.current);
    return () => observer.disconnect();
  }, [spotlightIndex]);

  const handleBlur = (event: FocusEvent<HTMLUListElement>) => {
    const next = event.relatedTarget;
    if (!(next instanceof Node) || !event.currentTarget.contains(next)) {
      setHoveredIndex(null);
    }
  };

  return (
    <ul
      ref={listRef}
      onPointerLeave={() => setHoveredIndex(null)}
      onBlur={handleBlur}
      className="relative hidden items-center gap-1 rounded-pill border border-border-default bg-surface-inverse p-1 lg:flex"
    >
      {beam ? (
        <span
          aria-hidden="true"
          data-testid="limelight-beam"
          data-spotlight-index={spotlightIndex}
          className="pointer-events-none absolute inset-y-0 left-0 z-0 overflow-hidden rounded-pill transition-all duration-slow ease-out"
          style={{transform: `translateX(${beam.left}px)`, width: beam.width}}
        >
          <span className="absolute left-1/2 top-0 h-1 w-10 -translate-x-1/2 rounded-pill bg-accent" />
          <span className="limelight-cone absolute inset-0 bg-linear-to-b from-accent/40 via-accent/15 to-transparent blur-sm" />
        </span>
      ) : null}

      {NAV_ITEMS.map(({href, label, icon: Icon}, itemIndex) => {
        const isActive = itemIndex === activeIndex;
        return (
          <li key={href}>
            <Link
              ref={(node) => {
                linkRefs.current[itemIndex] = node;
              }}
              href={href}
              aria-current={isActive ? 'page' : undefined}
              onFocus={() => setHoveredIndex(itemIndex)}
              onPointerEnter={() => setHoveredIndex(itemIndex)}
              className={`relative z-10 flex min-h-10 items-center gap-2 rounded-pill px-3 text-body-sm transition-colors duration-fast focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                isActive || spotlightIndex === itemIndex
                  ? 'text-text-inverse'
                  : 'text-surface-muted'
              }`}
            >
              <Icon aria-hidden="true" className="h-4 w-4" />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
};
