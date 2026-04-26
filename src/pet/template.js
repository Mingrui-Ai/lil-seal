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
          <img class="pet__layer pet__shadow" data-layer="standard" src="${assets.core.shadow}" alt="" />
          <img class="pet__layer pet__body" data-layer="standard" src="${assets.core.body}" alt="" />
          <img class="pet__layer pet__tail" data-layer="standard" src="${assets.core.tail}" alt="" />
          <img class="pet__layer pet__tail-cover" data-layer="standard" src="${assets.core.tailCover}" alt="" />
          <img class="pet__layer pet__flipper pet__flipper--left" data-layer="standard" data-part="flipper-left" src="${assets.flippers.left.frame1}" alt="" />
          <img class="pet__layer pet__flipper pet__flipper--right" data-layer="standard" data-part="flipper-right" src="${assets.flippers.right.frame1}" alt="" />
          <span class="pet__head-wrap" data-layer="standard">
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
          <img class="pet__layer pet__bubble" data-part="bubble" src="${assets.effects.chat}" alt="" hidden />
          <img class="pet__layer pet__effect" data-part="effect" src="${assets.effects.exclamation}" alt="" hidden />
          <span class="pet__thought-content" data-part="thought-content" aria-hidden="true" hidden>
            <span class="pet__thought-stage pet__thought-stage--dots">
              <span class="pet__thought-symbol pet__thought-symbol--dots">
                <span class="pet__thought-dot"></span>
                <span class="pet__thought-dot"></span>
                <span class="pet__thought-dot"></span>
              </span>
            </span>
            <span class="pet__thought-stage pet__thought-stage--question">
              <span class="pet__thought-symbol pet__thought-symbol--question">?</span>
            </span>
            <span class="pet__thought-stage pet__thought-stage--gear">
              <span class="pet__thought-symbol pet__thought-symbol--gear">
                <span class="pet__thought-gear"></span>
              </span>
            </span>
            <span class="pet__thought-stage pet__thought-stage--fish">
              <img class="pet__layer pet__thought-asset" src="${assets.effects.fish}" alt="" />
            </span>
            <span class="pet__thought-stage pet__thought-stage--shrimp">
              <img class="pet__layer pet__thought-asset" src="${assets.effects.shrimp}" alt="" />
            </span>
            <span class="pet__thought-stage pet__thought-stage--code">
              <span class="pet__thought-symbol pet__thought-symbol--code">
                <span>&lt;</span><span>&gt;</span>
              </span>
            </span>
            <span class="pet__thought-stage pet__thought-stage--book">
              <img class="pet__layer pet__thought-asset" src="${assets.effects.book}" alt="" />
            </span>
            <span class="pet__thought-stage pet__thought-stage--pencil">
              <img class="pet__layer pet__thought-asset" src="${assets.effects.pencil}" alt="" />
            </span>
          </span>
          <span class="pet__effect-bursts" data-part="effect-bursts" aria-hidden="true"></span>
          <img class="pet__layer pet__zzz" data-part="zzz" src="${assets.effects.zzz}" alt="" hidden />
          <img class="pet__layer pet__pose" data-part="pose" src="${assets.poses.wave1}" alt="" hidden />
        </span>
      </button>
    </div>
  `;
}
