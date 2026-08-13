import type { Point } from "../types";

export function drawMirrored(
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  width: number,
  height: number,
): void {
  context.save();
  context.translate(width, 0);
  context.scale(-1, 1);
  context.drawImage(source, 0, 0, width, height);
  context.restore();
}

export function drawQuadPath(context: CanvasRenderingContext2D, quad: Point[]): void {
  const first = quad[0];
  if (!first) return;
  context.beginPath();
  context.moveTo(first.x, first.y);
  for (const point of quad.slice(1)) context.lineTo(point.x, point.y);
  context.closePath();
}

export function drawFrameOutline(
  context: CanvasRenderingContext2D,
  quad: Point[],
  presence: number,
  time: number,
): void {
  context.save();
  context.globalAlpha = presence;
  drawQuadPath(context, quad);
  context.setLineDash([10, 8]);
  context.lineDashOffset = -time * 40;
  context.lineWidth = 2;
  context.strokeStyle = "rgba(255,255,255,0.95)";
  context.shadowColor = "rgba(0,0,0,0.55)";
  context.shadowBlur = 6;
  context.stroke();
  context.setLineDash([]);
  context.lineDashOffset = 0;
  context.shadowBlur = 0;

  quad.forEach((point, index) => {
    const radius = 7 + Math.sin(time * 3 + index * 1.5) * 1.5;
    const halo = (time * 0.8 + index * 0.25) % 1;
    context.beginPath();
    context.arc(point.x, point.y, radius + halo * 14, 0, Math.PI * 2);
    context.strokeStyle = `rgba(255,255,255,${0.5 * (1 - halo) * presence})`;
    context.lineWidth = 2;
    context.stroke();
    context.beginPath();
    context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    context.fillStyle = "#fff";
    context.fill();
    context.strokeStyle = "rgba(0,0,0,0.25)";
    context.lineWidth = 1.5;
    context.stroke();
  });
  context.restore();
}

export function averagePoint(quad: Point[]): Point {
  return quad.reduce(
    (center, point) => ({
      x: center.x + point.x / quad.length,
      y: center.y + point.y / quad.length,
    }),
    { x: 0, y: 0 },
  );
}
