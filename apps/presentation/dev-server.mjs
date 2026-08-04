import { createReadStream, readFileSync, readdirSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";

const root = resolve(process.env.ROOT || ".");
const port = Number.parseInt(process.env.PORT || "8080", 10);
const ignoredDirectories = new Set([".git", "archive", "qa"]);
const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".glb", "model/gltf-binary"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".mp4", "video/mp4"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".woff2", "font/woff2"],
]);

const liveReloadScript = `
<script>
  (() => {
    let currentVersion = null;
    const checkForChanges = async () => {
      try {
        const response = await fetch('/__live_reload_version', { cache: 'no-store' });
        const nextVersion = await response.text();
        if (currentVersion !== null && currentVersion !== nextVersion) {
          location.reload();
          return;
        }
        currentVersion = nextVersion;
      } catch {}
    };
    checkForChanges();
    setInterval(checkForChanges, 700);
  })();
</script>`;

function getProjectVersion(directory = root) {
  let latestChange = 0;
  let totalSize = 0;
  let fileCount = 0;

  readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) return;
    const entryPath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      const childVersion = getProjectVersion(entryPath).split(":").map(Number);
      latestChange = Math.max(latestChange, childVersion[0]);
      totalSize += childVersion[1];
      fileCount += childVersion[2];
      return;
    }
    if (!entry.isFile()) return;
    const stats = statSync(entryPath);
    latestChange = Math.max(latestChange, Math.round(stats.mtimeMs));
    totalSize += stats.size;
    fileCount += 1;
  });

  return `${latestChange}:${totalSize}:${fileCount}`;
}

function sendFile(request, response, filePath, stats) {
  const contentType = mimeTypes.get(extname(filePath).toLowerCase()) || "application/octet-stream";
  const range = request.headers.range?.match(/^bytes=(\d*)-(\d*)$/);
  response.setHeader("Accept-Ranges", "bytes");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", contentType);

  if (range) {
    const start = range[1] ? Number.parseInt(range[1], 10) : 0;
    const end = range[2] ? Number.parseInt(range[2], 10) : stats.size - 1;
    if (start > end || end >= stats.size) {
      response.writeHead(416, { "Content-Range": `bytes */${stats.size}` });
      response.end();
      return;
    }
    response.writeHead(206, {
      "Content-Length": end - start + 1,
      "Content-Range": `bytes ${start}-${end}/${stats.size}`,
    });
    if (request.method === "HEAD") response.end();
    else createReadStream(filePath, { start, end }).pipe(response);
    return;
  }

  response.writeHead(200, { "Content-Length": stats.size });
  if (request.method === "HEAD") response.end();
  else createReadStream(filePath).pipe(response);
}

createServer((request, response) => {
  const requestUrl = new URL(request.url || "/", "http://localhost");
  if (requestUrl.pathname === "/__live_reload_version") {
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    });
    response.end(getProjectVersion());
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(requestUrl.pathname);
  } catch {
    response.writeHead(400).end("Bad request");
    return;
  }

  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = resolve(root, `.${requestedPath}`);
  if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  let stats;
  try {
    stats = statSync(filePath);
  } catch {
    response.writeHead(404).end("Not found");
    return;
  }
  if (!stats.isFile()) {
    response.writeHead(404).end("Not found");
    return;
  }

  if (extname(filePath).toLowerCase() === ".html") {
    const assetVersion = encodeURIComponent(getProjectVersion());
    const html = readFileSync(filePath, "utf8")
      .replace(/(href="apple\.css)(?:\?[^\"]*)?"/g, `$1?dev=${assetVersion}"`)
      .replace(/(src="deck\.js)(?:\?[^\"]*)?"/g, `$1?dev=${assetVersion}"`)
      .replace(/(src="macbook-3d\.js)(?:\?[^\"]*)?"/g, `$1?dev=${assetVersion}"`)
      .replace("</body>", `${liveReloadScript}\n</body>`);
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Length": Buffer.byteLength(html),
      "Content-Type": "text/html; charset=utf-8",
    });
    response.end(request.method === "HEAD" ? undefined : html);
    return;
  }

  sendFile(request, response, filePath, stats);
}).listen(port, "0.0.0.0", () => {
  console.log(`ReAlgo live development server: http://localhost:${port}`);
});
