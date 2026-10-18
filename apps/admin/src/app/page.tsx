import {redirect} from 'next/navigation';

/**
 * Every dashboard route requires a session, so the root redirects to the sign-in
 * entry point. The redirect is a convenience only: the API decides authorization
 * on every operation regardless of what this route does (SECURITY.md section 2).
 */
export default function AdminRootPage() {
  redirect('/login');
}
