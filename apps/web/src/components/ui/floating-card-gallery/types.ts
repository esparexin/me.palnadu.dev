import type {Difficulty} from '@me-palnadu/contracts';

export interface FloatingGalleryCard {
  id: string;
  slug: string;
  title: string;
  description: string;
  fullDescription?: string | undefined;
  image?: string | undefined;
  avatar?: string | undefined;
  author?: string | undefined;
  category?: string | undefined;
  kind?: string | undefined;
  difficulty?: Difficulty | undefined;
  readingTimeMinutes?: number | undefined;
  publishedAt?: string | undefined;
  tags?: readonly string[] | undefined;
  href?: string | undefined;
}

export interface FloatingCardGalleryProps {
  cards?: FloatingGalleryCard[] | undefined;
  backgroundColor?: string | undefined;
  accentColor?: string | undefined;
  maxCards?: number | undefined;
  className?: string | undefined;
}
