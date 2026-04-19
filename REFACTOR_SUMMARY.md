# lil-seal 重构总结

## 这次重构做了什么

- 把原来写死在 `src/main.js` 的自动启动脚本，拆成了可嵌入的桌宠内核和独立 demo 启动层。
- 保留了当前静态项目的开发方式，`index.html` 依然可以单独预览动画。
- 补齐了未来接入学习网站时最关键的实例生命周期能力：挂载、销毁、显示、隐藏、位置调整。
- 把 demo 页面样式和桌宠本体样式分开，避免以后并站时把 `body`、`:root`、`.page` 之类样式带进主项目。
- 修正了 demo 页里原先乱码的中文文案。

## 新目录结构

```text
lil-seal/
  assets/
    pet/
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

## 各部分职责

- `src/pet/createPet.js`
  - 桌宠实例工厂。
  - 对外提供 `createPet()`。
  - 内部管理状态、随机动作、睡眠逻辑、眼球跟随、事件监听、定时器和销毁清理。

- `src/pet/assets.js`
  - 统一管理资源路径。
  - 支持默认本地资源目录，也支持以后通过 `assetBase` 改成别的静态资源前缀。

- `src/pet/template.js`
  - 只负责桌宠 DOM 结构模板。
  - 去掉了依赖全局 `id` 的写法，改成实例内查询，方便以后组件化。

- `src/pet/styles.css`
  - 只保留桌宠自身样式和动画。
  - 不再改全局页面背景、字体和布局。

- `src/demo/boot.js`
  - 只负责 demo 页启动。
  - 以后真正接入别的项目时，这一层通常不需要搬过去。

- `src/demo/demo.css`
  - 专门放 demo 页面壳子的视觉样式。
  - 和桌宠样式彻底分离。

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
pet.hide();
pet.show();
pet.setPosition({ right: "24px", left: "auto" });
pet.destroy();
```

### 支持的能力

- `mount(target)`
  - 挂载到指定 DOM 节点。

- `destroy()`
  - 清理 DOM、事件监听、`setTimeout`、`setInterval`、`requestAnimationFrame`。

- `show()` / `hide()`
  - 控制显示状态。

- `setPosition(position)`
  - 动态修改位置、缩放和层级。

- `ready`
  - 资源预加载和首屏挂载完成后的 Promise。

## 为什么这样改以后最好接入

以后接入 `CS_Buddy` 时，不需要搬整个项目，只需要把下面这些带过去：

- `src/pet/`
- `assets/pet/`

然后在 Vue 组件里这样包一层就行：

```js
import { onMounted, onUnmounted, ref } from "vue";
import { createPet } from "@/mascot/createPet";

const hostRef = ref(null);
let pet;

onMounted(async () => {
  pet = createPet({ mount: hostRef.value });
  await pet.ready;
});

onUnmounted(() => {
  pet?.destroy();
});
```

## 这次重构的核心收益

- 现在继续做动画，不需要提前考虑 Vue、路由、Pinia 这些并站细节。
- 以后要并入网站时，不再是“重写一遍桌宠”，而是“把内核搬进去，再包一层组件”。
- 生命周期和样式边界已经提前打好了，后面接学习网站时风险会小很多。

## 后续建议

- 如果后面还会继续加表情、气泡、点击文案，建议优先做成配置项，不要重新写死在内核里。
- 如果未来要让它在聊天页、测评页、个人中心页有不同位置，直接在外层组件里调用 `setPosition()` 即可。
- 如果后续要让它承担引导学习、提示签到、显示进度，再在 `createPet()` 外扩展事件和数据接口会比较顺。
