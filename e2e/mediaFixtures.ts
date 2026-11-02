import type { Page } from "@playwright/test";
export const nodeBuffer = (
  globalThis as unknown as {
    Buffer: { from(value: string, encoding?: string): Uint8Array };
  }
).Buffer;
export function syntheticPDF() {
  let text = "%PDF-1.4\n";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 640 360] /Resources << /Font << /F1 7 0 R >> >> /Contents 4 0 R >>",
    "",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 640 360] /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>",
    "",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  for (const [index, label] of [
    [3, "Original synthetic PDF page one"],
    [5, "Original synthetic PDF page two"],
  ] as const) {
    const stream = `0.9 0.6 0.2 rg 0 0 640 360 re f BT /F1 24 Tf 0 0 0 rg 40 180 Td (${label}) Tj ET`;
    objects[index] =
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  }
  const offsets = [0];
  objects.forEach((obj, i) => {
    offsets.push(text.length);
    text += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const start = text.length;
  text +=
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets
      .slice(1)
      .map((n) => `${String(n).padStart(10, "0")} 00000 n \n`)
      .join("") +
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return nodeBuffer.from(text);
}
export async function imageFile(
  page: Page,
  name = "synthetic.png",
  color = "#e9ad52",
) {
  const value = await page.evaluate((color) => {
    const c = document.createElement("canvas");
    c.width = 640;
    c.height = 360;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 640, 360);
    ctx.fillStyle = "#000";
    ctx.font = "24px sans-serif";
    ctx.fillText("Original synthetic media", 30, 100);
    return c.toDataURL("image/png").split(",")[1];
  }, color);
  return {
    name,
    mimeType: "image/png",
    buffer: nodeBuffer.from(value, "base64"),
  };
}
export async function videoFile(page: Page) {
  const value = await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 320;
    c.height = 180;
    const ctx = c.getContext("2d")!,
      stream = c.captureStream(10),
      rec = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8" }),
      chunks: Blob[] = [];
    const done = new Promise<Blob>((resolve) => {
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
    });
    rec.start();
    for (let i = 0; i < 35; i++) {
      ctx.fillStyle = i % 2 ? "#dfaa44" : "#303945";
      ctx.fillRect(0, 0, 320, 180);
      ctx.fillStyle = "#fff";
      ctx.fillText(`Synthetic frame ${i}`, 20, 90);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    rec.stop();
    const b = await done;
    stream.getTracks().forEach((t) => t.stop());
    return await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(",")[1]);
      r.readAsDataURL(b);
    });
  });
  return {
    name: "synthetic.webm",
    mimeType: "video/webm",
    buffer: nodeBuffer.from(value, "base64"),
  };
}
