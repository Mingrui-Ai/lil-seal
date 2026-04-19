import { createPet } from "../pet/createPet.js";

function startDemo() {
  const mount = document.getElementById("pet-root");

  if (!mount) {
    return;
  }

  const pet = createPet({
    mount,
  });

  window.demoPet = pet;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startDemo, { once: true });
} else {
  startDemo();
}
