import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { getAppleDeveloperToken } from "./musickit-token.ts";
import { setKv, STATE_KEYS } from "../state.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PAGE_PATH = join(__dirname, "musickit-page.html");
const PORT = 8889;

function openBrowser(url: string): void {
  const platform = process.platform;
  const cmd = platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open";
  spawn(cmd, [url], { detached: true, stdio: "ignore" }).unref();
}

async function run(): Promise<void> {
  const devToken = await getAppleDeveloperToken();
  const pageHtml = readFileSync(PAGE_PATH, "utf8").replace("__DEVELOPER_TOKEN__", devToken);

  await new Promise<void>((resolve, reject) => {
    const server = createServer((req, res) => {
      if (!req.url) return;

      if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(pageHtml);
        return;
      }

      if (req.method === "POST" && req.url === "/capture") {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
          try {
            const parsed = JSON.parse(body) as { musicUserToken?: string };
            if (!parsed.musicUserToken) {
              res.writeHead(400, { "Content-Type": "application/json" }).end(
                JSON.stringify({ error: "musicUserToken missing" }),
              );
              return;
            }
            setKv(STATE_KEYS.appleMusicUserToken, parsed.musicUserToken);
            res.writeHead(200, { "Content-Type": "application/json" }).end(
              JSON.stringify({ ok: true }),
            );
            console.log("✓ Apple Music User Token captured and stored.");
            setTimeout(() => {
              server.close();
              resolve();
            }, 500);
          } catch (err) {
            res.writeHead(400, { "Content-Type": "application/json" }).end(
              JSON.stringify({ error: (err as Error).message }),
            );
          }
        });
        return;
      }

      res.writeHead(404).end();
    });

    server.listen(PORT, "127.0.0.1", () => {
      const url = `http://127.0.0.1:${PORT}/`;
      console.log(`Apple Music auth page available at ${url}`);
      console.log("Opening browser. Click 'Authorize Apple Music', sign in, and approve.");
      openBrowser(url);
    });

    server.on("error", reject);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((err) => {
    console.error("Apple Music auth failed:", err);
    process.exit(1);
  });
}
