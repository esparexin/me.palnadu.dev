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
  const [inView, setInView] = useState(false);
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
            className={`inline-block transition-all duration-base ease-out ${
              wordIndex > 0 ? 'ml-3 sm:ml-4 md:ml-6' : ''
            } ${
              inView
                ? 'translate-y-0 opacity-100 blur-none'
                : direction === 'top'
                  ? '-translate-y-4 opacity-0 blur-sm'
                  : 'translate-y-4 opacity-0 blur-sm'
            }`}
            style={{transitionDelay: `${wordIndex * delay}ms`}}
          >
            {word}
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
    <section aria-labelledby="hero-title" className="py-12 md:py-20">
      <Container className="flex flex-col items-center gap-8 text-center md:gap-10">
        {/* Eyebrow */}
        <p className="text-eyebrow font-semibold uppercase tracking-widest text-accent-text">
          {eyebrow}
        </p>

        {/* Centerpiece: full name in prominent oversized typography with blue & black colors */}
        <h1
          id="hero-title"
          aria-label="Kalyan V Medaboina"
          className="flex flex-col items-center gap-1 sm:gap-2 md:gap-3 text-display sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl font-bold tracking-tight leading-none"
        >
          <span className="block text-accent">
            <BlurText text={firstName} delay={70} animateBy="letters" direction="top" />
          </span>
          <span className="block text-text-primary">
            <BlurText text={lastName} delay={70} animateBy="letters" direction="top" />
          </span>
        </h1>

        {/* Portrait container with rounded-pill framing */}
        <div className="relative h-40 w-32 shrink-0 overflow-hidden rounded-pill border border-border-default bg-surface-subtle shadow-md sm:h-48 sm:w-40 md:h-56 md:w-40 lg:h-64 lg:w-48">
          <Image
            src={profileImageSrc}
            alt={profileImageAlt}
            width={480}
            height={720}
            priority
            className="h-full w-full object-cover"
          />
        </div>

        {/* Professional Title with clean, responsive typography and balanced line wrapping */}
        <p className="max-w-measure text-balance text-body sm:text-lead text-text-secondary leading-relaxed">
          {tagline}
        </p>

        {/* Required Hero CTAs (UI_UX_STANDARDS 7.1) */}
        <div className="flex w-full max-w-measure flex-col items-stretch justify-center gap-4 sm:flex-row sm:items-center">
          <ButtonLink href="/resume" size="lg" className="w-full sm:w-auto">
            View Resume
          </ButtonLink>
          <ButtonLink href="/experience" size="lg" variant="secondary" className="w-full sm:w-auto">
            Explore Experience
          </ButtonLink>
        </div>

        {/* Scroll Down Indicator */}
        <button
          type="button"
          onClick={handleScroll}
          className="group flex h-10 w-10 items-center justify-center rounded-pill text-text-tertiary transition-colors hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          aria-label="Scroll to content"
        >
          <ChevronDown className="h-6 w-6 transition-transform group-hover:translate-y-0.5" />
        </button>
      </Container>
    </section>
  );
};

export default PortfolioHero;
