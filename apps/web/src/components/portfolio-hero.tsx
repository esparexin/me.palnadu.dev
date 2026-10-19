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

  const segments = useMemo(() => {
    return animateBy === 'words' ? text.split(' ') : text.split('');
  }, [text, animateBy]);

  return (
    <span ref={ref} className={`inline-flex flex-wrap justify-center ${className}`}>
      {segments.map((segment, index) => (
        <span
          key={`${segment}-${index}`}
          className={`inline-block transition-all duration-base ease-out ${
            inView
              ? 'translate-y-0 opacity-100 blur-none'
              : direction === 'top'
                ? '-translate-y-4 opacity-0 blur-sm'
                : 'translate-y-4 opacity-0 blur-sm'
          }`}
          style={{transitionDelay: `${index * delay}ms`}}
        >
          {segment}
          {animateBy === 'words' && index < segments.length - 1 ? '\u00A0' : ''}
        </span>
      ))}
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
  tagline = 'Jamf & Apple MDM Engineer | Senior System Administrator | Microsoft Intune',
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

        {/* Centerpiece: name first, portrait below, then role and actions. */}
        <h1
          id="hero-title"
          aria-label="Kalyan V Medaboina"
          className="flex flex-col items-center gap-3 text-display font-semibold"
        >
          <span className="block whitespace-nowrap text-accent">
            <BlurText text={firstName} delay={70} animateBy="letters" direction="top" />
          </span>
          <span className="block whitespace-nowrap text-text-primary">
            <BlurText text={lastName} delay={70} animateBy="letters" direction="top" />
          </span>
        </h1>

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

        <p className="max-w-measure text-balance text-lead text-text-secondary">{tagline}</p>

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
