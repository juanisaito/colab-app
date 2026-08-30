import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { createInterpretationHandler } from "./server/interpretationApi.js";

function aiInterpretationProxy(environment) {
  const createHandler = () => createInterpretationHandler({
    apiKey: environment.ANTHROPIC_API_KEY,
    model: environment.ANTHROPIC_MODEL || "claude-sonnet-4-6",
    baseUrl: environment.ANTHROPIC_BASE_URL || "https://api.anthropic.com",
  });

  return {
    name: "colab-ai-interpretation-proxy",
    configureServer(server) {
      server.middlewares.use("/api/interpret", createHandler());
    },
    configurePreviewServer(server) {
      server.middlewares.use("/api/interpret", createHandler());
    },
  };
}

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), aiInterpretationProxy(environment)],
  };
});
