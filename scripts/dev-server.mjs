import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const host = process.env.HOST || "127.0.0.1";
const port = normalizePort(process.env.PORT, 4173);

const MIME_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
  [".ico", "image/x-icon"],
  [".txt", "text/plain; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
]);

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || "/", `http://${request.headers.host || host}`);
    const filePath = await resolveRequestPath(requestUrl.pathname);
    const content = await readFile(filePath);
    const contentType = MIME_TYPES.get(path.extname(filePath).toLowerCase()) || "application/octet-stream";

    response.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-cache",
    });
    response.end(content);
  } catch (error) {
    if (error?.code === "ENOENT") {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("404 Not Found");
      return;
    }

    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("500 Internal Server Error");
    console.error(error);
  }
});

server.listen(port, host, () => {
  console.log(`lil-seal dev server running at http://${host}:${port}`);
  console.log("Press Ctrl+C to stop.");
});

server.on("error", (error) => {
  console.error("Failed to start dev server.");
  console.error(error);
  process.exitCode = 1;
});

process.on("SIGINT", () => {
  server.close(() => process.exit(0));
});

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});

async function resolveRequestPath(pathname) {
  const decodedPath = decodeURIComponent(pathname);
  const relativePath = decodedPath === "/" ? "/index.html" : decodedPath;
  const candidatePath = path.resolve(rootDir, `.${relativePath}`);

  if (!isInsideRoot(candidatePath)) {
    const error = new Error("Forbidden");
    error.code = "ENOENT";
    throw error;
  }

  const fileStats = await stat(candidatePath);

  if (fileStats.isDirectory()) {
    const nestedIndexPath = path.join(candidatePath, "index.html");
    return path.resolve(nestedIndexPath);
  }

  return candidatePath;
}

function isInsideRoot(targetPath) {
  const relative = path.relative(rootDir, targetPath);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative)
    ? true
    : targetPath === rootDir;
}

function normalizePort(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
