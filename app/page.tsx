import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const PixelArtEditor = dynamic(() => import('@/components/PixelArtEditor'), {
  ssr: false,
});

const SubpixelEditor = dynamic(() => import('@/components/SubpixelEditor'), {
  ssr: false,
});

export default function Home() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">픽셀 아트 편집기</h1>
      <Suspense fallback={<div>로딩 중...</div>}>
        <PixelArtEditor />
      </Suspense>
      <h1 className="text-3xl font-bold my-8">서브픽셀 편집기</h1>
      <Suspense fallback={<div>로딩 중...</div>}>
        <SubpixelEditor />
      </Suspense>
    </div>
  );
}