'use client';
import { useParams } from 'next/navigation';
import QROrderPage from '@/components/pos/QROrderPage';

export default function QRMenuPage() {
  const { tableId } = useParams<{ tableId: string }>();
  return <QROrderPage qrCodeId={tableId} />;
}
