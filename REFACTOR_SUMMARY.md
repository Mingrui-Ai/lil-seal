# lil-seal 重构总结

## 这次重构做了什么

- 把临时素材目录 `assets/data`、`assets/sucai` 统一整理为正式运行目录 `assets/pet/`。
- 按资源语义拆分海豹素材：身体核心层、鳍、眼睛、嘴巴、腮红、特效、动作配置、参考图和原始工程稿。
- 统一了素材命名，去掉 `!.png`、`....png`、`dorp.png`、`mouth_speek1.png` 这类不稳定或拼写错误的名字。
- 新增 `assets/pet/manifest.json`，由清单统一描述运行素材、参考图和动作配置入口。
- 新增 `assets/pet/actions/*.json`，把随机待机、点击、睡眠、醒来、说话动作从核心代码里拆出来。
- 重构 `src/pet/assets.js`，运行时从 `manifest.json` 加载资源和动作配置，再统一解析为可用 URL。
- 重构 `src/pet/createPet.js`，使用动作 JSON 的时间线执行姿态变化，新增特殊眼睛、腮红、特效层支持。
- 保留原有桌宠生命周期 API，并新增 `play(actionId)`，方便外部主动触发配置中的动作。
- demo 测试页新增行为按钮，可直接触发说话、睡觉、醒来、挥手、星星眼、害羞。
- 挥手素材改为 `poses/` 整姿势替换帧，播放时会暂时隐藏普通图层，避免叠图。

## 当前目录结构

```text
lil-seal/
  assets/
    pet/
      README.md
      manifest.json
      actions/
        click.json
        random_idle.json
        sleep.json
        talk.json
        wave.json
        wake.json
      cheeks/
        blush_left.png
        blush_right.png
      core/
        body.png
        head.png
        shadow.png
        tail.png
        tail_cover.png
      effects/
        chat.png
        cloud.png
        drop.png
        ellipsis.png
        exclamation.png
        question_mark.png
        thinking.png
        zzz.png
      poses/
        wave_01.png
        wave_02.png
      eyes/
        left_close.png
        left_low.png
        left_open.png
        love.png
        right_close.png
        right_low.png
        right_open.png
        star.png
      flippers/
        left_01.png
        left_02.png
        right_01.png
        right_02.png
      mouths/
        normal.png
        speak_01.png
        speak_02.png
        speak_03.png
        tongue.png
      reference/
        all.png
      source/
        original/
  src/
    demo/
      boot.js
      demo.css
    pet/
      assets.js
      constants.js
      createPet.js
      styles.css
      template.js
  index.html
  package.json
```

## 素材维护规则

- 所有运行时 PNG 继续保持透明 `768 x 768` 画布，确保图层可以直接叠放。
- 新素材用英文小写和下划线命名。
- 连续帧使用两位数字，例如 `left_01.png`、`speak_02.png`。
- 运行时会用到的图片放入 `core`、`flippers`、`eyes`、`mouths`、`cheeks`、`effects`、`poses`。
- 参考整图放入 `reference/`，不要写入动作配置。
- 原始可编辑文件放入 `source/original/`，不要让运行代码直接依赖。
- 新增图片后先更新 `manifest.json`，再在对应动作 JSON 中使用语义 key。

## 资源清单

`assets/pet/manifest.json` 是资源入口：

- `files.core`：身体、头、尾巴、阴影等基础图层。
- `files.flippers`：左右鳍的帧。
- `files.eyes.left/right`：普通左右眼状态。
- `files.eyes.special`：爱心眼、星星眼这类整脸表情覆盖层。
- `files.mouths`：普通嘴、吐舌头、说话帧。
- `files.cheeks`：腮红覆盖层。
- `files.effects`：气泡、问号、zzz 等整画布特效。
- `files.poses`：整姿势替换帧，例如挥手帧；播放时会暂时隐藏普通身体/表情图层。
- `actions`：动作 JSON 的入口路径。

## 动作配置

动作 JSON 使用时间线描述姿态变化：

```json
{
  "id": "talk",
  "finishDelay": 720,
  "steps": [
    { "delay": 0, "pose": { "mouth": "speak1", "effect": "ellipsis" } },
    { "delay": 120, "pose": { "mouth": "speak2" } },
    { "delay": 520, "pose": { "mouth": "normal", "effect": null } }
  ]
}
```

当前支持的 `pose` 字段：

- `mainState`：`idle` 或 `sleep`。
- `sleepPending`：睡眠过渡状态。
- `eyes.left/right`：`open`、`low`、`close`。
- `mouth`：`normal`、`tongue`、`speak1`、`speak2`、`speak3`。
- `flipperFrame`：`frame1`、`frame2`。
- `headLift`：是否触发抬头样式。
- `tailBoost`：是否触发尾巴摆动样式。
- `specialEyes`：`star`、`love`，或 `null` 清空。
- `cheeks`：是否显示腮红。
- `effect`：`chat`、`ellipsis`、`exclamation` 等，或 `null` 清空。
- `poseFrame`：`wave1`、`wave2` 等整姿势帧，播放时会隐藏普通图层。

## 现在可用的桌宠 API

```js
import { createPet } from "./src/pet/createPet.js";

const pet = createPet({
  mount: document.querySelector("#pet-root"),
  assetBase: "./assets/pet/",
  position: {
    left: "24px",
    bottom: "24px",
    scale: 0.9,
    zIndex: 40,
  },
});

await pet.ready;
pet.play("talk");
pet.play("wave");
pet.play("happy_star");
pet.sleep();
pet.wake();
pet.hide();
pet.show();
pet.setPosition({ right: "24px", left: "auto" });
pet.destroy();
```

### 支持的能力

- `mount(target)`：挂载到指定 DOM 节点。
- `destroy()`：清理 DOM、事件监听、`setTimeout`、`setInterval`、`requestAnimationFrame`。
- `show()` / `hide()`：控制显示状态。
- `setPosition(position)`：动态修改位置、缩放和层级。
- `play(actionId)`：主动播放动作配置，例如 `talk`、`happy_star`、`love_blush`。
- `sleep()` / `wake()`：主动进入睡眠或唤醒，主要用于测试页和外部交互。
- `ready`：资源清单、动作配置、图片预加载和首屏挂载完成后的 Promise。

## 后续新增动作流程

1. 把新图片放入对应目录，例如新表情放 `eyes/`，新气泡放 `effects/`。
2. 在 `manifest.json` 中给新图片添加稳定 key。
3. 在 `actions/` 下新增或修改动作 JSON。
4. 如果是随机待机动作，把动作加到 `random_idle.json` 的 `actions` 数组并设置 `weight`。
5. 运行 `npm run check`，再启动 `npm run dev` 预览。

## 本次验证

- 已执行 `npm run check`，所有 JS 模块语法检查通过。
- 已解析全部 `assets/pet/**/*.json`，JSON 配置格式正常。
- 已通过本地服务检查 manifest、动作配置和 34 张运行图片，资源访问无 404。
