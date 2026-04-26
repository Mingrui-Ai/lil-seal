export const MAIN_STATES = {
  IDLE: "idle",
  SLEEP: "sleep",
};

export const EYE_STATES = {
  OPEN: "open",
  LOW: "low",
  CLOSE: "close",
  UPTURN: "upturn",
};

export const MOUTH_STATES = {
  NORMAL: "normal",
  TONGUE: "tongue",
  SPEAK1: "speak1",
  SPEAK2: "speak2",
  LAUGH: "laugh",
};

export const FLIPPER_FRAMES = {
  FRAME1: "frame1",
  FRAME2: "frame2",
};

export const SLEEP_DELAY = { min: 20000, max: 25000 };
export const SLEEP_CHECK_INTERVAL = 1200;
export const SLEEP_AUTO_WAKE_DELAY = { min: 8000, max: 20000 };
export const SLEEP_BUBBLE_CHARGE_WINDOW = 2000;
export const SLEEP_BUBBLE_ENTER_DURATION = 720;
export const SLEEP_BUBBLE_POP_FRAME_INTERVAL = 80;
export const SLEEP_BUBBLE_POP_DURATION = 440;
export const SLEEP_RECOVERY_DELAY = 1500;
export const EYE_FOLLOW_LIMITS = { x: 3, y: 2 };
export const EYE_FOLLOW_ACTIVATION_PADDING = 38;
export const HEAD_FOLLOW_LIMITS = { x: 1, y: 1, rotate: 1 };
export const FOLLOW_LERP = 0.16;

export const DEFAULT_POSITION = Object.freeze({
  strategy: "fixed",
  top: "auto",
  right: "auto",
  bottom: "clamp(16px, 3vw, 28px)",
  left: "clamp(16px, 3vw, 28px)",
  scale: 0.9,
  zIndex: 40,
});
