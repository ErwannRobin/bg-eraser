# BG Eraser

Remove image backgrounds directly in your browser. No upload, no signup, no server.

**Live app:** https://bg-eraser.lovable.app

BG Eraser is a static single-page app. The AI model runs on your device through [Transformers.js](https://github.com/huggingface/transformers.js) (ONNX Runtime Web). Your images are never sent to a server.

## Features

- **AI mode**: automatic background removal with the [BRIA RMBG-1.4](https://huggingface.co/briaai/RMBG-1.4) segmentation model.
- **Manual mode**: click the image (or use a color picker) to choose colors to remove, with an adjustable tolerance.
- **Batch processing**: drop several images at once. They are processed one after another.
- **HEIC/HEIF support**: iPhone photos are converted to JPEG in the browser first.
- **Full-resolution output**: the result keeps the size of the original image.
- **Compare view**: before/after comparison of the original and the result.
- **Crop**: free crop or fixed aspect ratios.
- **2x upscale**: canvas upscale with a light sharpen filter (not an AI upscaler).
- **Export**: download PNG (named `<original>.bg-eraser.png`), copy to clipboard, or download all results as a ZIP.
- **Undo** with `Ctrl/Cmd + Z` (last 20 states), and a light/dark theme.

## How it works

1. **Load.** The image is loaded into an `<img>`. HEIC/HEIF files are converted to JPEG first (`src/utils/heicConverter.ts`).
2. **Downscale for the model.** A copy of the image is resized so its longest side is at most 1024 px.
3. **Segment.** `briaai/RMBG-1.4` runs through Transformers.js and returns a foreground mask. The model is requested with the `webgpu` device (`src/utils/backgroundRemoval.ts`).
4. **Refine the mask at full size.** The mask is resized to the original resolution. A guided filter (`src/utils/guidedFilter.ts`) then uses the original pixels as a guide to snap the mask edges onto the real image edges, which keeps Full HD and larger images sharp.
5. **Apply.** The refined mask becomes the alpha channel of the original pixels, with a very light blur (radius 1 px) on the edges.
6. **Export.** The canvas is encoded as a PNG with transparency.

Manual mode (`src/utils/manualBackgroundRemoval.ts`) skips the model. Every pixel whose RGB distance to a picked color is below the tolerance becomes transparent.

### Privacy and network

- Images are processed locally and are not uploaded.
- On first use, the browser downloads the model files from the Hugging Face Hub (`huggingface.co`). They are cached by the browser, so later runs work from the cache.
- The app has no analytics and no backend.

### Limitations

- The first run is slow because of the model download.
- WebGPU gives the best speed. Browsers without WebGPU may fail or be slow; this fallback is not tested in this repository.
- The model still sees at most 1024 px. The guided filter sharpens edges, but it cannot recover shapes the model did not see, so very fine details (hair, for example) stay limited.
- Large images use a lot of browser memory.

## Tech stack

React 18, TypeScript, Vite, Tailwind CSS, [shadcn/ui](https://ui.shadcn.com/) (Radix UI), Transformers.js, `heic-convert`, JSZip.

## Getting started

Requirements: Node.js 18 or newer and npm.

```sh
git clone https://github.com/erwannrobin/bg-eraser.git
cd bg-eraser
make install   # npm ci
make dev       # http://localhost:8080
```

### Make targets

| Target | Description |
| --- | --- |
| `make help` | List all targets |
| `make install` | Install dependencies |
| `make dev` | Start the dev server |
| `make build` | Production build in `dist/` |
| `make preview` | Build and serve the production build |
| `make lint` | Run ESLint |
| `make typecheck` | Run the TypeScript compiler |
| `make check` | Lint, typecheck and build |
| `make audit` | Audit production dependencies |
| `make clean` | Remove build output |
| `make distclean` | Remove build output and `node_modules` |

You can also call the npm scripts directly (`npm run dev`, `npm run build`, `npm run lint`).

## Project structure

```
src/
  pages/Index.tsx        Main screen: queue, modes, export, undo
  components/            Upload, comparison, manual editor, crop editor, UI parts
  components/ui/         shadcn/ui components
  utils/
    backgroundRemoval.ts        AI pipeline (model, mask, feathering)
    manualBackgroundRemoval.ts  Color-based removal
    imageCrop.ts                Crop helper
    imageUpscale.ts             2x upscale + sharpen
    heicConverter.ts            HEIC/HEIF to JPEG
```

## Deployment

`make build` creates a static site in `dist/`. Host it on any static host. No server code or environment variables are needed.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md). For security issues, see [SECURITY.md](SECURITY.md).

## Credits

Built with [Lovable](https://lovable.dev). Model: [BRIA RMBG-1.4](https://huggingface.co/briaai/RMBG-1.4) by BRIA AI.

## License

The source code is released under the [MIT License](LICENSE).

**The AI model is not covered by this license.** BRIA RMBG-1.4 is downloaded from the Hugging Face Hub at runtime and has its own license terms, which may restrict commercial use. Read the [model card](https://huggingface.co/briaai/RMBG-1.4) before using this app commercially.
