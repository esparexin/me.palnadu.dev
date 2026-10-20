import {ArticleForm} from '../../../../components/dashboard/article-form';
import {PageHeader} from '../../../../components/dashboard/ui';
import {createArticleAction} from '../../../../lib/content-actions';

export const metadata = {title: 'New article'};

export default function NewArticlePage() {
  return (
    <>
      <PageHeader
        title="New article"
        description="Write the piece, then review it in the editor before publishing. New articles start as drafts."
      />
      <ArticleForm action={createArticleAction} submitLabel="Create draft" />
    </>
  );
}
