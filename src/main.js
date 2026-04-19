const MAIN_STATES = {
  IDLE: "idle",
  SLEEP: "sleep",
};

const EYE_STATES = {
  OPEN: "open",
  LOW: "low",
  CLOSE: "close",
};

const MOUTH_STATES = {
  NORMAL: "normal",
  TONGUE: "tongue",
};

const PAW_FRAMES = {
  FRAME1: "frame1",
  FRAME2: "frame2",
};

const ASSETS = {
  shadow: "./assets/pet/shadow.png",
  body: "./assets/pet/body.png",
  tail: "./assets/pet/tail.png",
  tailCover: "./assets/pet/tail_cover.png",
  head: "./assets/pet/head.png",
  paws: {
    left: {
      [PAW_FRAMES.FRAME1]: "./assets/pet/flipper_front_left_1.png",
      [PAW_FRAMES.FRAME2]: "./assets/pet/flipper_front_left_2.png",
    },
    right: {
      [PAW_FRAMES.FRAME1]: "./assets/pet/flipper_front_right_1.png",
      [PAW_FRAMES.FRAME2]: "./assets/pet/flipper_front_right_2.png",
    },
  },
  eyes: {
    left: {
      [EYE_STATES.OPEN]: "./assets/pet/left_eye_open.png",
      [EYE_STATES.LOW]: "./assets/pet/left_eye_low.png",
      [EYE_STATES.CLOSE]: "./assets/pet/left_eye_close.png",
    },
    right: {
      [EYE_STATES.OPEN]: "./assets/pet/right_eye_open.png",
      [EYE_STATES.LOW]: "./assets/pet/right_eye_low.png",
      [EYE_STATES.CLOSE]: "./assets/pet/right_eye_close.png",
    },
  },
  mouths: {
    [MOUTH_STATES.NORMAL]: "./assets/pet/mouth_normal.png",
    [MOUTH_STATES.TONGUE]: "./assets/pet/mouth_tongue.png",
  },
  zzz: "./assets/pet/zzz.png",
};

const RANDOM_DELAY = { min: 3200, max: 6800 };
const SLEEP_DELAY = { min: 20000, max: 25000 };
const SLEEP_CHECK_INTERVAL = 1200;
const BLINK_STEP = 140;
const LOW_EYE_DURATION = 560;
const TONGUE_DURATION = 920;
const PAW_WAVE_DURATION = 420;
const TAIL_BOOST_DURATION = 520;
const WAKE_DURATION = 360;
const SLEEP_TRANSITION_DURATION = 1400;
const EYE_FOLLOW_LIMITS = { x: 3, y: 2 };
const HEAD_FOLLOW_LIMITS = { x: 1, y: 1, rotate: 1 };
const FOLLOW_LERP = 0.16;

const petState = {
  mainState: MAIN_STATES.IDLE,
  eyes: {
    left: EYE_STATES.OPEN,
    right: EYE_STATES.OPEN,
  },
  mouthState: MOUTH_STATES.NORMAL,
  pawFrame: PAW_FRAMES.FRAME1,
  lastInteractionAt: Date.now(),
  sleepAfterMs: randomBetween(SLEEP_DELAY.min, SLEEP_DELAY.max),
  isBusy: false,
  sleepPending: false,
  headLiftActive: false,
  tailBoostActive: false,
};

const timers = {
  random: null,
  sleepChecker: null,
  action: [],
};

const followState = {
  targetEyeX: 0,
  targetEyeY: 0,
  currentEyeX: 0,
  currentEyeY: 0,
  rafId: null,
};

const dom = {
  root: null,
  pet: null,
  scene: null,
  headTrack: null,
  pawLeft: null,
  pawRight: null,
  eyeLeft: null,
  eyeRight: null,
  mouth: null,
  zzz: null,
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  dom.root = document.getElementById("pet-root");

  if (!dom.root) {
    return;
  }

  try {
    await preloadAssets(collectAssetPaths());
    mountPet();
    resetInteractionClock();
    setIdlePose();
    renderPet();
    bindFollowEvents();
    startFollowLoop();
    startSleepChecker();
    scheduleRandomAction();
  } catch (error) {
    showFallback(error);
  }
}

function collectAssetPaths() {
  return [
    ASSETS.shadow,
    ASSETS.body,
    ASSETS.tail,
    ASSETS.tailCover,
    ASSETS.head,
    ...Object.values(ASSETS.paws.left),
    ...Object.values(ASSETS.paws.right),
    ...Object.values(ASSETS.eyes.left),
    ...Object.values(ASSETS.eyes.right),
    ...Object.values(ASSETS.mouths),
    ASSETS.zzz,
  ];
}

function mountPet() {
  dom.root.innerHTML = `
    <div class="pet-shell">
      <button id="pet" class="pet" type="button" aria-label="Interact with the seal">
        <span class="pet__scene">
          <img class="pet__layer pet__shadow" src="${ASSETS.shadow}" alt="" />
          <img class="pet__layer pet__body" src="${ASSETS.body}" alt="" />
          <img class="pet__layer pet__tail" src="${ASSETS.tail}" alt="" />
          <img class="pet__layer pet__tail-cover" src="${ASSETS.tailCover}" alt="" />
          <img id="pet-paw-left" class="pet__layer pet__paw pet__paw--left" src="${ASSETS.paws.left[PAW_FRAMES.FRAME1]}" alt="" />
          <img id="pet-paw-right" class="pet__layer pet__paw pet__paw--right" src="${ASSETS.paws.right[PAW_FRAMES.FRAME1]}" alt="" />
          <span class="pet__head-wrap">
            <span id="pet-head-track" class="pet__head-track">
              <img class="pet__layer pet__head" src="${ASSETS.head}" alt="" />
              <img id="pet-eye-left" class="pet__layer pet__eye pet__eye--left" src="${ASSETS.eyes.left[EYE_STATES.OPEN]}" alt="" />
              <img id="pet-eye-right" class="pet__layer pet__eye pet__eye--right" src="${ASSETS.eyes.right[EYE_STATES.OPEN]}" alt="" />
              <img id="pet-mouth" class="pet__layer pet__mouth" src="${ASSETS.mouths[MOUTH_STATES.NORMAL]}" alt="" />
            </span>
          </span>
          <img id="pet-zzz" class="pet__layer pet__zzz" src="${ASSETS.zzz}" alt="" hidden />
        </span>
      </button>
    </div>
  `;

  dom.pet = document.getElementById("pet");
  dom.scene = dom.pet.querySelector(".pet__scene");
  dom.headTrack = document.getElementById("pet-head-track");
  dom.pawLeft = document.getElementById("pet-paw-left");
  dom.pawRight = document.getElementById("pet-paw-right");
  dom.eyeLeft = document.getElementById("pet-eye-left");
  dom.eyeRight = document.getElementById("pet-eye-right");
  dom.mouth = document.getElementById("pet-mouth");
  dom.zzz = document.getElementById("pet-zzz");

  dom.pet.addEventListener("click", handleClick);
}

function renderPet() {
  if (!dom.pet) {
    return;
  }

  const sleeping = petState.mainState === MAIN_STATES.SLEEP;

  dom.eyeLeft.src = ASSETS.eyes.left[petState.eyes.left];
  dom.eyeRight.src = ASSETS.eyes.right[petState.eyes.right];
  dom.pawLeft.src = ASSETS.paws.left[petState.pawFrame];
  dom.pawRight.src = ASSETS.paws.right[petState.pawFrame];
  dom.mouth.src = ASSETS.mouths[petState.mouthState];

  dom.eyeLeft.hidden = false;
  dom.eyeRight.hidden = false;
  dom.mouth.hidden = false;
  dom.zzz.hidden = !sleeping;

  dom.pet.className = "pet";
  dom.pet.dataset.mainState = petState.mainState;
  dom.pet.classList.toggle("pet--head-lift", petState.headLiftActive);
  dom.pet.classList.toggle("pet--tail-boost", petState.tailBoostActive);
  dom.pet.classList.toggle("pet--busy", petState.isBusy);
  dom.pet.setAttribute(
    "aria-label",
    sleeping ? "Wake the seal" : "Interact with the seal"
  );

  applyFollowTransforms();
}

function setIdlePose(eyes = { left: EYE_STATES.OPEN, right: EYE_STATES.OPEN }) {
  petState.mainState = MAIN_STATES.IDLE;
  petState.sleepPending = false;
  petState.eyes.left = eyes.left;
  petState.eyes.right = eyes.right;
  petState.mouthState = MOUTH_STATES.NORMAL;
  petState.pawFrame = PAW_FRAMES.FRAME1;
  petState.headLiftActive = false;
  petState.tailBoostActive = false;
}

function setSleepPose() {
  petState.mainState = MAIN_STATES.SLEEP;
  petState.sleepPending = false;
  petState.eyes.left = EYE_STATES.LOW;
  petState.eyes.right = EYE_STATES.LOW;
  petState.mouthState = MOUTH_STATES.NORMAL;
  petState.pawFrame = PAW_FRAMES.FRAME1;
  petState.headLiftActive = false;
  petState.tailBoostActive = false;
}

function clearRandomTimer() {
  clearTimeout(timers.random);
  timers.random = null;
}

function clearActionTimers() {
  timers.action.forEach((timerId) => clearTimeout(timerId));
  timers.action = [];
}

function scheduleAction(callback, delay) {
  const timerId = window.setTimeout(callback, delay);
  timers.action.push(timerId);
  return timerId;
}

function resetInteractionClock() {
  petState.lastInteractionAt = Date.now();
  petState.sleepAfterMs = randomBetween(SLEEP_DELAY.min, SLEEP_DELAY.max);
}

function bindFollowEvents() {
  document.addEventListener("mousemove", handlePointerMove);
  document.addEventListener("mouseleave", resetFollowTargets);
  window.addEventListener("blur", resetFollowTargets);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      resetFollowTargets();
    }
  });
}

function startFollowLoop() {
  if (followState.rafId) {
    return;
  }

  const tick = () => {
    updateFollowState();
    followState.rafId = window.requestAnimationFrame(tick);
  };

  tick();
}

function handlePointerMove(event) {
  if (!dom.scene || !canTrackEyes()) {
    resetFollowTargets();
    return;
  }

  const rect = dom.scene.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const normalizedX = clamp((event.clientX - centerX) / (rect.width * 0.45), -1, 1);
  const normalizedY = clamp((event.clientY - centerY) / (rect.height * 0.42), -1, 1);

  followState.targetEyeX = normalizedX * EYE_FOLLOW_LIMITS.x;
  followState.targetEyeY = normalizedY * EYE_FOLLOW_LIMITS.y;
}

function resetFollowTargets() {
  followState.targetEyeX = 0;
  followState.targetEyeY = 0;
}

function canTrackEyes() {
  return (
    petState.mainState === MAIN_STATES.IDLE &&
    !petState.sleepPending &&
    petState.eyes.left !== EYE_STATES.CLOSE &&
    petState.eyes.right !== EYE_STATES.CLOSE
  );
}

function updateFollowState() {
  if (!canTrackEyes()) {
    resetFollowTargets();
  }

  followState.currentEyeX = lerp(
    followState.currentEyeX,
    followState.targetEyeX,
    FOLLOW_LERP
  );
  followState.currentEyeY = lerp(
    followState.currentEyeY,
    followState.targetEyeY,
    FOLLOW_LERP
  );

  if (Math.abs(followState.currentEyeX - followState.targetEyeX) < 0.01) {
    followState.currentEyeX = followState.targetEyeX;
  }

  if (Math.abs(followState.currentEyeY - followState.targetEyeY) < 0.01) {
    followState.currentEyeY = followState.targetEyeY;
  }

  applyFollowTransforms();
}

function applyFollowTransforms() {
  if (!dom.eyeLeft || !dom.eyeRight || !dom.headTrack) {
    return;
  }

  const eyeX = Number(followState.currentEyeX.toFixed(2));
  const eyeY = Number(followState.currentEyeY.toFixed(2));
  const headX = clamp(
    eyeX * (HEAD_FOLLOW_LIMITS.x / EYE_FOLLOW_LIMITS.x),
    -HEAD_FOLLOW_LIMITS.x,
    HEAD_FOLLOW_LIMITS.x
  );
  const headY = clamp(
    eyeY * (HEAD_FOLLOW_LIMITS.y / EYE_FOLLOW_LIMITS.y),
    -HEAD_FOLLOW_LIMITS.y,
    HEAD_FOLLOW_LIMITS.y
  );
  const headRotate = clamp(
    eyeX * (HEAD_FOLLOW_LIMITS.rotate / EYE_FOLLOW_LIMITS.x),
    -HEAD_FOLLOW_LIMITS.rotate,
    HEAD_FOLLOW_LIMITS.rotate
  );

  const eyeTransform = `translate(${eyeX}px, ${eyeY}px)`;
  dom.eyeLeft.style.transform = eyeTransform;
  dom.eyeRight.style.transform = eyeTransform;
  dom.headTrack.style.transform =
    `translate(${headX.toFixed(2)}px, ${headY.toFixed(2)}px) ` +
    `rotate(${headRotate.toFixed(2)}deg)`;
}

function inactivityExceeded() {
  return Date.now() - petState.lastInteractionAt >= petState.sleepAfterMs;
}

function prepareIdleAction() {
  clearRandomTimer();
  clearActionTimers();
  petState.isBusy = true;
  setIdlePose();
}

function finishIdleAction() {
  setIdlePose();
  petState.isBusy = false;
  renderPet();
  scheduleRandomAction();
}

function scheduleRandomAction() {
  if (
    petState.mainState !== MAIN_STATES.IDLE ||
    petState.isBusy ||
    petState.sleepPending
  ) {
    return;
  }

  clearRandomTimer();
  timers.random = window.setTimeout(
    runRandomAction,
    randomBetween(RANDOM_DELAY.min, RANDOM_DELAY.max)
  );
}

function runRandomAction() {
  if (
    petState.mainState !== MAIN_STATES.IDLE ||
    petState.isBusy ||
    petState.sleepPending
  ) {
    return;
  }

  if (inactivityExceeded()) {
    beginSleepSequence();
    return;
  }

  const roll = Math.random();

  if (roll < 0.3) {
    playEyeSequence([
      { delay: 0, left: EYE_STATES.CLOSE, right: EYE_STATES.CLOSE },
      { delay: BLINK_STEP, left: EYE_STATES.OPEN, right: EYE_STATES.OPEN },
      {
        delay: BLINK_STEP * 2 + 40,
        left: EYE_STATES.CLOSE,
        right: EYE_STATES.CLOSE,
      },
      {
        delay: BLINK_STEP * 3 + 40,
        left: EYE_STATES.OPEN,
        right: EYE_STATES.OPEN,
      },
    ]);
    return;
  }

  if (roll < 0.46) {
    playEyeSequence([
      { delay: 0, left: EYE_STATES.CLOSE, right: EYE_STATES.OPEN },
      { delay: BLINK_STEP, left: EYE_STATES.OPEN, right: EYE_STATES.OPEN },
    ]);
    return;
  }

  if (roll < 0.62) {
    playEyeSequence([
      { delay: 0, left: EYE_STATES.OPEN, right: EYE_STATES.CLOSE },
      { delay: BLINK_STEP, left: EYE_STATES.OPEN, right: EYE_STATES.OPEN },
    ]);
    return;
  }

  if (roll < 0.78) {
    playEyeSequence([
      { delay: 0, left: EYE_STATES.LOW, right: EYE_STATES.LOW },
      {
        delay: LOW_EYE_DURATION,
        left: EYE_STATES.OPEN,
        right: EYE_STATES.OPEN,
      },
    ]);
    return;
  }

  if (roll < 0.9) {
    playPawWave();
    return;
  }

  if (roll < 0.97) {
    playTongueAction(false);
    return;
  }

  playTailBoostAction();
}

function playEyeSequence(steps) {
  prepareIdleAction();

  const [firstStep, ...restSteps] = steps;
  petState.eyes.left = firstStep.left;
  petState.eyes.right = firstStep.right;
  renderPet();

  restSteps.forEach((step) => {
    scheduleAction(() => {
      petState.eyes.left = step.left;
      petState.eyes.right = step.right;
      renderPet();
    }, step.delay);
  });

  const totalDuration = steps[steps.length - 1].delay + 80;
  scheduleAction(finishIdleAction, totalDuration);
}

function playTongueAction(fromClick) {
  prepareIdleAction();

  petState.mouthState = MOUTH_STATES.TONGUE;
  petState.tailBoostActive = true;
  petState.headLiftActive = fromClick;
  petState.eyes.left = fromClick ? EYE_STATES.LOW : EYE_STATES.OPEN;
  petState.eyes.right = fromClick ? EYE_STATES.LOW : EYE_STATES.OPEN;
  petState.pawFrame = fromClick ? PAW_FRAMES.FRAME2 : PAW_FRAMES.FRAME1;
  renderPet();

  if (fromClick) {
    scheduleAction(() => {
      petState.pawFrame = PAW_FRAMES.FRAME1;
      renderPet();
    }, 120);

    scheduleAction(() => {
      petState.pawFrame = PAW_FRAMES.FRAME2;
      renderPet();
    }, 220);

    scheduleAction(() => {
      petState.eyes.left = EYE_STATES.OPEN;
      petState.eyes.right = EYE_STATES.OPEN;
      petState.pawFrame = PAW_FRAMES.FRAME1;
      renderPet();
    }, 320);
  }

  scheduleAction(finishIdleAction, TONGUE_DURATION);
}

function playPawWave() {
  prepareIdleAction();
  petState.pawFrame = PAW_FRAMES.FRAME2;
  renderPet();

  scheduleAction(() => {
    petState.pawFrame = PAW_FRAMES.FRAME1;
    renderPet();
  }, 120);

  scheduleAction(() => {
    petState.pawFrame = PAW_FRAMES.FRAME2;
    renderPet();
  }, 240);

  scheduleAction(() => {
    petState.pawFrame = PAW_FRAMES.FRAME1;
    renderPet();
  }, 360);

  scheduleAction(finishIdleAction, PAW_WAVE_DURATION);
}

function playTailBoostAction() {
  prepareIdleAction();
  petState.tailBoostActive = true;
  renderPet();
  scheduleAction(finishIdleAction, TAIL_BOOST_DURATION);
}

function beginSleepSequence() {
  if (
    petState.mainState === MAIN_STATES.SLEEP ||
    petState.sleepPending ||
    petState.isBusy
  ) {
    return;
  }

  clearRandomTimer();
  clearActionTimers();

  petState.isBusy = true;
  petState.sleepPending = true;
  petState.eyes.left = EYE_STATES.LOW;
  petState.eyes.right = EYE_STATES.LOW;
  petState.mouthState = MOUTH_STATES.NORMAL;
  petState.pawFrame = PAW_FRAMES.FRAME1;
  petState.headLiftActive = false;
  petState.tailBoostActive = false;
  renderPet();

  scheduleAction(() => {
    setSleepPose();
    petState.isBusy = false;
    renderPet();
  }, SLEEP_TRANSITION_DURATION);
}

function wakeUp() {
  clearRandomTimer();
  clearActionTimers();

  petState.isBusy = true;
  petState.mainState = MAIN_STATES.IDLE;
  petState.sleepPending = false;
  petState.eyes.left = EYE_STATES.LOW;
  petState.eyes.right = EYE_STATES.LOW;
  petState.mouthState = MOUTH_STATES.NORMAL;
  petState.pawFrame = PAW_FRAMES.FRAME2;
  petState.headLiftActive = true;
  petState.tailBoostActive = true;
  renderPet();

  scheduleAction(() => {
    petState.pawFrame = PAW_FRAMES.FRAME1;
    petState.eyes.left = EYE_STATES.OPEN;
    petState.eyes.right = EYE_STATES.OPEN;
    petState.headLiftActive = false;
    petState.tailBoostActive = false;
    petState.isBusy = false;
    renderPet();
    scheduleRandomAction();
  }, WAKE_DURATION);
}

function handleClick() {
  resetInteractionClock();

  if (petState.mainState === MAIN_STATES.SLEEP || petState.sleepPending) {
    wakeUp();
    return;
  }

  playTongueAction(true);
}

function startSleepChecker() {
  clearInterval(timers.sleepChecker);
  timers.sleepChecker = window.setInterval(() => {
    if (
      petState.mainState !== MAIN_STATES.IDLE ||
      petState.isBusy ||
      petState.sleepPending
    ) {
      return;
    }

    if (inactivityExceeded()) {
      beginSleepSequence();
    }
  }, SLEEP_CHECK_INTERVAL);
}

function preloadAssets(paths) {
  return Promise.all(paths.map(preloadImage));
}

function preloadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = resolve;
    image.onerror = () => reject(new Error(`Failed to load asset: ${src}`));
    image.src = src;
  });
}

function showFallback(error) {
  if (!dom.root) {
    return;
  }

  console.error(error);
  dom.root.innerHTML =
    '<p class="pet__fallback">Pet assets failed to load. Check the files in <code>assets/pet</code>.</p>';
}

function randomBetween(min, max) {
  return Math.round(min + Math.random() * (max - min));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function lerp(current, target, factor) {
  return current + (target - current) * factor;
}
