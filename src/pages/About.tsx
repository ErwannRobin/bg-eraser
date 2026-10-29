import { Link } from "react-router-dom";
import { ArrowLeft, Github, Wand2 } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";

const REPO_URL = "https://github.com/ErwannRobin/bg-eraser";

const steps = [
  {
    title: "Load",
    text: "Your image is loaded in the browser. iPhone HEIC/HEIF photos are converted to JPEG first.",
  },
  {
    title: "Segment",
    text: "A copy resized to at most 1024 px goes through the BRIA RMBG-1.4 model, run by Transformers.js (WebGPU when available, WASM otherwise). It returns a foreground mask.",
  },
  {
    title: "Refine",
    text: "The mask is scaled back to the original size, then a guided filter uses your original pixels to snap its edges onto the real edges of the subject.",
  },
  {
    title: "Export",
    text: "The mask becomes the alpha channel of the original pixels. The result is a full-resolution transparent PNG.",
  },
];

const About = () => (
  <div className="min-h-screen bg-gradient-bg relative">
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <Button asChild variant="ghost" size="sm" className="mb-8 -ml-3">
        <Link to="/">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to BG Eraser
        </Link>
      </Button>

      <header className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-soft">
            <Wand2 className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold">About BG Eraser</h1>
        </div>
        <p className="text-muted-foreground">
          BG Eraser removes image backgrounds directly in your browser. No upload, no signup, no
          server: the AI model runs on your device and your images never leave it.
        </p>
      </header>

      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4">How it's made</h2>
        <ol className="space-y-4">
          {steps.map((step, i) => (
            <li key={step.title} className="flex gap-4">
              <span className="flex-none w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center">
                {i + 1}
              </span>
              <p>
                <strong>{step.title}.</strong>{" "}
                <span className="text-muted-foreground">{step.text}</span>
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-muted-foreground">
          Manual mode skips the model: every pixel close to a color you pick becomes transparent.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-2">Built with</h2>
        <p className="text-muted-foreground">
          React, TypeScript, Vite, Tailwind CSS, shadcn/ui, Transformers.js, heic-convert and
          JSZip. It is a static site with no backend and no analytics. The model files are
          downloaded once from the Hugging Face Hub, then cached by your browser.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Open source</h2>
        <p className="text-muted-foreground mb-4">
          The code is MIT licensed. Read it, fork it, or send a pull request.
        </p>
        <Button asChild>
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
            <Github className="w-4 h-4 mr-2" />
            ErwannRobin/bg-eraser
          </a>
        </Button>
      </section>
    </div>
  </div>
);

export default About;
