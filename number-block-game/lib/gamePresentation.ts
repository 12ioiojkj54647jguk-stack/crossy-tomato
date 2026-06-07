import { COLS, ROWS } from "./gameEngine";

export const CELL_SIZE = 30;
export const BOARD_WIDTH = COLS * CELL_SIZE;
export const BOARD_HEIGHT = ROWS * CELL_SIZE;

const VALUE_COLORS: Record<number, { bg: string; text: string }> = {
  2: { bg: "#F5F0EB", text: "#6B5B4F" },
  4: { bg: "#EDE8E1", text: "#5E4E42" },
  8: { bg: "#FDEBEC", text: "#9F2F2D" },
  16: { bg: "#E1F3FE", text: "#1F6C9F" },
  32: { bg: "#EDF3EC", text: "#346538" },
  64: { bg: "#FBF3DB", text: "#956400" },
  128: { bg: "#F0E6FF", text: "#5B2D8E" },
  256: { bg: "#FFE8E0", text: "#8B3A1A" },
  512: { bg: "#E0F7F0", text: "#1A6B5A" },
  1024: { bg: "#E6E0FF", text: "#3D2D6B" },
  2048: { bg: "#FFE0F0", text: "#6B1A4A" },
};

export function getBlockStyle(value: number) {
  return VALUE_COLORS[value] || { bg: "#111111", text: "#FFFFFF" };
}

export function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
  ctx.fill();
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
