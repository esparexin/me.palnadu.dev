'use client';

import {useEffect, useRef, useState} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {NAV_ITEMS} from '../lib/navigation';

const PANEL_ID = 'floating-nav-panel';
const FOCUSABLE = 'a[href], button:not([disabled])';

/**
 * Floating navigation menu (UI_UX_STANDARDS 7.2).
 *
 * Replaces the header menu below lg, where the header list is hidden. It is
 * non-modal on purpose: no backdrop, no scroll lock, no aria-modal, and Tab
 * escapes only by closing the menu. The panel closes on Escape, on a pointer
 * press outside, on a route change, and on the visible close control; closing
 * always returns focus to the trigger. Opening moves focus to the first
 * navigation item. The trigger is hidden while a focused element sits under
 * it (WCAG 2.4.11).
 */
export const FloatingMenu = () => {
  const [open, setOpen] = useState(false);
  const [obscured, setObscured] = useState(false);
  const pathname = usePathname();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const firstItemRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const trigger = triggerRef.current;
    const panel = panelRef.current;
    firstItemRef.current?.focus();

    const close = () => setOpen(false);
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panel?.contains(target) || trigger?.contains(target)) return;
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab') return;
      if (!panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      const first = focusable.at(0);
      const last = focusable.at(-1);
      if (!first || !last) return;
      const active = document.activeElement;
      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      }
    };
    const desktop = window.matchMedia('(min-width: 64rem)');
    const onDesktopChange = () => {
      if (desktop.matches) close();
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    desktop.addEventListener('change', onDesktopChange);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      desktop.removeEventListener('change', onDesktopChange);
      trigger?.focus();
    };
  }, [open]);

  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      const trigger = triggerRef.current;
      if (!(target instanceof HTMLElement) || !trigger) return;
      // The trigger focusing itself (a pointer press focuses a button) or focus
      // inside the open panel must not hide the trigger.
      if (target === trigger || trigger.contains(target) || target.contains(trigger)) return;
      if (panelRef.current?.contains(target)) return;
      const focused = target.getBoundingClientRect();
      const box = trigger.getBoundingClientRect();
      setObscured(
        focused.right > box.left &&
          focused.left < box.right &&
          focused.bottom > box.top &&
          focused.top < box.bottom,
      );
    };
    const onFocusOut = () => setObscured(false);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={PANEL_ID}
        aria-label="Open navigation menu"
        onClick={() => setOpen((value) => !value)}
        className={`fixed right-4 top-1/2 z-fab flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-border-default bg-surface text-accent shadow-md hover:bg-surface-subtle lg:hidden ${
          obscured ? 'hidden' : ''
        }`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      {open ? (
        <div
          ref={panelRef}
          id={PANEL_ID}
          role="dialog"
          aria-label="Site navigation"
          className="animate-fab-panel-in fixed right-20 top-1/2 z-fab-panel w-56 origin-bottom-right -translate-y-1/2 rounded-xl border border-border-default bg-surface p-3 shadow-lg"
        >
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setOpen(false)}
            className="ml-auto flex h-10 w-10 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-subtle hover:text-text-primary"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          <nav aria-label="Floating">
            <ul className="mt-1 flex flex-col">
              {NAV_ITEMS.map((item, index) => (
                <li key={item.href}>
                  <Link
                    ref={index === 0 ? firstItemRef : undefined}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-lg px-3 py-2.5 text-body-sm text-text-primary hover:bg-surface-subtle"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      ) : null}
    </>
  );
};
