import { EYE_STATES, MOUTH_STATES, PAW_FRAMES } from "./constants.js";

const DEFAULT_ASSET_BASE = new URL("../../assets/pet/", import.meta.url);

const FILES = Object.freeze({
  shadow: "shadow.png",
  body: "body.png",
  tail: "tail.png",
  tailCover: "tail_cover.png",
  head: "head.png",
  pawLeft1: "flipper_front_left_1.png",
  pawLeft2: "flipper_front_left_2.png",
  pawRight1: "flipper_front_right_1.png",
  pawRight2: "flipper_front_right_2.png",
  leftEyeOpen: "left_eye_open.png",
  leftEyeLow: "left_eye_low.png",
  leftEyeClose: "left_eye_close.png",
  rightEyeOpen: "right_eye_open.png",
  rightEyeLow: "right_eye_low.png",
  rightEyeClose: "right_eye_close.png",
  mouthNormal: "mouth_normal.png",
  mouthTongue: "mouth_tongue.png",
  zzz: "zzz.png",
});

export function createAssetMap(assetBase) {
  const baseUrl = resolveBaseUrl(assetBase);
  const resolve = (file) => new URL(file, baseUrl).href;

  return {
    shadow: resolve(FILES.shadow),
    body: resolve(FILES.body),
    tail: resolve(FILES.tail),
    tailCover: resolve(FILES.tailCover),
    head: resolve(FILES.head),
    paws: {
      left: {
        [PAW_FRAMES.FRAME1]: resolve(FILES.pawLeft1),
        [PAW_FRAMES.FRAME2]: resolve(FILES.pawLeft2),
      },
      right: {
        [PAW_FRAMES.FRAME1]: resolve(FILES.pawRight1),
        [PAW_FRAMES.FRAME2]: resolve(FILES.pawRight2),
      },
    },
    eyes: {
      left: {
        [EYE_STATES.OPEN]: resolve(FILES.leftEyeOpen),
        [EYE_STATES.LOW]: resolve(FILES.leftEyeLow),
        [EYE_STATES.CLOSE]: resolve(FILES.leftEyeClose),
      },
      right: {
        [EYE_STATES.OPEN]: resolve(FILES.rightEyeOpen),
        [EYE_STATES.LOW]: resolve(FILES.rightEyeLow),
        [EYE_STATES.CLOSE]: resolve(FILES.rightEyeClose),
      },
    },
    mouths: {
      [MOUTH_STATES.NORMAL]: resolve(FILES.mouthNormal),
      [MOUTH_STATES.TONGUE]: resolve(FILES.mouthTongue),
    },
    zzz: resolve(FILES.zzz),
  };
}

export function collectAssetPaths(assets) {
  return [
    assets.shadow,
    assets.body,
    assets.tail,
    assets.tailCover,
    assets.head,
    ...Object.values(assets.paws.left),
    ...Object.values(assets.paws.right),
    ...Object.values(assets.eyes.left),
    ...Object.values(assets.eyes.right),
    ...Object.values(assets.mouths),
    assets.zzz,
  ];
}

function resolveBaseUrl(assetBase) {
  if (!assetBase) {
    return DEFAULT_ASSET_BASE;
  }

  if (assetBase instanceof URL) {
    return assetBase;
  }

  const base = typeof document !== "undefined" ? document.baseURI : import.meta.url;
  return new URL(assetBase, base);
}
