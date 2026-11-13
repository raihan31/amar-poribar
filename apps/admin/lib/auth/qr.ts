import QRCode from "qrcode";

/** Draws `text` as a QR code onto `canvas` (uses the `qrcode` library; no network). */
export async function drawQr(canvas: HTMLCanvasElement, text: string, size = 176): Promise<void> {
  await QRCode.toCanvas(canvas, text, { width: size, margin: 1, errorCorrectionLevel: "M" });
}
