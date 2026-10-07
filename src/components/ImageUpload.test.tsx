import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toastMock = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }));

const convertHeicToJpeg = vi.fn();
vi.mock("@/utils/heicConverter", async () => {
  const actual = await vi.importActual<typeof import("@/utils/heicConverter")>(
    "@/utils/heicConverter",
  );
  return { ...actual, convertHeicToJpeg: (f: File) => convertHeicToJpeg(f) };
});

import { ImageUpload } from "./ImageUpload";

const png = (name = "a.png") => new File(["x"], name, { type: "image/png" });
const heic = (name = "a.heic") => new File(["x"], name, { type: "image/heic" });
const text = () => new File(["x"], "a.txt", { type: "text/plain" });

const getInput = (container: HTMLElement) =>
  container.querySelector('input[type="file"]') as HTMLInputElement;

const drop = (container: HTMLElement, files: File[]) =>
  fireEvent.drop(container.firstElementChild!, { dataTransfer: { files } });

beforeEach(() => {
  toastMock.mockReset();
  convertHeicToJpeg.mockReset();
  convertHeicToJpeg.mockImplementation(async (f: File) =>
    new File(["j"], f.name.replace(/\.heic$/i, ".jpg"), { type: "image/jpeg" }),
  );
});

describe("ImageUpload", () => {
  it("shows single-image copy by default", () => {
    render(<ImageUpload onImageSelect={vi.fn()} isProcessing={false} />);
    expect(screen.getByText("Drop your image here")).toBeInTheDocument();
    expect(screen.queryByText(/Multiple files supported/)).not.toBeInTheDocument();
  });

  it("shows multi-image copy when multiple is set", () => {
    render(<ImageUpload onImageSelect={vi.fn()} isProcessing={false} multiple />);
    expect(screen.getByText("Drop your images here")).toBeInTheDocument();
    expect(screen.getByText(/Multiple files supported/)).toBeInTheDocument();
  });

  it("configures the file input", () => {
    const { container } = render(
      <ImageUpload onImageSelect={vi.fn()} isProcessing={false} multiple />,
    );
    const input = getInput(container);
    expect(input).toHaveAttribute("accept", "image/*,.heic,.heif");
    expect(input).toHaveAttribute("multiple");
    expect(input).not.toBeDisabled();
  });

  it("disables the input while processing", () => {
    const { container } = render(<ImageUpload onImageSelect={vi.fn()} isProcessing />);
    expect(getInput(container)).toBeDisabled();
  });

  it("passes selected image files to onImageSelect", async () => {
    const onImageSelect = vi.fn();
    const { container } = render(<ImageUpload onImageSelect={onImageSelect} isProcessing={false} multiple />);
    const files = [png("a.png"), png("b.png")];

    await userEvent.upload(getInput(container), files);

    await waitFor(() => expect(onImageSelect).toHaveBeenCalledWith(files));
  });

  it("converts HEIC files to JPEG", async () => {
    const onImageSelect = vi.fn();
    const { container } = render(<ImageUpload onImageSelect={onImageSelect} isProcessing={false} />);

    await userEvent.upload(getInput(container), heic("photo.heic"));

    await waitFor(() => expect(onImageSelect).toHaveBeenCalled());
    expect(convertHeicToJpeg).toHaveBeenCalledTimes(1);
    const [[files]] = onImageSelect.mock.calls;
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe("photo.jpg");
    expect(files[0].type).toBe("image/jpeg");
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Converting HEIC..." }));
  });

  it("shows a destructive toast when HEIC conversion fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    convertHeicToJpeg.mockRejectedValue(new Error("boom"));
    const onImageSelect = vi.fn();
    const { container } = render(<ImageUpload onImageSelect={onImageSelect} isProcessing={false} />);

    await userEvent.upload(getInput(container), heic());

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Conversion failed", variant: "destructive" }),
      ),
    );
    expect(onImageSelect).not.toHaveBeenCalled();
  });

  it("shows the converting state while HEIC is processed", async () => {
    let finish!: (f: File) => void;
    convertHeicToJpeg.mockReturnValue(new Promise<File>((r) => (finish = r)));
    const { container } = render(<ImageUpload onImageSelect={vi.fn()} isProcessing={false} />);

    await userEvent.upload(getInput(container), heic());

    expect(await screen.findByText("Converting HEIC...")).toBeInTheDocument();
    expect(getInput(container)).toBeDisabled();

    await act(async () => finish(new File(["j"], "a.jpg", { type: "image/jpeg" })));
    expect(screen.queryByText("Converting HEIC...")).not.toBeInTheDocument();
  });

  describe("drag and drop", () => {
    it("accepts dropped images", async () => {
      const onImageSelect = vi.fn();
      const { container } = render(
        <ImageUpload onImageSelect={onImageSelect} isProcessing={false} multiple />,
      );
      const files = [png("a.png"), png("b.png")];

      drop(container, files);

      await waitFor(() => expect(onImageSelect).toHaveBeenCalledWith(files));
    });

    it("keeps only the first file in single mode", async () => {
      const onImageSelect = vi.fn();
      const { container } = render(<ImageUpload onImageSelect={onImageSelect} isProcessing={false} />);
      const first = png("a.png");

      drop(container, [first, png("b.png")]);

      await waitFor(() => expect(onImageSelect).toHaveBeenCalledWith([first]));
    });

    it("filters out non-image files", async () => {
      const onImageSelect = vi.fn();
      const { container } = render(
        <ImageUpload onImageSelect={onImageSelect} isProcessing={false} multiple />,
      );
      const image = png();

      drop(container, [text(), image]);

      await waitFor(() => expect(onImageSelect).toHaveBeenCalledWith([image]));
    });

    it("shows an error toast when nothing dropped is an image", () => {
      const onImageSelect = vi.fn();
      const { container } = render(<ImageUpload onImageSelect={onImageSelect} isProcessing={false} />);

      drop(container, [text()]);

      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Invalid file", variant: "destructive" }),
      );
      expect(onImageSelect).not.toHaveBeenCalled();
    });

    it("ignores drops while processing", () => {
      const onImageSelect = vi.fn();
      const { container } = render(<ImageUpload onImageSelect={onImageSelect} isProcessing />);

      drop(container, [png()]);

      expect(onImageSelect).not.toHaveBeenCalled();
      expect(toastMock).not.toHaveBeenCalled();
    });

    it("accepts dropped HEIC files and converts them", async () => {
      const onImageSelect = vi.fn();
      const { container } = render(<ImageUpload onImageSelect={onImageSelect} isProcessing={false} />);

      drop(container, [new File(["x"], "a.HEIC", { type: "" })]);

      await waitFor(() => expect(onImageSelect).toHaveBeenCalled());
      expect(convertHeicToJpeg).toHaveBeenCalled();
    });
  });

  it("shows an error toast when the file picker returns only non-images", async () => {
    const onImageSelect = vi.fn();
    const { container } = render(<ImageUpload onImageSelect={onImageSelect} isProcessing={false} />);

    // userEvent.upload honours `accept`, so fire the change event directly
    fireEvent.change(getInput(container), { target: { files: [text()] } });

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Invalid files" })),
    );
    expect(onImageSelect).not.toHaveBeenCalled();
  });
});
