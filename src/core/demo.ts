import type { Landmark } from "../types";

const THUMB_TIP = 4;
const INDEX_TIP = 8;
const MIDDLE_MCP = 9;

export function makeDemoStream(): MediaStream {
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const context = canvas.getContext("2d");
  if (!context || !canvas.captureStream) throw new Error("This browser does not support Demo mode.");

  const paint = () => {
    const time = performance.now() / 1000;
    const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, "#172554");
    gradient.addColorStop(1, "#4c1d95");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < 8; index += 1) {
      const x = canvas.width * (0.1 + index * 0.115) + Math.sin(time * 0.8 + index) * 58;
      const y = canvas.height * 0.5 + Math.cos(time * 0.6 + index * 1.7) * 160;
      context.beginPath();
      context.arc(x, y, 42 + 18 * Math.sin(time + index), 0, Math.PI * 2);
      context.fillStyle = `hsl(${(index * 52 + time * 30) % 360}, 78%, 62%)`;
      context.fill();
    }
    context.save();
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.fillStyle = "rgba(255,255,255,.9)";
    context.font = "700 54px system-ui";
    context.textAlign = "center";
    context.fillText("DEMO FEED", canvas.width / 2, canvas.height / 2);
    context.restore();
    requestAnimationFrame(paint);
  };
  paint();
  return canvas.captureStream(30);
}

function fakeHand(index: Landmark, thumb: Landmark, middle: Landmark): Landmark[] {
  const landmarks: Landmark[] = Array.from({ length: 21 }, () => ({ ...middle, z: 0 }));
  landmarks[INDEX_TIP] = index;
  landmarks[THUMB_TIP] = thumb;
  landmarks[MIDDLE_MCP] = middle;
  return landmarks;
}

export function fakeHands(time: number): Landmark[][] {
  const offsetX = Math.sin(time * 0.9) * 0.02;
  const offsetY = Math.cos(time * 0.7) * 0.02;
  return [
    fakeHand(
      { x: 0.74 + offsetX, y: 0.26 + offsetY },
      { x: 0.8 + offsetX, y: 0.56 + offsetY },
      { x: 0.75 + offsetX, y: 0.4 + offsetY },
    ),
    fakeHand(
      { x: 0.26 - offsetX, y: 0.28 - offsetY },
      { x: 0.2 - offsetX, y: 0.58 - offsetY },
      { x: 0.25 - offsetX, y: 0.44 - offsetY },
    ),
  ];
}
