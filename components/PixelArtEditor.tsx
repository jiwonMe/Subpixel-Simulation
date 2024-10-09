'use client';

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import p5 from 'p5';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Paintbrush, Eraser } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { saveAs } from 'file-saver';

// Constants
const CANVAS_SIZE = 400;
const DEFAULT_GRID_SIZE = 16;
const DEFAULT_COLOR = '#FF0000';

// Types
type Tool = 'brush' | 'eraser';
type PixelGrid = string[][];

// Color options
const COLOR_OPTIONS = [
  '#000000', '#FF0000', '#00FF00', '#0000FF',
  '#FFFF00', '#FF00FF', '#00FFFF', '#FFFFFF',
];

// Utility functions
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

const createEmptyGrid = (size: number): PixelGrid => 
  Array(size).fill(null).map(() => Array(size).fill(''));

const readBmpFile = (file: File): Promise<PixelGrid> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      const view = new DataView(buffer);
      
      try {
        // BMP 파일 시그니처 확인
        const fileType = String.fromCharCode(view.getUint8(0), view.getUint8(1));
        if (fileType !== 'BM') {
          throw new Error('유효하지 않은 BMP 파일입니다.');
        }

        // BMP 헤더 읽기
        const fileSize = view.getUint32(2, true);
        const dataOffset = view.getUint32(10, true);
        const headerSize = view.getUint32(14, true);
        const width = view.getInt32(18, true);
        const height = Math.abs(view.getInt32(22, true));
        const bitsPerPixel = view.getUint16(28, true);
        
        if (bitsPerPixel !== 24 && bitsPerPixel !== 32) {
          throw new Error('지원되지 않는 BMP 형식입니다. 24비트 또는 32비트 BMP만 지원됩니다.');
        }

        if (width * height * (bitsPerPixel / 8) + dataOffset > fileSize) {
          throw new Error('파일 크기가 올바르지 않습니다.');
        }
        
        const pixelGrid: PixelGrid = Array(height).fill(null).map(() => Array(width).fill(''));
        const bytesPerPixel = bitsPerPixel / 8;
        const rowSize = Math.floor((bitsPerPixel * width + 31) / 32) * 4;
        
        // 픽셀 데이터 읽기
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const i = dataOffset + (height - 1 - y) * rowSize + x * bytesPerPixel;
            if (i + 2 >= buffer.byteLength) {
              throw new Error('파일의 끝에 도달했습니다. 픽셀 데이터가 부족합니다.');
            }
            const b = view.getUint8(i);
            const g = view.getUint8(i + 1);
            const r = view.getUint8(i + 2);
            pixelGrid[y][x] = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
          }
        }
        
        resolve(pixelGrid);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

const saveBmpFile = (pixels: PixelGrid, fileName: string) => {
  const width = pixels[0].length;
  const height = pixels.length;
  const bitsPerPixel = 24;
  const bytesPerPixel = bitsPerPixel / 8;
  const rowSize = Math.floor((bitsPerPixel * width + 31) / 32) * 4;
  const pixelDataSize = rowSize * height;
  const fileSize = 54 + pixelDataSize;
  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  // BMP 파일 헤더 (14 bytes)
  view.setUint16(0, 0x4D42, true); // BM
  view.setUint32(2, fileSize, true); // 파일 크기
  view.setUint32(6, 0, true); // 예약된 필드
  view.setUint32(10, 54, true); // 픽셀 데이터 오프셋

  // DIB 헤더 (40 bytes)
  view.setUint32(14, 40, true); // DIB 헤더 크기
  view.setInt32(18, width, true); // 너비
  view.setInt32(22, -height, true); // 높이 (음수: 상단에서 하단으로)
  view.setUint16(26, 1, true); // 색상면
  view.setUint16(28, bitsPerPixel, true); // 비트 수
  view.setUint32(30, 0, true); // 압축 (0: 무압축)
  view.setUint32(34, pixelDataSize, true); // 이미지 크기
  view.setInt32(38, 2835, true); // 수평 해상도 (픽셀/미터)
  view.setInt32(42, 2835, true); // 수직 해상도 (픽셀/미터)
  view.setUint32(46, 0, true); // 색상 팔레트 수
  view.setUint32(50, 0, true); // 중요한 색상 수

  // 픽셀 데이터
  let offset = 54;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const color = pixels[y][x] || '#000000';
      const rgb = hexToRgb(color);
      if (rgb) {
        view.setUint8(offset++, rgb.b);
        view.setUint8(offset++, rgb.g);
        view.setUint8(offset++, rgb.r);
      }
    }
    // 행 패딩 (4바이트 정렬)
    while (offset % 4 !== 0) {
      view.setUint8(offset++, 0);
    }
  }

  const blob = new Blob([buffer], { type: 'image/bmp' });
  saveAs(blob, fileName);
};

// Sub-components
const ColorPicker: React.FC<{
  selectedColor: string,
  onColorChange: (color: string) => void,
}> = React.memo(({ selectedColor, onColorChange }) => (
  <div className="flex flex-wrap gap-2 mb-4">
    {COLOR_OPTIONS.map((color) => (
      <button
        key={color}
        className={`w-8 h-8 rounded-full border-2 ${selectedColor === color ? 'border-gray-500' : 'border-transparent'}`}
        style={{ backgroundColor: color }}
        onClick={() => onColorChange(color)}
        aria-label={`색상 선택: ${color}`}
      />
    ))}
  </div>
));

ColorPicker.displayName = 'ColorPicker';

const Controls: React.FC<{
  gridSize: number,
  setGridSize: (size: number) => void,
  selectedColor: string,
  setSelectedColor: (color: string) => void,
  tool: Tool,
  setTool: (tool: Tool) => void,
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void,
}> = React.memo(({ gridSize, setGridSize, selectedColor, setSelectedColor, tool, setTool, onFileUpload }) => (
  <div className="flex flex-col space-y-4 mb-4">
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
      <Label>색상</Label>
      <ColorPicker selectedColor={selectedColor} onColorChange={setSelectedColor} />
    </div>
    <ToggleGroup type="single" value={tool} onValueChange={(value) => setTool(value as Tool)}>
      <ToggleGroupItem value="brush" aria-label="브러시">
        <Paintbrush className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="eraser" aria-label="지우개">
        <Eraser className="h-4 w-4" />
      </ToggleGroupItem>
    </ToggleGroup>
    {/* <div>
      <Label htmlFor="bmpUpload">BMP 파일 업로드</Label>
      <Input
        id="bmpUpload"
        type="file"
        accept=".bmp"
        onChange={onFileUpload}
        className="w-full"
      />
    </div> */}
  </div>
));

Controls.displayName = 'Controls';

const PixelArtEditor: React.FC = () => {
  const editorRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [gridSize, setGridSize] = useState(DEFAULT_GRID_SIZE);
  const [selectedColor, setSelectedColor] = useState(DEFAULT_COLOR);
  const [tool, setTool] = useState<Tool>('brush');
  const [pixels, setPixels] = useState<PixelGrid>([]);
  const pixelsRef = useRef<PixelGrid>([]);

  const initializePixels = useCallback(() => {
    const newPixels = createEmptyGrid(gridSize);
    setPixels(newPixels);
    pixelsRef.current = newPixels;
  }, [gridSize]);

  useEffect(() => {
    initializePixels();
  }, [initializePixels]);

  useEffect(() => {
    pixelsRef.current = pixels;
  }, [pixels]);

  const drawPixel = useCallback((p: p5) => {
    const pixelSize = CANVAS_SIZE / gridSize;
    const x = Math.floor(p.mouseX / pixelSize);
    const y = Math.floor(p.mouseY / pixelSize);

    if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
      const newPixels = pixelsRef.current.map(row => [...row]);
      newPixels[y][x] = tool === 'brush' ? selectedColor : '';
      setPixels(newPixels);
      pixelsRef.current = newPixels;
    }
  }, [gridSize, selectedColor, tool]);

  const setupEditor = useCallback((p: p5) => {
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
          } else {
            p.fill(0);
            p.rect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
          }
        });
      });

      p.stroke(200);
      for (let i = 0; i <= gridSize; i++) {
        p.line(i * pixelSize, 0, i * pixelSize, CANVAS_SIZE);
        p.line(0, i * pixelSize, CANVAS_SIZE, i * pixelSize);
      }
    };

    p.mousePressed = () => drawPixel(p);
    p.mouseDragged = () => drawPixel(p);
  }, [gridSize, drawPixel]);

  const setupPreview = useCallback((p: p5) => {
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
              buffer.ellipse(x * pixelSize, y * pixelSize, subPixelSize, pixelSize*0.75);
              buffer.fill(0, rgb.g, 0);
              buffer.ellipse(x * pixelSize + subPixelSize, y * pixelSize, subPixelSize, pixelSize*0.75);
              buffer.fill(30*rgb.b/255, 30*rgb.b/255, rgb.b);
              buffer.ellipse(x * pixelSize + 2 * subPixelSize, y * pixelSize, subPixelSize, pixelSize*0.75);
            }
          }
        });
      });

      p.image(buffer, 0, 0);
      p.filter(p.BLUR, 20);
      p.blendMode(p.ADD);
      p.image(buffer, 0, 0);
      p.filter(p.BLUR, 4);
      p.blendMode(p.ADD);
      p.image(buffer, 0, 0);
      p.filter(p.BLUR, 2);
      p.blendMode(p.SCREEN);
      p.image(buffer, 0, 0);
      p.filter(p.BLUR, 2);
      p.blendMode(p.BLEND);
      
      p.loadPixels();
      for (let i = 0; i < p.pixels.length; i += 4) {
        p.pixels[i] = Math.min(255, p.pixels[i] * 1.2);
        p.pixels[i + 1] = Math.min(255, p.pixels[i + 1] * 1.2);
        p.pixels[i + 2] = Math.min(255, p.pixels[i + 2] * 1.2);
      }
      p.updatePixels();
    };
  }, [gridSize]);

  useEffect(() => {
    let editorSketch: p5;
    let previewSketch: p5;

    if (editorRef.current && previewRef.current) {
      editorSketch = new p5(setupEditor, editorRef.current);
      previewSketch = new p5(setupPreview, previewRef.current);
    }

    return () => {
      editorSketch?.remove();
      previewSketch?.remove();
    };
  }, [setupEditor, setupPreview]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'image/bmp') {
      try {
        const pixelGrid = await readBmpFile(file);
        setGridSize(pixelGrid.length);
        setPixels(pixelGrid);
        pixelsRef.current = pixelGrid;
      } catch (error) {
        console.error('BMP 파일 읽기 오류:', error);
        alert('BMP 파일을 읽는 중 오류가 발생했습니다.');
      }
    } else {
      alert('유효한 BMP 파일을 선택해주세요.');
    }
  };

  const handleSave = () => {
    const fileName = `pixel_art_${gridSize}x${gridSize}.bmp`;
    saveBmpFile(pixels, fileName);
  };

  const memoizedControls = useMemo(() => (
    <Controls
      gridSize={gridSize}
      setGridSize={setGridSize}
      selectedColor={selectedColor}
      setSelectedColor={setSelectedColor}
      tool={tool}
      setTool={setTool}
      onFileUpload={handleFileUpload}
    />
  ), [gridSize, selectedColor, tool]);

  return (
    <div className="flex flex-col items-center">
      {memoizedControls}
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
      <div className="mt-4 space-x-4">
        <Button onClick={initializePixels}>초기화</Button>
        {/* <Button onClick={handleSave}>BMP로 저장</Button> */}
      </div>
    </div>
  );
};

export default PixelArtEditor;