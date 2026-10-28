import { notFound } from 'next/navigation';
import { pageInfo } from '../../lib/seed';
import { WorkspaceShell } from '../../components/workspace-shell';
import { WorkspacePage } from '../../components/workspace-page';
import { AuthPage } from '../../components/auth-page';
import { FeaturesPage } from '../../components/marketing';
export async function generateStaticParams() {
  return [...Object.keys(pageInfo), 'login', 'register', 'features'].map((section) => ({
    section,
  }));
}
export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (section === 'login' || section === 'register')
    return <AuthPage register={section === 'register'} />;
  if (section === 'features') return <FeaturesPage />;
  if (!pageInfo[section]) notFound();
  return (
    <WorkspaceShell>
      <WorkspacePage section={section} />
    </WorkspaceShell>
  );
}
