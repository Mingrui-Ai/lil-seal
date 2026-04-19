export const MAIN_STATES = {
  IDLE: "idle",
  SLEEP: "sleep",
};

export const EYE_STATES = {
  OPEN: "open",
  LOW: "low",
  CLOSE: "close",
};

export const MOUTH_STATES = {
  NORMAL: "normal",
  TONGUE: "tongue",
};

export const PAW_FRAMES = {
  FRAME1: "frame1",
  FRAME2: "frame2",
};

export const RANDOM_DELAY = { min: 3200, max: 6800 };
export const SLEEP_DELAY = { min: 20000, max: 25000 };
export const SLEEP_CHECK_INTERVAL = 1200;
export const BLINK_STEP = 140;
export const LOW_EYE_DURATION = 560;
export const TONGUE_DURATION = 920;
export const PAW_WAVE_DURATION = 420;
export const TAIL_BOOST_DURATION = 520;
export const WAKE_DURATION = 360;
export const SLEEP_TRANSITION_DURATION = 1400;
export const EYE_FOLLOW_LIMITS = { x: 3, y: 2 };
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
