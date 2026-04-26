import { createPet } from "../pet/createPet.js";

const ACTION_LABELS = {
  happy_star: "星星眼",
  laugh: "大笑",
  love_blush: "害羞",
  talk: "说话",
  wave: "挥手",
};

const COMMAND_LABELS = {
  sleep: "睡觉",
  wake: "醒来",
};

function startDemo() {
  const mount = document.getElementById("pet-root");

  if (!mount) {
    return;
  }

  const actionButtons = Array.from(document.querySelectorAll(".demo-action"));
  const status = document.querySelector("[data-status]");
  const speechMode = document.querySelector("[data-speech-mode]");
  const speechOutput = document.querySelector("[data-speech-output]");
  const speechText = document.querySelector("[data-speech-text]");
  const pet = createPet({
    mount,
  });

  bindActionButtons(pet, actionButtons, {
    speechMode,
    speechOutput,
    speechText,
    status,
  });
  window.demoPet = pet;
}

function bindActionButtons(pet, buttons, refs) {
  const { speechMode, speechOutput, speechText, status } = refs;

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      const command = button.dataset.command;
      const mode = speechMode?.value ?? "normal";

      if (action) {
        if (action === "talk" && typeof pet.talk === "function") {
          const active = pet.talk({ mode });
          setButtonActive(button, active);
          setText(speechOutput, active ? "..." : "");
          setStatus(status, active ? "说话中：再次点击停止" : "已停止说话");
          return;
        }

        resetToggleButtons(buttons);
        const played = pet.play(action);
        setStatus(status, played ? `已触发：${ACTION_LABELS[action]}` : "当前动作未就绪");
        return;
      }

      if (command === "say" && typeof pet.say === "function") {
        resetToggleButtons(buttons);
        const text = speechText?.value?.trim() || "咕噜，今天也要认真学习！";
        pet.say(text, {
          mode,
          onFinish: () => setStatus(status, "文本说完了"),
          onText: (nextText) => setText(speechOutput, nextText),
        });
        setStatus(status, "文本说话中");
        return;
      }

      if (command && typeof pet[command] === "function") {
        resetToggleButtons(buttons);
        setText(speechOutput, "");
        pet[command]();
        setStatus(status, `已触发：${COMMAND_LABELS[command]}`);
      }
    });
  });

  pet.ready.then(() => {
    buttons.forEach((button) => {
      button.disabled = false;
    });
    setStatus(status, "已就绪");
  });
}

function resetToggleButtons(buttons) {
  buttons.forEach((button) => {
    setButtonActive(button, false);
  });
}

function setButtonActive(button, active) {
  button.classList.toggle("demo-action--active", active);
  button.setAttribute("aria-pressed", String(active));
}

function setStatus(target, text) {
  setText(target, text);
}

function setText(target, text) {
  if (target) {
    target.textContent = text;
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startDemo, { once: true });
} else {
  startDemo();
}
