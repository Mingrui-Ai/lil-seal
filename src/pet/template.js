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
          <img class="pet__layer pet__shadow" src="${assets.core.shadow}" alt="" />
          <img class="pet__layer pet__body" src="${assets.core.body}" alt="" />
          <img class="pet__layer pet__tail" src="${assets.core.tail}" alt="" />
          <img class="pet__layer pet__tail-cover" src="${assets.core.tailCover}" alt="" />
          <img class="pet__layer pet__flipper pet__flipper--left" data-part="flipper-left" src="${assets.flippers.left.frame1}" alt="" />
          <img class="pet__layer pet__flipper pet__flipper--right" data-part="flipper-right" src="${assets.flippers.right.frame1}" alt="" />
          <span class="pet__head-wrap">
            <span class="pet__head-track" data-part="head-track">
              <img class="pet__layer pet__head" src="${assets.core.head}" alt="" />
              <img class="pet__layer pet__eye pet__eye--left" data-part="eye-left" src="${assets.eyes.left.open}" alt="" />
              <img class="pet__layer pet__eye pet__eye--right" data-part="eye-right" src="${assets.eyes.right.open}" alt="" />
              <img class="pet__layer pet__special-eyes" data-part="special-eyes" src="${assets.eyes.special.star}" alt="" hidden />
              <img class="pet__layer pet__cheek pet__cheek--left" data-part="cheek-left" src="${assets.cheeks.blushLeft}" alt="" hidden />
              <img class="pet__layer pet__cheek pet__cheek--right" data-part="cheek-right" src="${assets.cheeks.blushRight}" alt="" hidden />
              <img class="pet__layer pet__mouth" data-part="mouth" src="${assets.mouths.normal}" alt="" />
            </span>
          </span>
          <img class="pet__layer pet__effect" data-part="effect" src="${assets.effects.exclamation}" alt="" hidden />
          <img class="pet__layer pet__zzz" data-part="zzz" src="${assets.effects.zzz}" alt="" hidden />
        </span>
      </button>
    </div>
  `;
}
