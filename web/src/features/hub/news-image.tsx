'use client';

import Image from 'next/image';
import { useState } from 'react';

export function NewsImage({ src, className }: { src: string | null; className: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || src === failed) return null;

  return (
    <div className={className}>
      <Image
        alt=""
        src={src}
        fill
        unoptimized
        referrerPolicy="no-referrer"
        onError={() => setFailed(src)}
      />
    </div>
  );
}
