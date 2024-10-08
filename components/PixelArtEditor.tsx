'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import p5 from 'p5';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Paintbrush, Eraser } from 'lucide-react';

const CANVAS_SIZE = 400;
const DEFAULT_GRID_SIZE = 16;

const PixelArtEditor: React.FC = () => {
  const editorRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [gridSize, setGridSize] = useState(DEFAULT_GRID_SIZE);
  const colorRef = useRef('#000000');
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush');
  const [pixels, setPixels] = useState<string[][]>([]);
  const pixelsRef = useRef<string[][]>([]);

  useEffect(() => {
    initializePixels();
  }, [gridSize]);

  useEffect(() => {
    pixelsRef.current = pixels;
  }, [pixels]);

  const initializePixels = useCallback(() => {
    const newPixels = Array(gridSize).fill(null).map(() => Array(gridSize).fill(''));
    setPixels(newPixels);
    pixelsRef.current = newPixels;
  }, [gridSize]);

  const handleColorChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    colorRef.current = e.target.value;
  }, []);

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
          p.background(255);
          const pixelSize = CANVAS_SIZE / gridSize;

          pixelsRef.current.forEach((row, y) => {
            row.forEach((pixelColor, x) => {
              if (pixelColor) {
                p.fill(pixelColor);
                p.noStroke();
                p.rect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
              }
            });
          });

          // Draw grid
          p.stroke(200);
          for (let i = 0; i <= gridSize; i++) {
            p.line(i * pixelSize, 0, i * pixelSize, CANVAS_SIZE);
            p.line(0, i * pixelSize, CANVAS_SIZE, i * pixelSize);
          }
        };

        p.mousePressed = () => drawPixel(p);
        p.mouseDragged = () => drawPixel(p);

        const drawPixel = (p: p5) => {
          const pixelSize = CANVAS_SIZE / gridSize;
          const x = Math.floor(p.mouseX / pixelSize);
          const y = Math.floor(p.mouseY / pixelSize);

          if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
            const newPixels = pixelsRef.current.map(row => [...row]);
            newPixels[y][x] = tool === 'brush' ? colorRef.current : '';
            setPixels(newPixels);
            pixelsRef.current = newPixels;
          }
        };
      }, editorRef.current);

      previewSketch = new p5((p: p5) => {
        let buffer: p5.Graphics;

        p.setup = () => {
          p.createCanvas(CANVAS_SIZE, CANVAS_SIZE);
          p.noSmooth();
          buffer = p.createGraphics(CANVAS_SIZE, CANVAS_SIZE);
        };

        p.draw = () => {
          buffer.background(0);
          const pixelSize = CANVAS_SIZE / gridSize;
          const subPixelSize = pixelSize / 3;

          pixelsRef.current.forEach((row, y) => {
            row.forEach((pixelColor, x) => {
              if (pixelColor) {
                const rgb = hexToRgb(pixelColor);
                if (rgb) {
                  buffer.noStroke();
                  buffer.fill(rgb.r, 0, 0);
                  buffer.rect(x * pixelSize, y * pixelSize, subPixelSize, pixelSize);
                  buffer.fill(0, rgb.g, 0);
                  buffer.rect(x * pixelSize + subPixelSize, y * pixelSize, subPixelSize, pixelSize);
                  buffer.fill(0, 0, rgb.b);
                  buffer.rect(x * pixelSize + 2 * subPixelSize, y * pixelSize, subPixelSize, pixelSize);
                }
              }
            });
          });

          // Apply blur effect
          p.image(buffer, 0, 0);
          p.filter(p.BLUR, 1);

          // Apply glow effect
          p.blendMode(p.ADD);
          p.image(buffer, 0, 0);
          p.blendMode(p.BLEND);

          // Draw LCD grid
          p.stroke(0, 30);
          p.strokeWeight(1);
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
  }, [tool, gridSize]);

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };

  return (
    <div className="flex flex-col items-center">
      <div className="flex space-x-4 mb-4">
        <div>
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
        <div>
          <Label htmlFor="colorPicker">색상</Label>
          <Input
            id="colorPicker"
            type="color"
            defaultValue={colorRef.current}
            onChange={handleColorChange}
            className="w-[100px] h-[38px]"
          />
        </div>
        <ToggleGroup type="single" value={tool} onValueChange={(value) => setTool(value as 'brush' | 'eraser')}>
          <ToggleGroupItem value="brush" aria-label="브러시">
            <Paintbrush className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="eraser" aria-label="지우개">
            <Eraser className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="flex space-x-4">
        <div>
          <h2 className="text-lg font-semibold mb-2">편집기</h2>
          <div ref={editorRef} />
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-2">LCD 서브픽셀 미리보기</h2>
          <div ref={previewRef} />
        </div>
      </div>
      <Button className="mt-4" onClick={initializePixels}>초기화</Button>
    </div>
  );
};

export default PixelArtEditor;