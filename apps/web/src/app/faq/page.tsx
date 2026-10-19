import type {Metadata} from 'next';
import {FAQ_CATEGORIES, WEB_ROUTES, type FaqCategory, type PublicFaq} from '@me-palnadu/contracts';
import {Prose, SectionHeading} from '@me-palnadu/ui';
import {Navigation} from '../../components/navigation';
import {listAllPublishedFaqs} from '../../lib/api';
import {humanize} from '../../lib/format';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'FAQ',
  description:
    'Answers to common questions about endpoint management, MDM, identity, security, and working with me.',
  alternates: {canonical: WEB_ROUTES.faq},
};

const groupByCategory = (items: readonly PublicFaq[]): Map<FaqCategory, PublicFaq[]> => {
  const groups = new Map<FaqCategory, PublicFaq[]>();
  for (const category of FAQ_CATEGORIES) {
    const inCategory = items.filter((item) => item.category === category);
    if (inCategory.length > 0) groups.set(category, inCategory);
  }
  return groups;
};

export default async function FaqPage() {
  const items = await listAllPublishedFaqs().catch(() => null);
  const groups = items === null ? null : groupByCategory(items);

  return (
    <>
      <Navigation />
      <main id="main-content">
        <section className="mx-auto max-w-page px-5 py-16 md:px-8 md:py-24">
          <SectionHeading
            as="h1"
            eyebrow="me.palnadu.dev"
            title="Frequently asked questions"
            description="Answers are written and reviewed by the site owner. If something is missing, the contact page is the way to ask."
          />

          {groups === null ? (
            <div
              role="status"
              className="mt-10 rounded-lg border border-border-subtle bg-surface-subtle p-8"
            >
              <p className="text-body text-text-secondary">
                The FAQ is temporarily unavailable. Please try again shortly.
              </p>
            </div>
          ) : groups.size === 0 ? (
            <p className="mt-10 text-body text-text-secondary">
              No questions have been published yet.
            </p>
          ) : (
            <div className="mt-12 flex flex-col gap-14">
              {[...groups.entries()].map(([category, entries]) => (
                <section
                  key={category}
                  aria-labelledby={`faq-${category}`}
                  className="flex flex-col gap-4"
                >
                  <h2 id={`faq-${category}`} className="text-h2 font-semibold text-text-primary">
                    {humanize(category)}
                  </h2>
                  <div className="flex flex-col divide-y divide-border-subtle border-y border-border-subtle">
                    {entries.map((entry) => (
                      <details key={entry.id} className="group py-5">
                        <summary className="cursor-pointer list-none text-body font-medium text-text-primary marker:hidden">
                          <span className="flex items-start justify-between gap-4">
                            <span>{entry.question}</span>
                            <span
                              aria-hidden="true"
                              className="text-text-tertiary group-open:rotate-45"
                            >
                              +
                            </span>
                          </span>
                        </summary>
                        <div className="mt-4">
                          <Prose source={entry.answer} />
                        </div>
                      </details>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
