import {permanentRedirect} from 'next/navigation';
import {WEB_ROUTES} from '@me-palnadu/contracts';

/**
 * The Knowledge Hub moved to a canonical route. Every external link to the old
 * path is redirected permanently rather than serving two copies of the same page.
 */
export default function Page(): never {
  permanentRedirect(WEB_ROUTES.knowledgeHub);
}
