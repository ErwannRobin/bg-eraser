import { vi } from "vitest";

/**
 * jsdom does not implement canvas, Image loading or ImageData.
 * These helpers provide small in-memory fakes so pixel logic can be tested.
 */

export class FakeImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  constructor(widthOrData: number | Uint8ClampedArray, width: number, height?: number) {
    if (typeof widthOrData === "number") {
      this.width = widthOrData;
      this.height = width;
      this.data = new Uint8ClampedArray(this.width * this.height * 4);
    } else {
      this.data = widthOrData;
      this.width = width;
      this.height = height ?? widthOrData.length / 4 / width;
    }
  }
}

export const makeImageData = (width: number, height: number, rgba: number[][]) => {
  const img = new FakeImageData(width, height);
  rgba.forEach((px, i) => img.data.set(px, i * 4));
  return img as unknown as ImageData;
};

interface CanvasOptions {
  /** Pixels returned by getImageData() on the first canvas that asks for them. */
  imageData?: ImageData;
  /** Blob passed to the toBlob callback. `null` simulates failure. */
  blob?: Blob | null;
  /** Make getContext() return null. */
  noContext?: boolean;
}

/** Mocks document.createElement('canvas'), recording every canvas created. */
export const mockCanvas = (options: CanvasOptions = {}) => {
  const { imageData, blob = new Blob(["png"], { type: "image/png" }), noContext } = options;
  const canvases: Array<{
    width: number;
    height: number;
    ctx: Record<string, ReturnType<typeof vi.fn>>;
    toBlob: ReturnType<typeof vi.fn>;
  }> = [];

  const realCreate = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
    if (tag !== "canvas") return realCreate(tag);
    const ctx = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => imageData),
      putImageData: vi.fn(),
    };
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => (noContext ? null : ctx)),
      toBlob: vi.fn((cb: (b: Blob | null) => void) => cb(blob)),
    };
    canvases.push(Object.assign(canvas, { ctx }) as never);
    return canvas as unknown as HTMLCanvasElement;
  }) as typeof document.createElement);

  return canvases;
};

/** Replaces the global Image with a fake that fires onload/onerror when src is set. */
export const mockImage = (opts: { width?: number; height?: number; fail?: boolean } = {}) => {
  const { width = 10, height = 10, fail = false } = opts;
  class FakeImage {
    width = width;
    height = height;
    naturalWidth = width;
    naturalHeight = height;
    crossOrigin = "";
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_value: string) {
      queueMicrotask(() => (fail ? this.onerror?.() : this.onload?.()));
    }
  }
  vi.stubGlobal("Image", FakeImage);
};
