import { join } from "node:path";
import { readFile, stat } from "node:fs/promises";

const PORT = Number(Bun.env.PORT || 8080);
const ROOT = join(import.meta.dir, "src");

const MIME = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".mjs": "text/javascript; charset=utf-8",
	".wasm": "application/wasm",
	".pck": "application/octet-stream",
	".png": "image/png",
	".ico": "image/x-icon",
	".json": "application/json",
	".svg": "image/svg+xml",
};

function mimeType(path: string): string {
	return MIME[join(path).slice(join(path).lastIndexOf("."))] || "application/octet-stream";
}

Bun.serve({
	port: PORT,
	async fetch(req) {
		let pathname = decodeURIComponent(new URL(req.url).pathname);
		if (pathname.endsWith("/")) pathname += "IAS Lagerauslastung 3D.html";
		const file = join(ROOT, pathname);
		if (!file.startsWith(ROOT)) return new Response("Forbidden", { status: 403 });
		try {
			const info = await stat(file);
			if (!info.isFile()) throw new Error("not a file");
			const body = await readFile(file);
			return new Response(body, {
				headers: {
					"Content-Type": mimeType(file),
					"Cross-Origin-Opener-Policy": "same-origin",
					"Cross-Origin-Embedder-Policy": "require-corp",
				},
			});
		} catch {
			return new Response("Not Found", { status: 404 });
		}
	},
});

console.log(`Serving ${ROOT} at http://localhost:${PORT}/`);
