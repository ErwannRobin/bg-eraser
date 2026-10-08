import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installGlobalDebugHooks } from "./utils/debugLog";

installGlobalDebugHooks();

createRoot(document.getElementById("root")!).render(<App />);
