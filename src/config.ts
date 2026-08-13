import type { LocalEffectId, LucyEffectId, VideoStyleId } from "./types";

export const MEDIAPIPE_VERSION = "0.10.14";
export const MEDIAPIPE_WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
export const MEDIAPIPE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
export const DECART_SDK_URL = "https://esm.sh/@decartai/sdk@0.1.17";
export const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
export const GEMINI_MODEL = "gemini-omni-flash-preview";
export const MAX_VIDEO_BYTES = 15 * 1024 * 1024;

export const LOCAL_EFFECTS: Array<{ id: LocalEffectId; label: string }> = [
  { id: "pixelate", label: "Pixelate" },
  { id: "blur", label: "Soft focus" },
  { id: "invert", label: "Invert" },
  { id: "noir", label: "Noir" },
  { id: "glitch", label: "Glitch" },
  { id: "toon", label: "Toon" },
  { id: "vangogh", label: "Van Gogh" },
];

export const LUCY_EFFECTS: Array<{ id: LucyEffectId; label: string; prompt?: string }> = [
  {
    id: "movie3d",
    label: "3D movie",
    prompt:
      "Change the style of the video to a 3D animated movie: stylized CGI animation, the person as an animated character with expressive big eyes and soft cinematic lighting.",
  },
  {
    id: "anime",
    label: "Anime",
    prompt:
      "Change the style of the video to hand-drawn anime: clean black line art, flat cel shading, vibrant colors, and large expressive eyes.",
  },
  {
    id: "cyberpunk",
    label: "Cyberpunk",
    prompt:
      "Change the style of the video to neon cyberpunk: glowing pink and cyan neon light, rain-slick reflective surfaces, and holographic signs in the background.",
  },
  {
    id: "watercolor",
    label: "Watercolor",
    prompt:
      "Change the style of the video to a watercolor painting: soft loose brushstrokes, gentle color bleeds, visible paper texture, and a muted pastel palette.",
  },
  {
    id: "lego",
    label: "LEGO",
    prompt:
      "Change the style of the video to a LEGO stop-motion animation: the person is a yellow LEGO minifigure and the room is built from glossy plastic LEGO bricks with visible studs.",
  },
  { id: "custom", label: "Custom ✨" },
];

export const VIDEO_STYLES: Array<{ id: VideoStyleId; label: string; prompt?: string }> = [
  {
    id: "movie3d",
    label: "3D movie",
    prompt:
      "Transform the person into a 3D animated movie character with a stylized CGI animation look, expressive eyes, and soft lighting.",
  },
  {
    id: "anime",
    label: "Anime",
    prompt:
      "Redraw the video as hand-drawn anime with clean line art, cel shading, and vibrant colors.",
  },
  {
    id: "clay",
    label: "Clay animation",
    prompt: "Transform the scene into claymation stop-motion with visible clay texture.",
  },
  {
    id: "watercolor",
    label: "Watercolor",
    prompt:
      "Repaint the video as a soft watercolor painting with loose brushwork and paper texture.",
  },
  { id: "custom", label: "Custom" },
];

export const PROMPT_SUFFIX =
  " This is a strict pixel-aligned edit of the source video: keep the same pose, motion, timing, clothing colors, and background. The camera must not change — no zoom, no crop, no recentering, and no change to the field of view. The person's face and body must stay at exactly the same position and size in the frame as the source: eyes, nose, and mouth must remain at the same screen coordinates in every frame. Match the facial expression exactly, frame by frame: preserve the exact degree of mouth openness at every moment — if the mouth is slightly open and still, keep it slightly open and still; do not close it, and do not add talking or any mouth movement that is not in the source. Mirror blinks, gaze direction, and eyebrow position at the same moments as the source. Change only the visual style, nothing about the geometry, composition, or performance.";
