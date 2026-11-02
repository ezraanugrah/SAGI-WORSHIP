import { createServer } from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
export async function serve(directory = "dist") {
  const base = path.resolve(directory);
  const types = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".mjs": "application/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".webmanifest": "application/manifest+json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".wasm": "application/wasm",
    ".ttf": "font/ttf",
  };
  const server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(
          new URL(req.url, "http://local").pathname,
        ),
        target = path.resolve(
          base,
          "." + (pathname === "/" ? "/index.html" : pathname),
        );
      if (!target.startsWith(base + path.sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const bytes = await fs.readFile(target);
      res.writeHead(200, {
        "Content-Type":
          types[path.extname(target)] ?? "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(bytes);
    } catch {
      res.writeHead(404);
      res.end("missing");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
