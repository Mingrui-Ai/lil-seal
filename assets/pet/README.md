# Pet Asset Layout

All runtime PNG files use the same transparent 768 x 768 canvas so each layer can be swapped without extra positioning code.

```text
assets/pet/
  manifest.json        Runtime asset and action index.
  core/                Body, head, tail, shadow, and cover layers.
  flippers/            Left and right flipper animation frames.
  eyes/                Left/right eye states, including upturn laugh eyes, and full-face special eye overlays.
  mouths/              Normal, tongue, and speaking mouth frames.
  cheeks/              Blush overlays.
  effects/             Full-canvas chat bubbles, symbols, and sleep effects.
  poses/               Full-canvas replacement poses that hide normal layers.
  actions/             JSON action timelines consumed by the pet runtime.
  reference/           Non-runtime reference exports.
  source/original/     Original editable artwork files.
```

Naming rules:

- Use lowercase English names with underscores.
- Prefer stable semantic names over temporary artboard names.
- Number animation frames with two digits: `left_01.png`, `speak_02.png`.
- Keep new runtime layers on the shared 768 x 768 canvas.
- Use `poses/` for full-body frames such as wave poses that should temporarily hide normal layered parts.
- Use `bubble` for persistent chat bubbles and `effect` for the symbol above them.
