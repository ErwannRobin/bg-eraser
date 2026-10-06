import { beforeEach, describe, expect, it, vi } from "vitest";

const convertMock = vi.fn();
vi.mock("heic-convert/browser", () => ({ default: convertMock }));

import { convertHeicToJpeg, isHeicFile } from "./heicConverter";

const file = (name: string, type = "") => new File(["data"], name, { type });

describe("isHeicFile", () => {
  it.each([
    ["photo.heic", "image/heic"],
    ["photo.heif", "image/heif"],
    ["photo.HEIC", ""],
    ["photo.heif", ""],
    ["photo.bin", "image/heic"],
  ])("accepts %s (%s)", (name, type) => {
    expect(isHeicFile(file(name, type))).toBe(true);
  });

  it.each([
    ["photo.jpg", "image/jpeg"],
    ["photo.png", "image/png"],
    ["heic.txt", "text/plain"],
    ["photo", ""],
  ])("rejects %s (%s)", (name, type) => {
    expect(isHeicFile(file(name, type))).toBe(false);
  });
});

describe("convertHeicToJpeg", () => {
  beforeEach(() => {
    convertMock.mockReset();
    convertMock.mockResolvedValue(new Uint8Array([1, 2, 3]));
  });

  it("calls heic-convert with JPEG options", async () => {
    await convertHeicToJpeg(file("a.heic", "image/heic"));
    expect(convertMock).toHaveBeenCalledWith(
      expect.objectContaining({ format: "JPEG", quality: 0.9 }),
    );
    expect(convertMock.mock.calls[0][0].buffer).toBeInstanceOf(Uint8Array);
  });

  it("returns a JPEG file with the extension replaced", async () => {
    const result = await convertHeicToJpeg(file("Holiday.HEIC", "image/heic"));
    expect(result.name).toBe("Holiday.jpg");
    expect(result.type).toBe("image/jpeg");
    expect(result.size).toBe(3);
  });

  it("handles .heif files", async () => {
    const result = await convertHeicToJpeg(file("pic.heif"));
    expect(result.name).toBe("pic.jpg");
  });

  it("propagates conversion errors", async () => {
    convertMock.mockRejectedValue(new Error("bad heic"));
    await expect(convertHeicToJpeg(file("a.heic"))).rejects.toThrow("bad heic");
  });
});
