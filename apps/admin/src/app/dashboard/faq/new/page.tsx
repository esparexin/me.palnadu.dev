import {FaqForm} from '../../../../components/dashboard/faq-form';
import {PageHeader} from '../../../../components/dashboard/ui';
import {createFaqAction} from '../../../../lib/content-actions';

export const metadata = {title: 'New FAQ entry'};

export default function NewFaqPage() {
  return (
    <>
      <PageHeader
        title="New FAQ entry"
        description="The answer is stored as Markdown and rendered through the same restricted parser as article bodies."
      />
      <FaqForm action={createFaqAction} submitLabel="Create draft" />
    </>
  );
}
