'use client';

import Image from 'next/image';
import { useState } from 'react';

type ImageSize = 'lead' | 'card';
type ImageFit = 'contain' | 'scale-down';
type NewsImageProps = { src: string | null; className: string; size?: ImageSize };

function imageCandidates(src: string, size?: ImageSize) {
  if (!size) return [src];

  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return [src];
  }
  if (url.protocol !== 'https:' || url.port || url.username || url.password) return [src];

  if (url.hostname === 'cdn.record.pt' &&
      /^\/images\/\d{4}-\d{2}\/img_220x220uu[^/]+\.(?:jpe?g|png)$/i.test(url.pathname)) {
    const medium = new URL(url);
    medium.pathname = medium.pathname.replace('img_220x220uu', 'img_920x518uu');
    if (size === 'card') return [medium.href, src];

    url.pathname = url.pathname.replace('img_220x220uu', 'img_1280x720uu');
    return [url.href, medium.href, src];
  }

  const width = size === 'lead' ? 1200 : 640;
  if (url.hostname === 'img.iol.pt') {
    const match = /^\/image\/id\/[a-f0-9]{24}\/(\d+)$/i.exec(url.pathname);
    if (match && Number(match[1]) < width) {
      url.pathname = url.pathname.replace(/\d+$/, String(width));
      return [url.href, src];
    }
  }

  if (url.hostname === 'cdn-images.rtp.pt' && url.pathname.startsWith('/icm/noticias/images/')) {
    const originalWidth = url.searchParams.get('w');
    if (originalWidth && /^\d+$/.test(originalWidth) && Number(originalWidth) < width) {
      url.searchParams.set('w', String(width));
      url.searchParams.set('q', '80');
      return [url.href, src];
    }
  }

  return [src];
}

export function NewsImage({ src, className, size }: NewsImageProps) {
  return src ? <NewsPhoto key={`${src}:${size}`} src={src} className={className} size={size} /> : null;
}

function NewsPhoto({ src, className, size }: Omit<NewsImageProps, 'src'> & { src: string }) {
  const [attempt, setAttempt] = useState(0);
  const [fit, setFit] = useState<ImageFit>();
  const candidate = imageCandidates(src, size)[attempt];
  if (!candidate) return null;

  function tryNextImage() {
    setFit(undefined);
    setAttempt(attempt + 1);
  }

  return (
    <div className={className} data-fit={fit}>
      <Image
        key={candidate}
        alt=""
        src={candidate}
        fill
        unoptimized
        loading={size === 'lead' ? 'eager' : 'lazy'}
        fetchPriority={size === 'lead' ? 'high' : undefined}
        referrerPolicy="no-referrer"
        onError={tryNextImage}
        onLoad={({ currentTarget: { naturalWidth: width, naturalHeight: height } }) => {
          if (width <= 1 || height <= 1) {
            tryNextImage();
          } else if (size && (width < 360 || height < 200)) {
            setFit('scale-down');
          } else if (size && width / height < 1.4) {
            setFit('contain');
          }
        }}
      />
    </div>
  );
}
