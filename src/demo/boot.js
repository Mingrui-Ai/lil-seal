import { createPet } from "../pet/createPet.js";

const ACTION_LABELS = {
  happy_star: "星星眼",
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
  const pet = createPet({
    mount,
  });

  bindActionButtons(pet, actionButtons, status);
  window.demoPet = pet;
}

function bindActionButtons(pet, buttons, status) {
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      const command = button.dataset.command;

      if (action) {
        if (action === "talk" && typeof pet.talk === "function") {
          const active = pet.talk();
          setButtonActive(button, active);
          setStatus(status, active ? "说话中：再次点击停止" : "已停止说话");
          return;
        }

        resetToggleButtons(buttons);
        const played = pet.play(action);
        setStatus(status, played ? `已触发：${ACTION_LABELS[action]}` : "当前动作未就绪");
        return;
      }

      if (command && typeof pet[command] === "function") {
        resetToggleButtons(buttons);
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
  if (target) {
    target.textContent = text;
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startDemo, { once: true });
} else {
  startDemo();
}
