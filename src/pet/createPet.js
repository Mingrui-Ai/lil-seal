import {
  DEFAULT_POSITION,
  EYE_FOLLOW_LIMITS,
  EYE_STATES,
  FLIPPER_FRAMES,
  FOLLOW_LERP,
  HEAD_FOLLOW_LIMITS,
  MAIN_STATES,
  MOUTH_STATES,
  SLEEP_AUTO_WAKE_DELAY,
  SLEEP_BUBBLE_CHARGE_WINDOW,
  SLEEP_BUBBLE_ENTER_DURATION,
  SLEEP_BUBBLE_POP_FRAME_INTERVAL,
  SLEEP_BUBBLE_POP_DURATION,
  SLEEP_CHECK_INTERVAL,
  SLEEP_DELAY,
  SLEEP_RECOVERY_DELAY,
} from "./constants.js";
import { collectAssetPaths, loadPetCatalog } from "./assets.js";
import { createPetMarkup } from "./template.js";

const DEFAULT_LABELS = Object.freeze({
  idle: "Interact with the seal",
  sleep: "Wake the seal",
});

const DEFAULT_RANDOM_DELAY = Object.freeze({ min: 3200, max: 6800 });
const WAKE_BLINK_DELAY = 560;
const WAKE_BLINK_DURATION = 280;
const SPEECH_PUNCTUATION = new Set([
  ",",
  ".",
  "!",
  "?",
  ";",
  ":",
  "，",
  "。",
  "！",
  "？",
  "；",
  "：",
  "、",
]);
const SPEECH_PUNCTUATION_PAUSE = 300;
const SPEECH_PROFILES = Object.freeze({
  normal: {
    min: 80,
    max: 150,
    frames: [
      MOUTH_STATES.NORMAL,
      MOUTH_STATES.SPEAK1,
      MOUTH_STATES.SPEAK2,
      MOUTH_STATES.SPEAK1,
      MOUTH_STATES.NORMAL,
    ],
  },
  excited: {
    min: 60,
    max: 110,
    frames: [
      MOUTH_STATES.SPEAK1,
      MOUTH_STATES.SPEAK2,
      MOUTH_STATES.SPEAK1,
      MOUTH_STATES.SPEAK2,
      MOUTH_STATES.NORMAL,
    ],
  },
  soft: {
    min: 140,
    max: 230,
    frames: [
      MOUTH_STATES.NORMAL,
      MOUTH_STATES.SPEAK1,
      MOUTH_STATES.NORMAL,
      MOUTH_STATES.SPEAK1,
      MOUTH_STATES.SPEAK2,
    ],
  },
  surprised: {
    min: 220,
    max: 320,
    frames: [MOUTH_STATES.SPEAK2],
  },
});

function createPetState() {
  return {
    mainState: MAIN_STATES.IDLE,
    eyes: {
      left: EYE_STATES.OPEN,
      right: EYE_STATES.OPEN,
    },
    mouthState: MOUTH_STATES.NORMAL,
    flipperFrame: FLIPPER_FRAMES.FRAME1,
    lastInteractionAt: Date.now(),
    sleepAfterMs: randomBetween(SLEEP_DELAY.min, SLEEP_DELAY.max),
    isBusy: false,
    sleepPending: false,
    headLiftActive: false,
    tailBoostActive: false,
    specialEyes: null,
    cheeksVisible: false,
    bubble: null,
    sleepBubblePhase: null,
    sleepVisual: null,
    effect: null,
    poseFrame: null,
    voicePulseActive: false,
    wakeJoltActive: false,
  };
}

function createSpeechState() {
  return {
    active: false,
    continuous: true,
    displayText: "",
    frameIndex: 0,
    mode: "normal",
    onFinish: null,
    onText: null,
    text: "",
    textIndex: 0,
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
    flipperLeft: null,
    flipperRight: null,
    eyeLeft: null,
    eyeRight: null,
    specialEyes: null,
    cheekLeft: null,
    cheekRight: null,
    mouth: null,
    bubble: null,
    effect: null,
    zzz: null,
    pose: null,
    standardLayers: [],
  };
}

export function createPet(options = {}) {
  const settings = {
    assetBase: options.assetBase,
    assetManifest: options.assetManifest,
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
  let assets = null;
  let actions = {};
  let activeLoopAction = null;
  let speechState = createSpeechState();
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
      scheduleRandomAction();
      return controller;
    },
    hide() {
      settings.hidden = true;
      resetFollowTargets();
      stopLoopingAction({ render: false, schedule: false });
      clearRandomTimer();
      applyVisibility();
      return controller;
    },
    play(actionId) {
      return playNamedAction(actionId);
    },
    talk(options = {}) {
      return toggleSpeech(options);
    },
    say(text, options = {}) {
      return startSpeech({
        ...options,
        continuous: false,
        text,
      });
    },
    stopAction() {
      stopLoopingAction();
      return controller;
    },
    sleep() {
      resetInteractionClock();
      beginSleepSequence({ force: true });
      return controller;
    },
    wake() {
      resetInteractionClock();
      wakeFromSleep();
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
    assets = null;
    actions = {};
    activeLoopAction = null;
    speechState = createSpeechState();

    dom.root = document.createElement("div");
    dom.root.className = "pet-host";
    dom.root.setAttribute("aria-live", "polite");
    applyPositionStyles();
    applyVisibility();
    mountTarget.append(dom.root);

    try {
      const catalog = await loadPetCatalog({
        assetBase: settings.assetBase,
        assetManifest: settings.assetManifest,
      });

      assets = catalog.assets;
      actions = catalog.actions;
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
    dom.flipperLeft = dom.root.querySelector('[data-part="flipper-left"]');
    dom.flipperRight = dom.root.querySelector('[data-part="flipper-right"]');
    dom.eyeLeft = dom.root.querySelector('[data-part="eye-left"]');
    dom.eyeRight = dom.root.querySelector('[data-part="eye-right"]');
    dom.specialEyes = dom.root.querySelector('[data-part="special-eyes"]');
    dom.cheekLeft = dom.root.querySelector('[data-part="cheek-left"]');
    dom.cheekRight = dom.root.querySelector('[data-part="cheek-right"]');
    dom.mouth = dom.root.querySelector('[data-part="mouth"]');
    dom.bubble = dom.root.querySelector('[data-part="bubble"]');
    dom.effect = dom.root.querySelector('[data-part="effect"]');
    dom.zzz = dom.root.querySelector('[data-part="zzz"]');
    dom.pose = dom.root.querySelector('[data-part="pose"]');
    dom.standardLayers = Array.from(dom.root.querySelectorAll('[data-layer="standard"]'));
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
    if (!dom.pet || !assets) {
      return;
    }

    const sleeping = petState.mainState === MAIN_STATES.SLEEP;
    const specialEyeSrc = petState.specialEyes
      ? assets.eyes.special?.[petState.specialEyes]
      : null;
    const effectSrc = petState.effect ? assets.effects?.[petState.effect] : null;
    const bubbleSrc = petState.bubble ? assets.effects?.[petState.bubble] : null;
    const poseSrc = petState.poseFrame ? assets.poses?.[petState.poseFrame] : null;
    const poseActive = Boolean(poseSrc);

    setImage(dom.eyeLeft, assets.eyes.left[petState.eyes.left], Boolean(specialEyeSrc));
    setImage(dom.eyeRight, assets.eyes.right[petState.eyes.right], Boolean(specialEyeSrc));
    setImage(dom.specialEyes, specialEyeSrc, !specialEyeSrc);
    setImage(dom.flipperLeft, assets.flippers.left[petState.flipperFrame]);
    setImage(dom.flipperRight, assets.flippers.right[petState.flipperFrame]);
    setImage(dom.mouth, assets.mouths[petState.mouthState] ?? assets.mouths.normal);
    setImage(dom.cheekLeft, assets.cheeks.blushLeft, !petState.cheeksVisible);
    setImage(dom.cheekRight, assets.cheeks.blushRight, !petState.cheeksVisible);
    setImage(dom.bubble, bubbleSrc, poseActive || !bubbleSrc);
    setImage(dom.effect, effectSrc, poseActive || !effectSrc);
    setImage(dom.pose, poseSrc, !poseActive);

    dom.zzz.hidden = poseActive || !sleeping || petState.sleepVisual !== "zzz";
    applyStandardLayerVisibility(poseActive);
    dom.pet.className = "pet";
    dom.pet.dataset.mainState = petState.mainState;
    dom.pet.classList.toggle("pet--head-lift", petState.headLiftActive);
    dom.pet.classList.toggle("pet--tail-boost", petState.tailBoostActive);
    dom.pet.classList.toggle("pet--busy", petState.isBusy);
    dom.pet.classList.toggle("pet--talking", speechState.active);
    dom.pet.classList.toggle("pet--voice-pop", petState.voicePulseActive);
    dom.pet.classList.toggle("pet--wake-jolt", petState.wakeJoltActive);
    if (petState.sleepBubblePhase) {
      dom.pet.dataset.sleepBubblePhase = petState.sleepBubblePhase;
    } else {
      delete dom.pet.dataset.sleepBubblePhase;
    }
    dom.pet.setAttribute(
      "aria-label",
      sleeping ? settings.labels.sleep : settings.labels.idle
    );

    applyFollowTransforms();
  }

  function setImage(element, src, hidden = false) {
    if (!element) {
      return;
    }

    if (src) {
      element.src = src;
    }

    element.hidden = hidden;
  }

  function applyStandardLayerVisibility(hidden) {
    dom.standardLayers.forEach((layer) => {
      layer.hidden = hidden;
    });
  }

  function setIdlePose(eyes = { left: EYE_STATES.OPEN, right: EYE_STATES.OPEN }) {
    petState.mainState = MAIN_STATES.IDLE;
    petState.sleepPending = false;
    petState.eyes.left = eyes.left;
    petState.eyes.right = eyes.right;
    petState.mouthState = MOUTH_STATES.NORMAL;
    petState.flipperFrame = FLIPPER_FRAMES.FRAME1;
    petState.headLiftActive = false;
    petState.tailBoostActive = false;
    petState.specialEyes = null;
    petState.cheeksVisible = false;
    petState.bubble = null;
    petState.sleepBubblePhase = null;
    petState.sleepVisual = null;
    petState.effect = null;
    petState.poseFrame = null;
    petState.voicePulseActive = false;
    petState.wakeJoltActive = false;
  }

  function applyPose(pose = {}) {
    if (hasOwn(pose, "mainState")) {
      petState.mainState = pose.mainState;
    }

    if (hasOwn(pose, "sleepPending")) {
      petState.sleepPending = Boolean(pose.sleepPending);
    }

    if (pose.eyes) {
      petState.eyes.left = pose.eyes.left ?? petState.eyes.left;
      petState.eyes.right = pose.eyes.right ?? petState.eyes.right;
    }

    if (hasOwn(pose, "mouth")) {
      petState.mouthState = pose.mouth ?? MOUTH_STATES.NORMAL;
    }

    if (hasOwn(pose, "flipperFrame")) {
      petState.flipperFrame = pose.flipperFrame ?? FLIPPER_FRAMES.FRAME1;
    }

    if (hasOwn(pose, "headLift")) {
      petState.headLiftActive = Boolean(pose.headLift);
    }

    if (hasOwn(pose, "tailBoost")) {
      petState.tailBoostActive = Boolean(pose.tailBoost);
    }

    if (hasOwn(pose, "specialEyes")) {
      petState.specialEyes = pose.specialEyes;
    }

    if (hasOwn(pose, "cheeks")) {
      petState.cheeksVisible = Boolean(pose.cheeks);
    }

    if (hasOwn(pose, "effect")) {
      petState.effect = pose.effect;
    }

    if (hasOwn(pose, "bubble")) {
      petState.bubble = pose.bubble;
    }

    if (hasOwn(pose, "poseFrame")) {
      petState.poseFrame = pose.poseFrame;
    }
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
      !petState.specialEyes &&
      !petState.poseFrame &&
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
    activeLoopAction = null;
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

  function playPoseSequence(action, onFinish) {
    runPoseSteps(action);
    scheduleAction(onFinish, getActionDuration(action));
  }

  function runPoseSteps(action) {
    const steps = Array.isArray(action?.steps) ? action.steps : [];

    steps.forEach((step) => {
      const runStep = () => {
        applyPose(step.pose);
        renderPet();
      };
      const delay = normalizeDelay(step.delay);

      if (delay <= 0) {
        runStep();
        return;
      }

      scheduleAction(runStep, delay);
    });
  }

  function getActionDuration(action) {
    const steps = Array.isArray(action?.steps) ? action.steps : [];
    const latestDelay = steps.reduce(
      (latest, step) => Math.max(latest, normalizeDelay(step.delay)),
      0
    );

    return normalizeDelay(action?.finishDelay, latestDelay + 80);
  }

  function playConfiguredIdleAction(action) {
    prepareIdleAction();
    playPoseSequence(action, finishIdleAction);
  }

  function playNamedAction(actionId) {
    if (!actionId || settings.hidden || !assets) {
      return false;
    }

    const action = findAction(actionId);

    if (!action) {
      return false;
    }

    if (action.loop) {
      return toggleLoopingAction(actionId);
    }

    if (petState.isBusy && !activeLoopAction) {
      return false;
    }

    resetInteractionClock();
    playConfiguredIdleAction(action);
    return true;
  }

  function toggleLoopingAction(actionId, options = {}) {
    if (activeLoopAction === actionId) {
      stopLoopingAction();
      return false;
    }

    return startLoopingAction(actionId, options);
  }

  function toggleSpeech(options = {}) {
    if (activeLoopAction === "talk") {
      stopLoopingAction();
      return false;
    }

    return startSpeech({
      ...options,
      continuous: options.continuous === true,
    });
  }

  function startLoopingAction(actionId, options = {}) {
    const action = findAction(actionId);

    if (!action || !assets || settings.hidden) {
      return false;
    }

    if (actionId === "talk") {
      return startSpeech({
        ...options,
        continuous: options.continuous === true,
      });
    }

    activeLoopAction = actionId;
    clearRandomTimer();
    clearActionTimers();
    setIdlePose();
    petState.isBusy = true;
    resetInteractionClock();
    playLoopCycle(actionId, action);
    return true;
  }

  function stopLoopingAction(options = {}) {
    if (!activeLoopAction) {
      return false;
    }

    const { render = true, schedule = true } = options;
    activeLoopAction = null;
    speechState = createSpeechState();
    clearActionTimers();
    setIdlePose();
    petState.isBusy = false;

    if (render) {
      renderPet();
    }

    if (schedule) {
      scheduleRandomAction();
    }

    return true;
  }

  function playLoopCycle(actionId, action) {
    if (activeLoopAction !== actionId) {
      return;
    }

    runPoseSteps(action);
    scheduleAction(() => {
      playLoopCycle(actionId, action);
    }, getActionDuration(action));
  }

  function startSpeech(options = {}) {
    if (!assets || settings.hidden) {
      return false;
    }

    const profile = getSpeechProfile(options.mode);
    activeLoopAction = "talk";
    speechState = {
      ...createSpeechState(),
      active: true,
      continuous: options.continuous !== false,
      mode: profile.name,
      onFinish: typeof options.onFinish === "function" ? options.onFinish : null,
      onText: typeof options.onText === "function" ? options.onText : null,
      text: typeof options.text === "string" ? options.text : "",
    };

    clearRandomTimer();
    clearActionTimers();
    setIdlePose();
    petState.isBusy = true;
    petState.bubble = "chat";
    petState.effect = "ellipsis";
    resetInteractionClock();
    renderPet();
    scheduleNextSpeechStep();
    return true;
  }

  function scheduleNextSpeechStep() {
    if (!speechState.active || activeLoopAction !== "talk") {
      return;
    }

    const profile = getSpeechProfile(speechState.mode);

    if (!speechState.continuous && speechState.textIndex >= speechState.text.length) {
      finishSpeech();
      return;
    }

    const char = speechState.continuous
      ? ""
      : speechState.text[speechState.textIndex] ?? "";

    if (char) {
      speechState.displayText += char;
      speechState.textIndex += 1;

      if (speechState.onText) {
        speechState.onText(speechState.displayText, char, speechState.textIndex);
      }
    }

    if (char && SPEECH_PUNCTUATION.has(char)) {
      setSpeechMouth(MOUTH_STATES.NORMAL);
      scheduleAction(scheduleNextSpeechStep, SPEECH_PUNCTUATION_PAUSE);
      return;
    }

    const mouth = getNextSpeechMouth(profile);
    setSpeechMouth(mouth);
    scheduleAction(scheduleNextSpeechStep, randomBetween(profile.min, profile.max));
  }

  function finishSpeech() {
    const onFinish = speechState.onFinish;
    activeLoopAction = null;
    speechState = createSpeechState();
    clearActionTimers();
    setIdlePose();
    petState.isBusy = false;
    renderPet();
    scheduleRandomAction();

    if (onFinish) {
      onFinish();
    }
  }

  function setSpeechMouth(mouth) {
    petState.mouthState = mouth;
    petState.bubble = "chat";
    petState.effect = "ellipsis";
    petState.voicePulseActive = mouth !== MOUTH_STATES.NORMAL;
    renderPet();

    if (petState.voicePulseActive) {
      scheduleAction(() => {
        if (speechState.active) {
          petState.voicePulseActive = false;
          renderPet();
        }
      }, 120);
    }
  }

  function getNextSpeechMouth(profile) {
    const frames = profile.frames.length
      ? profile.frames
      : SPEECH_PROFILES.normal.frames;
    const frame = frames[speechState.frameIndex % frames.length];
    speechState.frameIndex += 1;
    return frame;
  }

  function findAction(actionId) {
    if (actions[actionId]?.steps) {
      return actions[actionId];
    }

    return actions.randomIdle?.actions?.find((action) => action.id === actionId) ?? null;
  }

  function scheduleRandomAction() {
    if (
      !assets ||
      !dom.pet ||
      settings.hidden ||
      petState.mainState !== MAIN_STATES.IDLE ||
      petState.isBusy ||
      petState.sleepPending
    ) {
      return;
    }

    const delayRange = getDelayRange(actions.randomIdle?.delay);
    clearRandomTimer();
    timers.random = window.setTimeout(
      runRandomAction,
      randomBetween(delayRange.min, delayRange.max)
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

    const action = chooseWeightedAction(actions.randomIdle?.actions);

    if (!action) {
      scheduleRandomAction();
      return;
    }

    playConfiguredIdleAction(action);
  }

  function beginSleepSequence(options = {}) {
    const force = Boolean(options.force);

    if (
      petState.mainState === MAIN_STATES.SLEEP ||
      petState.sleepPending ||
      (!force && petState.isBusy)
    ) {
      return false;
    }

    clearRandomTimer();
    clearActionTimers();
    activeLoopAction = null;
    speechState = createSpeechState();

    petState.isBusy = true;
    petState.sleepPending = true;
    petState.sleepBubblePhase = null;
    petState.sleepVisual = null;
    petState.wakeJoltActive = false;
    applyPose(actions.sleep?.pendingPose ?? createDefaultSleepPendingPose());
    renderPet();

    scheduleAction(() => {
      beginDeepSleep();
    }, normalizeDelay(actions.sleep?.transitionDelay, 1400));

    return true;
  }

  function beginDeepSleep() {
    applyPose(actions.sleep?.sleepPose ?? createDefaultSleepPose());
    petState.sleepVisual = chooseSleepVisual();
    petState.bubble =
      petState.sleepVisual === "bubble"
        ? resolveEffectName(assets?.effects, petState.bubble, "sleepBubble")
        : null;
    petState.sleepBubblePhase =
      petState.sleepVisual === "bubble" && petState.bubble ? "enter" : null;
    petState.wakeJoltActive = false;
    petState.isBusy = false;
    renderPet();

    if (petState.sleepVisual === "bubble") {
      scheduleAction(() => {
        if (petState.mainState !== MAIN_STATES.SLEEP || !petState.bubble) {
          return;
        }

        petState.sleepBubblePhase = "breath";
        renderPet();
      }, normalizeDelay(actions.sleep?.bubbleEnterDuration, SLEEP_BUBBLE_ENTER_DURATION));
    }

    scheduleSleepAutoWake();
  }

  function scheduleSleepAutoWake() {
    const delayRange = getDelayRange(actions.sleep?.autoWakeDelay, SLEEP_AUTO_WAKE_DELAY);
    const delay = randomBetween(delayRange.min, delayRange.max);
    const chargeWindow = normalizeDelay(
      actions.sleep?.chargeWindow,
      SLEEP_BUBBLE_CHARGE_WINDOW
    );

    if (petState.sleepVisual === "bubble" && chargeWindow > 0 && delay > chargeWindow) {
      scheduleAction(startSleepBubbleCharge, delay - chargeWindow);
    }

    scheduleAction(wakeFromSleep, delay);
  }

  function startSleepBubbleCharge() {
    if (petState.mainState !== MAIN_STATES.SLEEP || !petState.bubble) {
      return;
    }

    petState.sleepBubblePhase = "charge";
    renderPet();
  }

  function chooseSleepVisual() {
    const canUseBubble = Boolean(assets?.effects?.sleepBubble);
    const canUseZzz = Boolean(assets?.effects?.zzz && dom.zzz);

    if (canUseBubble && canUseZzz) {
      return Math.random() < 0.5 ? "bubble" : "zzz";
    }

    if (canUseBubble) {
      return "bubble";
    }

    return canUseZzz ? "zzz" : null;
  }

  function getSleepBubblePopFrames() {
    const configuredFrames = Array.isArray(actions.sleep?.popFrames)
      ? actions.sleep.popFrames
      : ["sleepBubble", "sleepBubblePop2", "sleepBubblePop3", "sleepBubblePop4"];

    return configuredFrames
      .map((frame) => resolveEffectName(assets?.effects, frame, null))
      .filter(Boolean);
  }

  function wakeFromSleep() {
    if (petState.mainState !== MAIN_STATES.SLEEP && !petState.sleepPending) {
      return;
    }

    const shouldPopBubble = petState.sleepVisual === "bubble" && Boolean(petState.bubble);
    const popFrames = shouldPopBubble ? getSleepBubblePopFrames() : [];
    const popFrameInterval = normalizeDelay(
      actions.sleep?.popFrameInterval,
      SLEEP_BUBBLE_POP_FRAME_INTERVAL
    );
    const popDuration = normalizeDelay(
      actions.sleep?.popDuration,
      Math.max(SLEEP_BUBBLE_POP_DURATION, popFrameInterval * popFrames.length)
    );

    clearActionTimers();
    activeLoopAction = null;
    speechState = createSpeechState();

    applyPose(actions.sleep?.popPose ?? createDefaultSleepPopPose());
    petState.bubble = popFrames[0] ?? null;
    petState.sleepBubblePhase = shouldPopBubble && petState.bubble ? "pop" : null;
    petState.sleepVisual = null;
    petState.wakeJoltActive = true;
    petState.isBusy = true;
    renderPet();

    popFrames.slice(1).forEach((frame, index) => {
      scheduleAction(() => {
        petState.bubble = frame;
        renderPet();
      }, popFrameInterval * (index + 1));
    });

    if (shouldPopBubble) {
      scheduleAction(() => {
        petState.bubble = null;
        petState.sleepBubblePhase = null;
        renderPet();
      }, popDuration);
    }

    scheduleWakeBlink();

    scheduleAction(() => {
      setIdlePose();
      petState.isBusy = false;
      resetInteractionClock();
      renderPet();
      scheduleRandomAction();
    }, normalizeDelay(actions.sleep?.recoveryDelay, SLEEP_RECOVERY_DELAY));
  }

  function scheduleWakeBlink() {
    scheduleAction(() => {
      if (!petState.isBusy || !petState.wakeJoltActive) {
        return;
      }

      petState.eyes.left = EYE_STATES.CLOSE;
      petState.eyes.right = EYE_STATES.CLOSE;
      renderPet();
    }, normalizeDelay(actions.sleep?.wakeBlinkDelay, WAKE_BLINK_DELAY));

    scheduleAction(() => {
      if (!petState.isBusy || !petState.wakeJoltActive) {
        return;
      }

      petState.eyes.left = EYE_STATES.OPEN;
      petState.eyes.right = EYE_STATES.OPEN;
      renderPet();
    }, normalizeDelay(
      actions.sleep?.wakeBlinkDelay,
      WAKE_BLINK_DELAY
    ) + normalizeDelay(actions.sleep?.wakeBlinkDuration, WAKE_BLINK_DURATION));
  }

  function handleClick() {
    resetInteractionClock();

    if (activeLoopAction) {
      return;
    }

    if (petState.mainState === MAIN_STATES.SLEEP || petState.sleepPending) {
      wakeFromSleep();
      return;
    }

    playConfiguredIdleAction(actions.click);
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
      '<p class="pet__fallback">Pet assets failed to load. Check <code>assets/pet/manifest.json</code>.</p>';
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
    assets = null;
    actions = {};
    activeLoopAction = null;
    speechState = createSpeechState();
  }
}

function createDefaultSleepPendingPose() {
  return {
    sleepPending: true,
    eyes: { left: EYE_STATES.LOW, right: EYE_STATES.LOW },
    mouth: MOUTH_STATES.NORMAL,
    flipperFrame: FLIPPER_FRAMES.FRAME1,
    headLift: false,
    tailBoost: false,
    specialEyes: null,
    cheeks: false,
    bubble: null,
    effect: null,
    poseFrame: null,
  };
}

function createDefaultSleepPose() {
  return {
    ...createDefaultSleepPendingPose(),
    mainState: MAIN_STATES.SLEEP,
    sleepPending: false,
    eyes: { left: EYE_STATES.CLOSE, right: EYE_STATES.CLOSE },
    bubble: "sleepBubble",
  };
}

function createDefaultSleepPopPose() {
  return {
    mainState: MAIN_STATES.IDLE,
    sleepPending: false,
    eyes: { left: EYE_STATES.OPEN, right: EYE_STATES.OPEN },
    mouth: MOUTH_STATES.SPEAK2,
    flipperFrame: FLIPPER_FRAMES.FRAME2,
    headLift: true,
    tailBoost: true,
    specialEyes: null,
    cheeks: false,
    bubble: "sleepBubble",
    effect: "exclamation",
    poseFrame: null,
  };
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

function normalizeDelay(value, fallback = 0) {
  return normalizeNumber(value, fallback);
}

function getDelayRange(range, fallback = DEFAULT_RANDOM_DELAY) {
  const source = range ?? fallback;
  const min = normalizeNumber(source.min, fallback.min);
  const max = normalizeNumber(source.max, fallback.max);

  if (max < min) {
    return {
      min: max,
      max: min,
    };
  }

  return {
    min,
    max,
  };
}

function resolveEffectName(effects, preferred, fallback) {
  if (preferred && effects?.[preferred]) {
    return preferred;
  }

  if (fallback && effects?.[fallback]) {
    return fallback;
  }

  return null;
}

function getSpeechProfile(mode) {
  const name =
    typeof mode === "string" && SPEECH_PROFILES[mode] ? mode : "normal";

  return {
    ...SPEECH_PROFILES[name],
    name,
  };
}

function chooseWeightedAction(actionList) {
  const actions = Array.isArray(actionList)
    ? actionList.filter((action) => Array.isArray(action.steps))
    : [];

  if (!actions.length) {
    return null;
  }

  const totalWeight = actions.reduce(
    (total, action) => total + normalizeNumber(action.weight, 1),
    0
  );
  let roll = Math.random() * totalWeight;

  for (const action of actions) {
    roll -= normalizeNumber(action.weight, 1);

    if (roll <= 0) {
      return action;
    }
  }

  return actions[actions.length - 1];
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

function hasOwn(source, key) {
  return Object.prototype.hasOwnProperty.call(source, key);
}

export default createPet;
