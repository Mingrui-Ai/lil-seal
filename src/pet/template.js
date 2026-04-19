function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function createPetMarkup(assets, labels) {
  return `
    <div class="pet-shell">
      <button class="pet" data-part="pet" type="button" aria-label="${escapeHtml(labels.idle)}">
        <span class="pet__scene" data-part="scene">
          <img class="pet__layer pet__shadow" src="${assets.shadow}" alt="" />
          <img class="pet__layer pet__body" src="${assets.body}" alt="" />
          <img class="pet__layer pet__tail" src="${assets.tail}" alt="" />
          <img class="pet__layer pet__tail-cover" src="${assets.tailCover}" alt="" />
          <img class="pet__layer pet__paw pet__paw--left" data-part="paw-left" src="${assets.paws.left.frame1}" alt="" />
          <img class="pet__layer pet__paw pet__paw--right" data-part="paw-right" src="${assets.paws.right.frame1}" alt="" />
          <span class="pet__head-wrap">
            <span class="pet__head-track" data-part="head-track">
              <img class="pet__layer pet__head" src="${assets.head}" alt="" />
              <img class="pet__layer pet__eye pet__eye--left" data-part="eye-left" src="${assets.eyes.left.open}" alt="" />
              <img class="pet__layer pet__eye pet__eye--right" data-part="eye-right" src="${assets.eyes.right.open}" alt="" />
              <img class="pet__layer pet__mouth" data-part="mouth" src="${assets.mouths.normal}" alt="" />
            </span>
          </span>
          <img class="pet__layer pet__zzz" data-part="zzz" src="${assets.zzz}" alt="" hidden />
        </span>
      </button>
    </div>
  `;
}
