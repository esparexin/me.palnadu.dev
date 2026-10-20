'use client';

import {useEffect, useMemo, useRef, useState, type FC} from 'react';
import Image from 'next/image';
import {ChevronDown} from 'lucide-react';
import {ButtonLink, Container} from '@me-palnadu/ui';

interface BlurTextProps {
  text: string;
  delay?: number;
  animateBy?: 'words' | 'letters';
  direction?: 'top' | 'bottom';
  className?: string;
}

export const BlurText: FC<BlurTextProps> = ({
  text,
  delay = 50,
  animateBy = 'words',
  direction = 'top',
  className = '',
}) => {
  const [inView, setInView] = useState(true);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    // Respect user's reduced-motion preference immediately (UI_UX_STANDARDS 2.4).
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
        }
      },
      {threshold: 0.1},
    );

    const current = ref.current;
    if (current) {
      observer.observe(current);
    }

    return () => {
      if (current) {
        observer.unobserve(current);
      }
    };
  }, []);

  const words = useMemo(() => text.split(' '), [text]);

  if (animateBy === 'words') {
    return (
      <span ref={ref} className={`inline-flex flex-wrap justify-center ${className}`}>
        {words.map((word, wordIndex) => (
          <span
            key={`${word}-${wordIndex}`}
            className={`inline-block whitespace-pre transition-all duration-base ease-out ${
              inView
                ? 'translate-y-0 opacity-100 blur-none'
                : direction === 'top'
                  ? '-translate-y-4 opacity-0 blur-sm'
                  : 'translate-y-4 opacity-0 blur-sm'
            }`}
            style={{transitionDelay: `${wordIndex * delay}ms`}}
          >
            {word}
            {wordIndex < words.length - 1 ? ' ' : null}
          </span>
        ))}
      </span>
    );
  }

  // Animate letter by letter with explicit word boundaries and clear inter-word spacing
  let globalCharIndex = 0;

  return (
    <span ref={ref} className={`inline-flex flex-wrap items-center justify-center ${className}`}>
      {words.map((word, wordIndex) => {
        const letters = word.split('');
        const wordOffset = globalCharIndex;
        globalCharIndex += letters.length + 1;

        return (
          <span
            key={`word-${word}-${wordIndex}`}
            className={`inline-flex items-center ${wordIndex > 0 ? 'ml-3 sm:ml-4 md:ml-6' : ''}`}
          >
            {wordIndex > 0 ? ' ' : null}
            {letters.map((char, charIndex) => {
              const letterIndex = wordOffset + charIndex;
              return (
                <span
                  key={`${char}-${letterIndex}`}
                  className={`inline-block transition-all duration-base ease-out ${
                    inView
                      ? 'translate-y-0 opacity-100 blur-none'
                      : direction === 'top'
                        ? '-translate-y-4 opacity-0 blur-sm'
                        : 'translate-y-4 opacity-0 blur-sm'
                  }`}
                  style={{transitionDelay: `${letterIndex * delay}ms`}}
                >
                  {char}
                </span>
              );
            })}
          </span>
        );
      })}
    </span>
  );
};

export interface PortfolioHeroProps {
  eyebrow?: string;
  firstName?: string;
  lastName?: string;
  tagline?: string;
  profileImageSrc?: string;
  profileImageAlt?: string;
  onScrollClick?: () => void;
}

export const PortfolioHero = ({
  eyebrow = 'About me',
  firstName = 'Kalyan V',
  lastName = 'Medaboina',
  tagline = 'Jamf, Microsoft Intune | Apple & Windows MDM Engineer | Senior System Administrator | Endpoint Management | Cybersecurity Engineer',
  profileImageSrc = '/profile.png',
  profileImageAlt = 'Portrait of Kalyan V Medaboina',
  onScrollClick,
}: PortfolioHeroProps) => {
  const handleScroll = () => {
    if (onScrollClick) {
      onScrollClick();
      return;
    }
    const target = document.getElementById('content-section');
    if (target) {
      target.scrollIntoView({behavior: 'smooth'});
    }
  };

  return (
    <section aria-labelledby="hero-title" className="bg-surface-inverse py-14 md:py-20 lg:py-24">
      <Container className="flex flex-col items-center gap-10 text-center md:gap-12">
        <p className="text-eyebrow font-semibold uppercase tracking-widest text-surface-muted">
          {eyebrow}
        </p>

        {/* The wordmark and portrait share one stage: the circular crop straddles
            both name lines, matching the reference composition. */}
        <div className="relative flex w-full flex-col items-center">
          <h1
            id="hero-title"
            aria-label="Kalyan V Medaboina"
            className="relative flex flex-col items-center text-hero font-black uppercase text-highlight"
          >
            <span className="block">
              <BlurText text={firstName} delay={60} animateBy="letters" direction="top" />
            </span>
            <span className="block">
              <BlurText text={lastName} delay={60} animateBy="letters" direction="top" />
            </span>
          </h1>

          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-32 w-20 shrink-0 overflow-hidden rounded-pill bg-surface-inverse ring-1 ring-surface-muted/20 sm:h-36 sm:w-24 md:h-48 md:w-32 lg:h-56 lg:w-40 xl:h-64 xl:w-48">
              <Image
                src={profileImageSrc}
                alt={profileImageAlt}
                width={480}
                height={720}
                priority
                className="h-full w-full object-cover object-top"
              />
            </div>
          </div>
        </div>

        <p className="max-w-measure text-balance text-lead text-surface-muted sm:text-h3">
          <BlurText text={tagline} delay={35} animateBy="words" direction="bottom" />
        </p>

        {/* Required Hero CTAs (UI_UX_STANDARDS 7.1) */}
        <div className="flex w-full max-w-measure flex-col items-stretch justify-center gap-4 sm:flex-row sm:items-center">
          <ButtonLink href="/resume" size="lg" className="w-full sm:w-auto">
            View Resume
          </ButtonLink>
          <ButtonLink
            href="/experience"
            size="lg"
            variant="secondary"
            className="group w-full border-surface-muted hover:bg-surface-muted sm:w-auto"
          >
            {/* The label owns its colour so the secondary variant's
                text-text-primary cannot win the cascade on the dark surface. */}
            <span className="text-text-inverse group-hover:text-text-primary">
              Explore Experience
            </span>
          </ButtonLink>
        </div>

        {/* Scroll Down Indicator */}
        <button
          type="button"
          onClick={handleScroll}
          className="group flex h-10 w-10 items-center justify-center rounded-pill text-surface-muted transition-colors hover:text-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          aria-label="Scroll to content"
        >
          <ChevronDown className="h-6 w-6 transition-transform group-hover:translate-y-0.5" />
        </button>
      </Container>
    </section>
  );
};

export default PortfolioHero;
