import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || "http://127.0.0.1:5000";

export function serviceWorkerPrecachePlugin() {
  let outputDirectory;

  return {
    name: "teacherhub-service-worker-precache",
    apply: "build",
    configResolved(config) {
      outputDirectory = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const manifestPath = path.join(outputDirectory, "asset-manifest.json");
      const serviceWorkerPath = path.join(outputDirectory, "sw.js");
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      const assetPaths = [...new Set(Object.values(manifest).flatMap((entry) => [
        entry.file,
        ...(entry.css || []),
        ...(entry.assets || []),
      ]))]
        .filter((file) => typeof file === "string" && file.startsWith("assets/") &&
          !file.split("/").includes("..") && /\.(?:js|css|woff2?|png|webp|svg)$/i.test(file))
        .sort();
      const precacheAssets = assetPaths.map((file) => `/${file}`);
      const serviceWorkerTemplate = fs.readFileSync(serviceWorkerPath, "utf8");

      if (!serviceWorkerTemplate.includes("/*__BUILD_CACHE_VERSION__*/") || !serviceWorkerTemplate.includes("/*__PRECACHE_ASSETS__*/")) {
        throw new Error("Service worker is missing its build-time precache placeholders.");
      }

      const cacheVersionHash = createHash("sha256").update(assetPaths.join("\n")).update(serviceWorkerTemplate);
      for (const shellFile of [
        "index.html",
        "offline.html",
        "manifest.webmanifest",
        "icons/teacherhub-192.png",
        "icons/teacherhub-512.png",
      ]) {
        cacheVersionHash.update(shellFile).update(fs.readFileSync(path.join(outputDirectory, shellFile)));
      }
      const buildVersion = cacheVersionHash.digest("hex").slice(0, 12);
      let serviceWorker = serviceWorkerTemplate;

      serviceWorker = serviceWorker
        .replace("/*__BUILD_CACHE_VERSION__*/", JSON.stringify(buildVersion))
        .replace("/*__PRECACHE_ASSETS__*/", JSON.stringify(precacheAssets));
      fs.writeFileSync(serviceWorkerPath, serviceWorker);
    },
  };
}

export default defineConfig({
  plugins: [react(), serviceWorkerPrecachePlugin()],
  build: {
    manifest: "asset-manifest.json",
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true,
      },
      "/uploads": {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
});
