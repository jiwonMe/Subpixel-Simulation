'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import p5 from 'p5';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

const CANVAS_SIZE = 400;
const DEFAULT_GRID_SIZE = 16;

const SubpixelEditor: React.FC = () => {
  const editorRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [gridSize, setGridSize] = useState(DEFAULT_GRID_SIZE);
  const [subpixels, setSubpixels] = useState<number[][][]>([]);
  const subpixelsRef = useRef<number[][][]>([]);

  useEffect(() => {
    initializeSubpixels();
  }, [gridSize]);

  useEffect(() => {
    subpixelsRef.current = subpixels;
  }, [subpixels]);

  const initializeSubpixels = useCallback(() => {
    const newSubpixels = Array(gridSize).fill(null).map(() => 
      Array(gridSize).fill(null).map(() => [0, 0, 0])
    );
    setSubpixels(newSubpixels);
    subpixelsRef.current = newSubpixels;
  }, [gridSize]);

  useEffect(() => {
    let editorSketch: p5;
    let previewSketch: p5;

    if (editorRef.current && previewRef.current) {
      editorSketch = new p5((p: p5) => {
        p.setup = () => {
          p.createCanvas(CANVAS_SIZE, CANVAS_SIZE);
          p.noSmooth();
        };

        p.draw = () => {
          p.background(0);
          const pixelSize = CANVAS_SIZE / gridSize;
          const subPixelSize = pixelSize / 3;

          subpixelsRef.current.forEach((row, y) => {
            row.forEach((pixel, x) => {
              p.noStroke();
              p.fill(pixel[0], 0, 0);
              p.rect(x * pixelSize, y * pixelSize, subPixelSize, pixelSize);
              p.fill(0, pixel[1], 0);
              p.rect(x * pixelSize + subPixelSize, y * pixelSize, subPixelSize, pixelSize);
              p.fill(0, 0, pixel[2]);
              p.rect(x * pixelSize + 2 * subPixelSize, y * pixelSize, subPixelSize, pixelSize);
            });
          });

          // Draw grid
          p.stroke(100);
          for (let i = 0; i <= gridSize; i++) {
            p.line(i * pixelSize, 0, i * pixelSize, CANVAS_SIZE);
            p.line(0, i * pixelSize, CANVAS_SIZE, i * pixelSize);
          }
        };

        p.mousePressed = () => updateSubpixel(p);
        p.mouseDragged = () => updateSubpixel(p);

        const updateSubpixel = (p: p5) => {
          const pixelSize = CANVAS_SIZE / gridSize;
          const subPixelSize = pixelSize / 3;
          const x = Math.floor(p.mouseX / pixelSize);
          const y = Math.floor(p.mouseY / pixelSize);
          const subPixelIndex = Math.floor((p.mouseX % pixelSize) / subPixelSize);

          if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
            const newSubpixels = subpixelsRef.current.map(row => row.map(pixel => [...pixel]));
            newSubpixels[y][x][subPixelIndex] = 255;
            setSubpixels(newSubpixels);
            subpixelsRef.current = newSubpixels;
          }
        };
      }, editorRef.current);

      previewSketch = new p5((p: p5) => {
        p.setup = () => {
          p.createCanvas(CANVAS_SIZE, CANVAS_SIZE);
          p.noSmooth();
        };

        p.draw = () => {
          p.background(255);
          const pixelSize = CANVAS_SIZE / gridSize;

          subpixelsRef.current.forEach((row, y) => {
            row.forEach((pixel, x) => {
              const r = pixel[0];
              const g = pixel[1];
              const b = pixel[2];
              p.noStroke();
              p.fill(r, g, b);
              p.rect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
            });
          });

          // Draw grid
          p.stroke(200);
          for (let i = 0; i <= gridSize; i++) {
            p.line(i * pixelSize, 0, i * pixelSize, CANVAS_SIZE);
            p.line(0, i * pixelSize, CANVAS_SIZE, i * pixelSize);
          }
        };
      }, previewRef.current);
    }

    return () => {
      editorSketch?.remove();
      previewSketch?.remove();
    };
  }, [gridSize]);

  return (
    <div className="flex flex-col items-center">
      <div className="mb-4">
        <Label htmlFor="gridSize">그리드 크기: {gridSize}x{gridSize}</Label>
        <Slider
          id="gridSize"
          min={4}
          max={32}
          step={1}
          value={[gridSize]}
          onValueChange={(value) => setGridSize(value[0])}
          className="w-[200px]"
        />
      </div>
      <div className="flex space-x-4">
        <div>
          <h2 className="text-lg font-semibold mb-2">서브픽셀 편집기</h2>
          <div ref={editorRef} />
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-2">픽셀 미리보기</h2>
          <div ref={previewRef} />
        </div>
      </div>
      <Button className="mt-4" onClick={initializeSubpixels}>초기화</Button>
    </div>
  );
};

export default SubpixelEditor;