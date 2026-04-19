import {
  BLINK_STEP,
  DEFAULT_POSITION,
  EYE_FOLLOW_LIMITS,
  EYE_STATES,
  FOLLOW_LERP,
  HEAD_FOLLOW_LIMITS,
  LOW_EYE_DURATION,
  MAIN_STATES,
  MOUTH_STATES,
  PAW_FRAMES,
  PAW_WAVE_DURATION,
  RANDOM_DELAY,
  SLEEP_CHECK_INTERVAL,
  SLEEP_DELAY,
  SLEEP_TRANSITION_DURATION,
  TAIL_BOOST_DURATION,
  TONGUE_DURATION,
  WAKE_DURATION,
} from "./constants.js";
import { collectAssetPaths, createAssetMap } from "./assets.js";
import { createPetMarkup } from "./template.js";

const DEFAULT_LABELS = Object.freeze({
  idle: "Interact with the seal",
  sleep: "Wake the seal",
});

function createPetState() {
  return {
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
}

function createTimerState() {
  return {
    random: null,
    sleepChecker: null,
    action: new Set(),
  };
}

function createFollowState() {
  return {
    targetEyeX: 0,
    targetEyeY: 0,
    currentEyeX: 0,
    currentEyeY: 0,
    rafId: null,
  };
}

function createDomRefs() {
  return {
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
}

export function createPet(options = {}) {
  const settings = {
    assetBase: options.assetBase,
    hidden: Boolean(options.hidden),
    labels: {
      idle: options.labels?.idle ?? DEFAULT_LABELS.idle,
      sleep: options.labels?.sleep ?? DEFAULT_LABELS.sleep,
    },
    position: normalizePosition(options.position),
  };

  let mountTarget = null;
  let mountSession = null;
  let dom = createDomRefs();
  let petState = createPetState();
  let timers = createTimerState();
  let followState = createFollowState();
  let listeners = [];
  let assets = createAssetMap(settings.assetBase);
  let readyPromise;

  const controller = {
    mount(target) {
      readyPromise = performMount(target ?? mountTarget ?? options.mount);
      return readyPromise;
    },
    destroy() {
      teardown();
      return controller;
    },
    show() {
      settings.hidden = false;
      applyVisibility();
      return controller;
    },
    hide() {
      settings.hidden = true;
      resetFollowTargets();
      applyVisibility();
      return controller;
    },
    setPosition(nextPosition = {}) {
      settings.position = normalizePosition({
        ...settings.position,
        ...nextPosition,
      });
      applyPositionStyles();
      return controller;
    },
    get element() {
      return dom.root;
    },
    get mounted() {
      return Boolean(dom.root && dom.root.isConnected);
    },
    get ready() {
      return readyPromise;
    },
  };

  readyPromise = Promise.resolve(controller);

  if (options.mount) {
    controller.mount(options.mount);
  }

  return controller;

  async function performMount(target) {
    const resolvedTarget = resolveMountTarget(target);
    teardown();

    mountTarget = resolvedTarget;
    mountSession = Symbol("pet-mount");
    const currentSession = mountSession;
    petState = createPetState();
    timers = createTimerState();
    followState = createFollowState();
    dom = createDomRefs();
    assets = createAssetMap(settings.assetBase);

    dom.root = document.createElement("div");
    dom.root.className = "pet-host";
    dom.root.setAttribute("aria-live", "polite");
    applyPositionStyles();
    applyVisibility();
    mountTarget.append(dom.root);

    try {
      await preloadAssets(collectAssetPaths(assets));

      if (mountSession !== currentSession || !dom.root) {
        return controller;
      }

      dom.root.innerHTML = createPetMarkup(assets, settings.labels);
      cacheDomRefs();
      bindEvents();
      resetInteractionClock();
      setIdlePose();
      renderPet();
      startFollowLoop();
      startSleepChecker();
      scheduleRandomAction();
    } catch (error) {
      if (mountSession === currentSession && dom.root) {
        showFallback(error);
      }
    }

    return controller;
  }

  function cacheDomRefs() {
    dom.pet = dom.root.querySelector('[data-part="pet"]');
    dom.scene = dom.root.querySelector('[data-part="scene"]');
    dom.headTrack = dom.root.querySelector('[data-part="head-track"]');
    dom.pawLeft = dom.root.querySelector('[data-part="paw-left"]');
    dom.pawRight = dom.root.querySelector('[data-part="paw-right"]');
    dom.eyeLeft = dom.root.querySelector('[data-part="eye-left"]');
    dom.eyeRight = dom.root.querySelector('[data-part="eye-right"]');
    dom.mouth = dom.root.querySelector('[data-part="mouth"]');
    dom.zzz = dom.root.querySelector('[data-part="zzz"]');
  }

  function bindEvents() {
    addListener(dom.pet, "click", handleClick);
    addListener(document, "mousemove", handlePointerMove);
    addListener(document, "mouseleave", resetFollowTargets);
    addListener(window, "blur", resetFollowTargets);
    addListener(document, "visibilitychange", handleVisibilityChange);
  }

  function addListener(target, type, handler, options) {
    if (!target) {
      return;
    }

    target.addEventListener(type, handler, options);
    listeners.push(() => target.removeEventListener(type, handler, options));
  }

  function removeListeners() {
    listeners.forEach((cleanup) => cleanup());
    listeners = [];
  }

  function handleVisibilityChange() {
    if (document.hidden) {
      resetFollowTargets();
    }
  }

  function renderPet() {
    if (!dom.pet) {
      return;
    }

    const sleeping = petState.mainState === MAIN_STATES.SLEEP;

    dom.eyeLeft.src = assets.eyes.left[petState.eyes.left];
    dom.eyeRight.src = assets.eyes.right[petState.eyes.right];
    dom.pawLeft.src = assets.paws.left[petState.pawFrame];
    dom.pawRight.src = assets.paws.right[petState.pawFrame];
    dom.mouth.src = assets.mouths[petState.mouthState];

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
      sleeping ? settings.labels.sleep : settings.labels.idle
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
    timers.action.clear();
  }

  function scheduleAction(callback, delay) {
    const timerId = window.setTimeout(() => {
      timers.action.delete(timerId);
      callback();
    }, delay);

    timers.action.add(timerId);
    return timerId;
  }

  function resetInteractionClock() {
    petState.lastInteractionAt = Date.now();
    petState.sleepAfterMs = randomBetween(SLEEP_DELAY.min, SLEEP_DELAY.max);
  }

  function startFollowLoop() {
    if (followState.rafId) {
      return;
    }

    const tick = () => {
      updateFollowState();
      followState.rafId = window.requestAnimationFrame(tick);
    };

    followState.rafId = window.requestAnimationFrame(tick);
  }

  function stopFollowLoop() {
    if (followState.rafId) {
      window.cancelAnimationFrame(followState.rafId);
      followState.rafId = null;
    }
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
      !settings.hidden &&
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
      settings.hidden ||
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
      settings.hidden ||
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
        settings.hidden ||
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

  function applyVisibility() {
    if (dom.root) {
      dom.root.hidden = settings.hidden;
    }
  }

  function applyPositionStyles() {
    if (!dom.root) {
      return;
    }

    dom.root.style.setProperty("--pet-layer-position", settings.position.strategy);
    dom.root.style.setProperty("--pet-offset-top", settings.position.top);
    dom.root.style.setProperty("--pet-offset-right", settings.position.right);
    dom.root.style.setProperty("--pet-offset-bottom", settings.position.bottom);
    dom.root.style.setProperty("--pet-offset-left", settings.position.left);
    dom.root.style.setProperty("--pet-scale", String(settings.position.scale));
    dom.root.style.setProperty("--pet-z-index", String(settings.position.zIndex));
  }

  function showFallback(error) {
    console.error(error);
    dom.root.innerHTML =
      '<p class="pet__fallback">Pet assets failed to load. Check <code>assets/pet</code>.</p>';
  }

  function teardown() {
    mountSession = null;
    clearRandomTimer();
    clearActionTimers();
    clearInterval(timers.sleepChecker);
    timers.sleepChecker = null;
    stopFollowLoop();
    removeListeners();

    if (dom.root) {
      dom.root.remove();
    }

    mountTarget = null;
    dom = createDomRefs();
    petState = createPetState();
    timers = createTimerState();
    followState = createFollowState();
  }
}

function resolveMountTarget(target) {
  if (typeof target === "string") {
    const resolved = document.querySelector(target);

    if (!resolved) {
      throw new Error(`Cannot find mount target: ${target}`);
    }

    return resolved;
  }

  if (target instanceof Element) {
    return target;
  }

  throw new Error("A valid mount target is required to initialize the pet.");
}

function normalizePosition(position = {}) {
  return {
    strategy: position.strategy === "absolute" ? "absolute" : DEFAULT_POSITION.strategy,
    top: normalizeInset(position.top, DEFAULT_POSITION.top),
    right: normalizeInset(position.right, DEFAULT_POSITION.right),
    bottom: normalizeInset(position.bottom, DEFAULT_POSITION.bottom),
    left: normalizeInset(position.left, DEFAULT_POSITION.left),
    scale: normalizeNumber(position.scale, DEFAULT_POSITION.scale),
    zIndex: normalizeNumber(position.zIndex, DEFAULT_POSITION.zIndex),
  };
}

function normalizeInset(value, fallback) {
  if (typeof value === "number") {
    return `${value}px`;
  }

  if (typeof value === "string" && value.trim()) {
    return value;
  }

  return fallback;
}

function normalizeNumber(value, fallback) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
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

function randomBetween(min, max) {
  return Math.round(min + Math.random() * (max - min));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function lerp(current, target, factor) {
  return current + (target - current) * factor;
}

export default createPet;
