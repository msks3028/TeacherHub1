import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { serviceWorkerPrecachePlugin } from "../vite.config.js";

test("production worker receives every safe Vite asset and a content-derived cache version", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "teacherhub-pwa-"));
  const output = path.join(root, "dist");
  fs.mkdirSync(output, { recursive: true });
  fs.mkdirSync(path.join(output, "icons"), { recursive: true });
  fs.writeFileSync(path.join(output, "asset-manifest.json"), JSON.stringify({
    "src/main.jsx": {
      file: "assets/index-Dru0NOmz.js",
      css: ["assets/index-BhB2fKh4.css"],
      assets: ["assets/logo-AbC_123-.svg"],
    },
    "src/room.jsx": { file: "assets/LiveClassRoomPage-DSIu2rpG.js", isDynamicEntry: true },
    "src/outside.js": { file: "uploads/private.js" },
  }));
  const workerTemplate = fs.readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
  fs.writeFileSync(path.join(output, "sw.js"), workerTemplate);
  for (const shellFile of ["index.html", "offline.html", "manifest.webmanifest", "icons/teacherhub-192.png", "icons/teacherhub-512.png"]) {
    fs.writeFileSync(path.join(output, shellFile), `shell:${shellFile}`);
  }

  try {
    const plugin = serviceWorkerPrecachePlugin();
    plugin.configResolved({ root, build: { outDir: "dist" } });
    await plugin.closeBundle();

    const worker = fs.readFileSync(path.join(output, "sw.js"), "utf8");
    const version = worker.match(/const BUILD_CACHE_VERSION = "([a-f0-9]{12})";/)?.[1];
    const assets = JSON.parse(worker.match(/const PRECACHE_ASSETS = (\[[^\n]*\]);/)?.[1] || "null");

    assert.ok(version, "the cache version is derived from the emitted asset list");
    assert.deepEqual(assets, [
      "/assets/LiveClassRoomPage-DSIu2rpG.js",
      "/assets/index-BhB2fKh4.css",
      "/assets/index-Dru0NOmz.js",
      "/assets/logo-AbC_123-.svg",
    ]);
    assert.ok(!worker.includes("uploads/private.js"));
    assert.ok(!worker.includes("__PRECACHE_ASSETS__"));

    const handlers = new Map();
    const cached = new Map();
    const cache = {
      async addAll(urls) {
        for (const url of urls) cached.set(url, new Response(`cached:${url}`));
      },
      async match(request) {
        const key = typeof request === "string" ? request : new URL(request.url).pathname;
        return cached.get(key) || null;
      },
      async put(request, response) {
        cached.set(typeof request === "string" ? request : new URL(request.url).pathname, response);
      },
    };
    const serviceWorkerScope = {
      location: { origin: "https://teacherhub.example" },
      addEventListener: (name, handler) => handlers.set(name, handler),
      clients: { claim: async () => {}, matchAll: async () => [], openWindow: async () => {} },
      registration: { showNotification: async () => {} },
      skipWaiting: async () => {},
    };
    const cacheStorage = { open: async () => cache, keys: async () => [], delete: async () => true };
    vm.runInNewContext(worker, {
      self: serviceWorkerScope,
      caches: cacheStorage,
      URL,
      Response,
      fetch: async () => { throw new Error("offline"); },
    });

    let install;
    handlers.get("install")({ waitUntil: (promise) => { install = promise; } });
    await install;
    for (const url of ["/", "/offline.html", ...assets]) assert.ok(cached.has(url), `${url} is precached`);

    async function dispatchFetch(request) {
      let responsePromise;
      handlers.get("fetch")({ request, respondWith: (promise) => { responsePromise = Promise.resolve(promise); } });
      return responsePromise ? responsePromise : null;
    }

    assert.equal(await dispatchFetch({ method: "GET", mode: "cors", url: "https://teacherhub.example/api/student/courses" }), null);
    assert.equal(await dispatchFetch({ method: "GET", mode: "cors", url: "https://teacherhub.example/uploads/images/avatar.png" }), null);
    const deepLinkResponse = await dispatchFetch({ method: "GET", mode: "navigate", url: "https://teacherhub.example/student/courses/course-id" });
    assert.equal(await deepLinkResponse.text(), "cached:/");
    const dynamicChunk = await dispatchFetch({ method: "GET", mode: "cors", url: "https://teacherhub.example/assets/LiveClassRoomPage-DSIu2rpG.js" });
    assert.equal(await dynamicChunk.text(), "cached:/assets/LiveClassRoomPage-DSIu2rpG.js");

    fs.writeFileSync(path.join(output, "sw.js"), workerTemplate);
    fs.writeFileSync(path.join(output, "offline.html"), "updated offline page");
    await plugin.closeBundle();
    const updatedVersion = fs.readFileSync(path.join(output, "sw.js"), "utf8")
      .match(/const BUILD_CACHE_VERSION = "([a-f0-9]{12})";/)?.[1];
    assert.notEqual(updatedVersion, version, "a changed offline shell file gets a new cache version");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
