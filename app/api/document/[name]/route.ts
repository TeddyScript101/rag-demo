import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { name: string } }
) {
  const dataDir = path.join(process.cwd(), "data");
  // Prevent path traversal attacks
  const safeName = path.basename(params.name);

  const candidates: [string, string][] = [
    [`${safeName}.pdf`, "application/pdf"],
    [`${safeName}.md`, "text/plain; charset=utf-8"],
  ];

  for (const [filename, contentType] of candidates) {
    const filepath = path.join(dataDir, filename);
    if (fs.existsSync(filepath)) {
      const content = fs.readFileSync(filepath);
      return new Response(content, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": "inline",
        },
      });
    }
  }

  return new Response("Document not found", { status: 404 });
}
