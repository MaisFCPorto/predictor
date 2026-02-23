'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AdminShopPage() {
  const router = useRouter();

  useEffect(() => {
    router.push('/shop');
  }, [router]);

  return null;
}
