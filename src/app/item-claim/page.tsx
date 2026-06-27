import MobileItemClaims from '@/components/mobile/MobileItemClaims';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function ItemClaimPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-3 py-4">
      <div className="mx-auto max-w-md">
        <MobileItemClaims canManage={false} standaloneRequest />
      </div>
    </main>
  );
}
