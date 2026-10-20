import {redirect} from 'next/navigation';
import {getAuthenticatedAdmin} from '../lib/session';

export default async function AdminRootPage() {
  const admin = await getAuthenticatedAdmin();
  if (admin !== null) {
    redirect('/dashboard');
  }
  redirect('/login');
}
