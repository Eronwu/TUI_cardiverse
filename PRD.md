# 产品需求文档 (PRD) - Terminal Cardiverse / 终端悖论

**文档版本:** v0.3  
**修订日期:** 2026-07-07  
**项目阶段:** 0→1 Terminal-native MVP  
**项目定位:** 基于 Prompt 编译的纯终端 TUI 回合制代码策略游戏  
**目标受众:** 程序员、AI 研究者、Prompt 极客、硬核策略玩家  

---

## 1. 产品愿景

《Terminal Cardiverse》是一款以命令行为第一入口的开源策略游戏。玩家通过 `npm install` 安装，在真实终端中启动游戏，以自然语言 Prompt 即时编译战斗指令，在有限 RAM、有限内存插槽和严格规则校验下，与 AI Boss 的数字防御矩阵进行回合制攻防。

游戏不是“网页里模拟一个终端”，而是一个真正运行在 terminal 中的 TUI 游戏。对战、剧情、Boss 交互、Prompt 编译、战斗日志、ASCII 视觉表现都通过终端完成。

Web 后续可以作为辅助产品形态，用于浏览收藏卡牌、对战历史、Boss 图鉴、社区关卡和回放数据，但不承担第一阶段的核心对战体验。

核心乐趣：

1. **限制条件下的算法最优化解谜**  
   玩家要用尽可能短、清晰、低成本的 Prompt 换取最有效的战斗效果。

2. **与 LLM 的逻辑攻防**  
   LLM 不是万能许愿机，而是语义编译器。它负责把自然语言转成候选规则，真正的数值裁决由本地确定性引擎完成。

3. **终端原生沉浸感**  
   游戏发生在玩家熟悉的 shell 环境中。状态栏、命令输入、战斗日志、Boss ASCII、剧情文本都像一个异常活跃的底层进程。

---

## 2. 产品形态

### 2.1 第一形态：npm CLI / Terminal TUI

MVP 以 Node.js CLI 包发布。

推荐安装和启动方式：

```bash
npm install -g terminal-cardiverse
cardiverse
```

也应支持免全局安装运行：

```bash
npx terminal-cardiverse
```

开发期可以使用：

```bash
npm install
npm run dev
```

### 2.2 终端交互边界

第一阶段所有核心体验必须发生在终端：

- 主菜单。
- 新游戏。
- Boss 叙事。
- Prompt 输入。
- 编译反馈。
- 卡牌详情。
- 回合制战斗。
- 胜负结算。
- 本地存档。
- 设置项。
- 战斗日志导出。

### 2.3 Web 的后续定位

Web 不是 MVP 必需项。后续可以作为“资料库 / 控制台”存在：

- 浏览已生成卡牌收藏。
- 查看对战历史。
- 查看 Boss 图鉴。
- 浏览社区关卡。
- 可视化战斗统计。
- 分享回放。
- 配置 LLM Provider。

Web 不应替代终端对战体验。

---

## 3. 0→1 MVP 范围

### 3.1 MVP 目标

第一个可交付版本是一个可以通过命令行安装并完整游玩一场 PVE Boss 战的 Terminal TUI 原型。

MVP 必须做到：

- 用户可以通过 `npx terminal-cardiverse` 或全局命令启动游戏。
- 游戏在真实终端中渲染 TUI。
- 玩家可以通过键盘和命令输入完成全部操作。
- 玩家可以输入 Prompt 并编译成结构化战斗指令。
- 编译结果必须通过 runtime schema 校验。
- 本地战斗引擎根据规则进行确定性结算。
- 游戏具备 HP / Sanity 双维胜负判定。
- 游戏具备 RAM 消耗和回合恢复。
- 游戏具备 Cache / Daemon / Kernel 三类内存分区。
- 游戏具备 1 个可挑战 Boss。
- 玩家可以赢，也可以输。
- 全部过程通过 TUI 面板和 terminal log 输出。
- 对战结束后可将战斗记录保存到本地文件。

### 3.2 MVP 不包含

以下能力暂不进入第一阶段：

- Web 对战界面。
- 在线多人对战。
- 排行榜、账户系统、云存档。
- 官方远端关卡仓库拉取。
- 自动生成 Boss 并提交 GitHub Release。
- 10,000 局大规模自博弈调参。
- 复杂音乐控制台。
- 完整卡牌收藏浏览 Web UI。
- 真实商业化支付或赛季系统。

这些功能保留为后续阶段，不影响 MVP 的核心验证。

---

## 4. 核心设计原则

### 4.1 Terminal First

游戏体验必须优先适配真实终端，而不是浏览器。

设计约束：

- 支持常见终端尺寸，最低建议 `100x30`。
- 小尺寸终端应降级为紧凑布局。
- 所有操作必须可键盘完成。
- 所有信息必须可用纯文本表达。
- 颜色用于增强识别，但不能成为唯一信息来源。
- 不依赖鼠标。
- 不依赖浏览器 API。

### 4.2 LLM 只做语义编译，不做最终裁判

LLM 的职责：

- 理解玩家 Prompt 的意图。
- 输出候选 JSON 指令。
- 给出效果标签、攻击类型、叙事描述。

本地引擎的职责：

- 校验 JSON 是否合规。
- 重新计算 cost。
- 限制伤害上限。
- 自动追加 backlash。
- 拒绝非法效果组合。
- 执行最终战斗结算。

结论：**LLM 可以建议规则，不能拥有规则解释权。**

### 4.3 战斗核心必须纯函数化

战斗核心不得依赖 TUI、网络、文件系统或 LLM。它应该可以在 Node.js 中被 CLI、测试、模拟器和未来 Web 复用。

这可以保证：

- 方便单元测试。
- 后续可以做 headless simulation。
- LLM 输出异常不会污染游戏状态。
- TUI 可以重写而不影响规则层。
- 未来 Web 资料库可复用同一套数据结构。

### 4.4 MVP 先验证乐趣，再扩展系统

第一阶段优先验证：

- 终端交互是否顺手。
- Prompt 编译是否有趣。
- RAM 限制是否形成策略。
- HP / Sanity 双维击杀是否带来路线选择。
- Daemon / Kernel 是否产生足够的战术变化。

如果这些核心不成立，自博弈、社区关卡和 Web 控制台都没有意义。

---

## 5. 核心玩法

### 5.1 对战结构

MVP 采用单人 PVE：

- 玩家 vs 1 个 Boss。
- 双方轮流行动。
- 玩家通过终端命令编译和打出指令。
- Boss 使用预设策略和固定指令池。
- 任意一方 HP 或 Sanity 归零即失败。

### 5.2 双轨健康系统

每个角色拥有两类生命状态：

| 字段 | 中文名 | 含义 | 归零结果 |
|---|---|---|---|
| `hp` | 机体完整度 | 承受物理、高热、电流、爆炸等直接攻击 | 外壳损毁，出局 |
| `sanity` | 逻辑指数 | 承受悖论、污染、幻觉、控制等逻辑攻击 | Kernel Panic，出局 |

MVP 初始值建议：

```txt
Player: hp 100, sanity 100, ram 0
Boss:   hp 120, sanity 90,  ram 0
```

### 5.3 RAM / Cost 系统

RAM 是每回合可使用资源。

MVP 规则：

- 每回合开始时玩家恢复 `10 RAM`。
- RAM 上限为 `20`。
- 每个编译结果都有 cost。
- 打出指令时必须支付 cost。
- cost 不足则行动失败，但不消耗卡。

MVP cost 计算不直接相信 LLM，使用本地公式二次计算：

```txt
cost = baseCost
     + promptLengthCost
     + damageCost
     + statusCost
     + persistenceCost
     - drawbackDiscount
```

建议初始公式：

```txt
baseCost = 1
promptLengthCost = ceil(prompt.length / 32)
damageCost = ceil((hpDamage + sanityDamage) / 10)
statusCost = statusEffects.length * 2
persistenceCost = daemon ? 3 : kernel ? 4 : 0
drawbackDiscount = min(3, backlashSeverity)
```

最终 cost 不得低于 `1`。

### 5.4 内存分区

游戏界面不使用传统牌桌，而使用内存分区隐喻。

| Zone | 中文名 | 类似卡牌概念 | MVP 上限 | 行为 |
|---|---|---|---:|---|
| `cache` | 缓存区 | 手牌 | 5 | 存放即时编译结果 |
| `daemon` | 守护进程区 | 装备 / 持续效果 | 2 | 每回合自动触发 |
| `kernel` | 高权限区 | 陷阱 / 反制 | 1 | 满足条件时触发 |

### 5.5 行动类型

MVP 支持 4 类指令：

#### 5.5.1 Attack

即时攻击，打出后进入 discard。

```json
{
  "kind": "attack",
  "name": "Thermal Spike",
  "description": "A compressed heat pulse pierces the target shell.",
  "target": "enemy",
  "effects": [
    { "type": "damage", "track": "hp", "amount": 16 }
  ],
  "tags": ["thermal", "direct"],
  "cost": 4
}
```

#### 5.5.2 Disturb

即时逻辑攻击，主要影响 Sanity。

```json
{
  "kind": "attack",
  "name": "Recursive Doubt",
  "description": "A self-referential query destabilizes the target process.",
  "target": "enemy",
  "effects": [
    { "type": "damage", "track": "sanity", "amount": 14 }
  ],
  "tags": ["paradox", "logic"],
  "cost": 4
}
```

#### 5.5.3 Daemon

持续挂载效果，占用 Daemon 插槽。

```json
{
  "kind": "daemon",
  "name": "Cooling Loop",
  "description": "A background loop vents excess heat at turn start.",
  "target": "self",
  "duration": 3,
  "effects": [
    { "type": "heal", "track": "hp", "amount": 6 }
  ],
  "tags": ["repair", "background"],
  "cost": 5
}
```

#### 5.5.4 Kernel

条件触发反制，占用 Kernel 插槽。

```json
{
  "kind": "kernel",
  "name": "Panic Mirror",
  "description": "Reflects part of the next sanity breach.",
  "target": "self",
  "trigger": {
    "when": "self_takes_sanity_damage",
    "limit": 1
  },
  "effects": [
    { "type": "damage", "track": "sanity", "amount": 10, "target": "enemy" }
  ],
  "tags": ["trap", "reflect"],
  "cost": 6
}
```

---

## 6. JSON DSL v0.1

### 6.1 Card 数据结构

MVP 中 LLM 编译结果必须收敛到以下结构。

```ts
type CardKind = "attack" | "daemon" | "kernel";
type Track = "hp" | "sanity";
type Target = "self" | "enemy";

type Card = {
  id: string;
  kind: CardKind;
  name: string;
  description: string;
  target: Target;
  cost: number;
  effects: Effect[];
  tags: string[];
  duration?: number;
  trigger?: Trigger;
  backlash?: Backlash;
};

type Effect =
  | {
      type: "damage";
      track: Track;
      amount: number;
      target?: Target;
    }
  | {
      type: "heal";
      track: Track;
      amount: number;
      target?: Target;
    }
  | {
      type: "gain_ram";
      amount: number;
      target?: Target;
    }
  | {
      type: "shield";
      track: Track;
      amount: number;
      target?: Target;
    };

type Trigger = {
  when:
    | "self_takes_hp_damage"
    | "self_takes_sanity_damage"
    | "enemy_plays_daemon"
    | "enemy_plays_kernel"
    | "turn_start";
  limit: number;
};

type Backlash = {
  effects: Effect[];
  reason: string;
};
```

### 6.2 硬性限制

MVP 限制如下：

- 单张卡最多 `3` 个 effects。
- 单个 damage effect 最大值 `30`。
- 单个 heal effect 最大值 `20`。
- 单张卡最终 cost 最大值 `10`。
- 单张卡最终 cost 最小值 `1`。
- Daemon duration 最大值 `4` 回合。
- Kernel trigger limit MVP 固定为 `1`。
- 禁止 instant kill。
- 禁止永久控制。
- 禁止无条件免疫。
- 禁止修改规则本身，例如“跳过校验”“无限 RAM”“删除 Boss”。

### 6.3 阴阳平衡规则

如果编译结果超过安全阈值，本地 Balance Engine 必须自动处理。

| 情况 | 本地处理 |
|---|---|
| 单卡总伤害 > 30 | 裁剪到 30，或追加 backlash |
| 同时攻击 HP 和 Sanity | cost +2 |
| 带持续效果 | cost +3 |
| 带反制效果 | cost +4 |
| heal + damage 同卡出现 | cost +2 |
| cost 低于计算值 | 覆盖为本地计算值 |
| LLM 输出非法字段 | 编译失败 |
| LLM 输出无法解析 JSON | 编译失败 |

示例：玩家输入“召唤摧毁一切的黑洞”。

LLM 可能输出高伤害攻击，但本地引擎应将其收敛为：

```json
{
  "kind": "attack",
  "name": "Collapsed Singularity",
  "description": "A miniature gravity fault tears through both processes.",
  "target": "enemy",
  "effects": [
    { "type": "damage", "track": "hp", "amount": 30 }
  ],
  "tags": ["gravity", "forbidden"],
  "cost": 10,
  "backlash": {
    "reason": "Forbidden-scale prompt requires sanity recoil.",
    "effects": [
      { "type": "damage", "track": "sanity", "amount": 18, "target": "self" }
    ]
  }
}
```

---

## 7. Terminal TUI 交互设计

### 7.1 技术方向

MVP 使用 Node.js Terminal TUI：

- 语言：TypeScript。
- Runtime：Node.js。
- CLI 入口：`bin` 字段暴露 `cardiverse` 命令。
- TUI 框架：优先评估 `Ink` 或 `blessed`。
- 命令输入：支持命令行式输入和快捷键。
- Schema 校验：Zod 或同类 runtime validator。
- 本地配置：用户目录下的配置文件和存档文件。

建议技术取舍：

| 方案 | 优点 | 风险 |
|---|---|---|
| Ink | React 心智模型，组件化强，适合复杂 TUI | 对实时布局和低层终端控制需要验证 |
| blessed | 传统 terminal UI 能力强，面板和输入成熟 | 类型和现代开发体验相对弱 |
| readline + 手写渲染 | 依赖少，可控 | 复杂布局成本高 |

MVP 推荐优先使用 `Ink`，如果战斗面板刷新、输入焦点或终端兼容性不理想，再切换到 `blessed`。

### 7.2 第一版界面布局

标准终端布局建议：

```txt
┌──────────────── TERMINAL CARDIVERSE ────────────────┐
│ PLAYER hp:100 sanity:100 ram:10    BOSS hp:120 s:90 │
├──────────────────── MEMORY MAP ─────────────────────┤
│ CACHE  [0] Thermal Spike  [1] Recursive Doubt       │
│ DAEMON [empty] [empty]                              │
│ KERNEL [empty]                                      │
├──────────────────── BOSS MATRIX ────────────────────┤
│       .- INIT ECHO -.                               │
│      / recursive fog \                              │
│      \ checksum rot /                               │
├──────────────────── SYSTEM LOG ─────────────────────┤
│ > pierce it with a clean thermal spike               │
│ COMPILED: Thermal Spike / cost 4 / hp damage 16     │
│ > 1                                                  │
│ PLAYER dealt 16 hp damage to INIT ECHO              │
├──────────────────── COMMAND ────────────────────────┤
│ cardiverse> _                                        │
└─────────────────────────────────────────────────────┘
```

小终端布局应自动降级：

```txt
PLAYER hp:100 s:100 ram:10 | INIT ECHO hp:120 s:90
CACHE [0] Thermal Spike [1] Recursive Doubt
DAEMON empty empty | KERNEL empty
LOG:
PLAYER dealt 16 hp damage.
cardiverse> _
```

### 7.3 Interaction v0.2 输入模型

MVP 的默认交互不应要求玩家记忆大量命令。终端保持极客视觉，但输入模型以低记忆成本为主。

| 输入 | 行为 |
|---|---|
| 普通自然语言 | 默认当作 Prompt 编译卡牌 |
| `c <prompt>` | 显式编译 Prompt |
| `1`-`5` | 打出对应 Cache 卡 |
| `d1`-`d5` | 将对应 Cache 卡挂载为 Daemon |
| `k1`-`k5` | 将对应 Cache 卡安装为 Kernel |
| `i1`-`i5` | 查看对应 Cache 卡详情 |
| `e` | 结束当前回合 |
| `a` | 请求 AI 给出建议 |
| `g` | 让 AI 托管当前回合 |
| `q` | 退出游戏 |
| `:<command>` | 进入高级命令模式，例如 `:log`、`:save-log` |

### 7.4 AI Control Plane

AI 不能直接修改 `GameState`，只能提交结构化 `PlayerAction`，并由本地 dispatcher 再次校验合法性。

```ts
type PlayerAction =
  | { type: "compile"; prompt: string }
  | { type: "play"; cacheIndex: number; cardId?: string }
  | { type: "mount"; cacheIndex: number; cardId?: string }
  | { type: "trap"; cacheIndex: number; cardId?: string }
  | { type: "end" };
```

AI 模式：

- `a`: AI 建议一条动作，但不执行。
- `g`: AI 托管当前玩家回合。
- `cardiverse --auto-player`: 规则 AI 自动挑战当前 Boss，用于测试和未来自博弈。

### 7.5 高级命令集

| 命令 | 说明 |
|---|---|
| `help` | 显示命令列表 |
| `new` | 开始新游戏 |
| `status` | 显示双方状态与内存区 |
| `compile <prompt>` | 将 Prompt 编译为卡，并放入 Cache |
| `play <cacheIndex>` | 打出 Cache 中的即时攻击 |
| `mount <cacheIndex>` | 将 Daemon 类型卡挂载到 Daemon 区 |
| `trap <cacheIndex>` | 将 Kernel 类型卡安装到 Kernel 区 |
| `inspect <zone> <index>` | 查看卡牌详情 |
| `end` | 结束玩家回合 |
| `log` | 查看完整战斗日志 |
| `save-log` | 保存当前战斗日志 |
| `settings` | 查看或修改本地设置 |
| `restart` | 重开当前 Boss 战 |
| `quit` | 退出游戏 |

### 7.6 快捷键

MVP 可选支持：

| 快捷键 | 行为 |
|---|---|
| `Ctrl+C` | 退出或二次确认退出 |
| `Tab` | 在主要面板之间切换焦点 |
| `↑ / ↓` | 浏览命令历史 |
| `Esc` | 关闭详情弹窗或返回主战斗界面 |

快捷键不能替代命令。所有核心操作必须有命令等价物。

### 7.7 交互反馈

所有反馈都应以终端日志呈现：

```txt
> compile rewrite its fear as a recursive loop
COMPILER: parsing semantic intent...
SCHEMA: valid
BALANCE: cost overwritten from 2 to 5
CACHE[2]: Recursive Loop loaded
```

错误反馈：

```txt
> compile delete the boss from memory forever
COMPILER: rejected
ERROR: ILLEGAL_RULE_MUTATION
HINT: Try a bounded attack, daemon, or kernel trap.
```

---

## 8. CLI 安装与运行设计

### 8.1 npm 包信息

建议包名：

```txt
terminal-cardiverse
```

CLI 命令：

```txt
cardiverse
```

`package.json` 示例：

```json
{
  "name": "terminal-cardiverse",
  "type": "module",
  "bin": {
    "cardiverse": "./dist/cli.js"
  }
}
```

### 8.2 命令行参数

MVP 支持：

| 命令 | 说明 |
|---|---|
| `cardiverse` | 启动 TUI |
| `cardiverse --help` | 查看 CLI 帮助 |
| `cardiverse --version` | 查看版本 |
| `cardiverse --no-llm` | 强制使用 stub compiler |
| `cardiverse --provider ollama` | 使用 Ollama provider |
| `cardiverse --debug` | 输出调试日志 |

后续可扩展：

| 命令 | 说明 |
|---|---|
| `cardiverse replay <file>` | 回放战斗日志 |
| `cardiverse simulate <boss>` | Headless 模拟 |
| `cardiverse export` | 导出本地数据 |
| `cardiverse import <file>` | 导入卡组或 Boss |

### 8.3 本地目录

建议使用用户目录存储配置和数据：

```txt
~/.terminal-cardiverse/
  config.json
  saves/
  logs/
  cards/
  bosses/
```

MVP 至少需要：

- `config.json`
- `logs/`

---

## 9. Boss 设计 - MVP 首领

### 9.1 Boss 名称

**INIT ECHO / 初始回声**

### 9.2 Boss 定位

教学型但有真实威胁的第一个 Boss。它代表系统启动时残留的异常回声，会使用低强度物理攻击、逻辑污染和简单防御。

### 9.3 初始属性

```txt
hp: 120
sanity: 90
ram: 0
ramGainPerTurn: 8
ramMax: 18
```

### 9.4 ASCII 形象

```txt
     .-----------.
    /  INIT ECHO \
   |  0x00 :: 0xFF |
   |   checksum?   |
    \   repeat    /
     '-----------'
```

### 9.5 Boss 卡组

MVP Boss 使用手写固定卡池，不依赖实时 LLM。

#### Static Pulse

```json
{
  "kind": "attack",
  "name": "Static Pulse",
  "target": "enemy",
  "effects": [
    { "type": "damage", "track": "hp", "amount": 10 }
  ],
  "tags": ["electric"],
  "cost": 3
}
```

#### Echo Doubt

```json
{
  "kind": "attack",
  "name": "Echo Doubt",
  "target": "enemy",
  "effects": [
    { "type": "damage", "track": "sanity", "amount": 12 }
  ],
  "tags": ["logic"],
  "cost": 4
}
```

#### Checksum Skin

```json
{
  "kind": "daemon",
  "name": "Checksum Skin",
  "target": "self",
  "duration": 3,
  "effects": [
    { "type": "shield", "track": "hp", "amount": 6 }
  ],
  "tags": ["defense"],
  "cost": 5
}
```

#### Boot Loop

```json
{
  "kind": "attack",
  "name": "Boot Loop",
  "target": "enemy",
  "effects": [
    { "type": "damage", "track": "sanity", "amount": 8 },
    { "type": "damage", "track": "hp", "amount": 6 }
  ],
  "tags": ["hybrid"],
  "cost": 5
}
```

### 9.6 Boss 行为策略

MVP 使用简单确定性策略：

1. 如果 Boss HP 低于 50 且没有防御 Daemon，优先使用 `Checksum Skin`。
2. 如果玩家 Sanity 低于 35，优先使用 `Echo Doubt` 或 `Boot Loop`。
3. 如果玩家 HP 低于 35，优先使用 `Static Pulse` 或 `Boot Loop`。
4. 否则在可支付 cost 的卡中选择第一张可用卡。
5. 如果 RAM 不足，结束回合。

---

## 10. 系统架构

### 10.1 模块划分

建议项目结构：

```txt
src/
  cli/
    index.ts
    args.ts
    commandRegistry.ts
  tui/
    App.tsx
    BattleScreen.tsx
    panels/
      StatusPanel.tsx
      MemoryPanel.tsx
      BossPanel.tsx
      LogPanel.tsx
      CommandInput.tsx
  core/
    state.ts
    rules.ts
    effects.ts
    turn.ts
    cost.ts
    winner.ts
    log.ts
  compiler/
    schema.ts
    stubCompiler.ts
    llmCompiler.ts
    balance.ts
    providers/
      ollama.ts
      openai.ts
  content/
    bosses/
      initEcho.ts
    starterCards.ts
  storage/
    paths.ts
    config.ts
    battleLog.ts
  sim/
    headless.ts
    benchmark.ts
```

### 10.2 Core Engine

Core Engine 负责：

- 创建初始游戏状态。
- 执行回合开始逻辑。
- 处理 RAM 恢复。
- 执行 Daemon。
- 处理玩家行动。
- 处理 Boss 行动。
- 触发 Kernel。
- 应用 damage / heal / shield / gain_ram。
- 判断胜负。
- 生成结构化日志事件。

Core Engine 不负责：

- 渲染 TUI。
- 调用 LLM。
- 读取键盘输入。
- 读写用户文件。

### 10.3 TUI Layer

TUI Layer 负责：

- 渲染终端界面。
- 处理命令输入。
- 显示状态、日志、卡牌详情。
- 根据窗口尺寸调整布局。
- 调用 core 和 compiler。

TUI Layer 不应直接修改底层状态，应通过明确 action / command 调用 core。

### 10.4 Compiler Engine

Compiler Engine 分三层：

1. `stubCompiler`
   - 本地假编译器。
   - 用于 MVP 早期验证。
   - 根据关键词生成固定卡。

2. `llmCompiler`
   - 调用 OpenAI / Anthropic / Ollama 等模型。
   - 只返回候选 JSON。
   - 不直接写入游戏状态。

3. `balance`
   - 本地确定性平衡器。
   - 覆盖 cost。
   - 裁剪非法数值。
   - 添加 backlash。
   - 输出最终可执行卡牌。

### 10.5 Execution Flow

```txt
Terminal Input
  ↓
Command Parser
  ↓
Compiler / Core Action
  ↓
Candidate JSON
  ↓
Schema Validation
  ↓
Balance Engine
  ↓
Executable Card
  ↓
Game State Update
  ↓
Structured Logs
  ↓
Terminal TUI Render
```

---

## 11. LLM 接入策略

### 11.1 MVP 阶段

MVP 优先使用 `stubCompiler`。这样可以先验证核心乐趣，避免一开始被模型稳定性、API Key、费用和网络问题阻塞。

### 11.2 第二阶段

接入真实 LLM 时优先支持本地和 CLI 友好的方式：

| 模式 | 说明 | 风险 |
|---|---|---|
| Ollama Local | 本地模型，无 Key 泄露，适合终端产品 | 输出质量可能不稳定 |
| Env Key | 从环境变量读取云模型 Key | 用户需要理解环境变量配置 |
| Config File | 从 `~/.terminal-cardiverse/config.json` 读取配置 | 文件权限需要提示 |
| Serverless Proxy | 项目方提供极薄代理层 | 需要维护服务与额度控制 |

不建议在 MVP 中要求用户在 TUI 里输入云 API Key。

### 11.3 LLM Prompt 要求

系统提示词必须强调：

- 只输出 JSON。
- 不输出 Markdown。
- 不输出解释。
- 必须符合 Card DSL。
- 不允许 instant kill。
- 不允许无限资源。
- 高收益必须伴随 backlash。

但即使 LLM 遵守提示词，本地校验仍是最终边界。

---

## 12. 本地数据与存档

### 12.1 MVP 本地存储

MVP 保存：

- 用户设置。
- 是否启用真实 LLM。
- LLM Provider 配置。
- 最近编译过的 Prompt 历史。
- 战斗日志。

建议目录：

```txt
~/.terminal-cardiverse/
  config.json
  logs/
```

### 12.2 战斗日志格式

战斗日志建议保存为 JSON Lines，方便后续回放、统计和 Web 浏览。

```jsonl
{"turn":1,"type":"compile","prompt":"thermal spike","card":"Thermal Spike","cost":4}
{"turn":1,"type":"damage","source":"player","target":"boss","track":"hp","amount":16}
{"turn":2,"type":"damage","source":"boss","target":"player","track":"sanity","amount":12}
```

### 12.3 后续扩展

后续可以加入：

- 本地卡牌收藏。
- Boss 图鉴。
- 对战回放。
- YAML / JSON 导入导出。
- Web 资料库读取同一份本地数据或导出的数据。

---

## 13. 视觉与美术规范

### 13.1 总体风格

- 黑底终端。
- 等宽字体。
- 高对比 ANSI 色。
- 轻量 ASCII Art。
- 状态变化通过日志、颜色和字符反馈，不依赖图形特效。
- 终端尺寸不足时保持信息可读，而不是强行塞满面板。

### 13.2 色彩建议

| 用途 | 颜色 |
|---|---|
| 背景 | terminal default black |
| 主文本 | bright white / light green |
| 成功 / 修复 | green |
| 警告 / RAM | yellow |
| 逻辑 / Sanity | cyan |
| 错误 / HP damage | red |
| 系统提示 | gray |

### 13.3 文案语气

系统文案应该像底层进程日志：

```txt
SCHEMA: valid
RAM: -4
DAEMON: Cooling Loop ticked
KERNEL: Panic Mirror armed
ERROR: CORRUPTED_FILE
```

避免过度口语化、二次元化或传统奇幻 RPG 话术。

---

## 14. 开发里程碑

### Milestone 1 - Core Prototype

目标：没有 TUI，也能在测试中跑完一场战斗。

交付：

- GameState 类型。
- Card DSL 类型。
- 基础 effect 执行。
- 回合流。
- 胜负判断。
- Init Echo Boss 数据。
- 基础单元测试。

验收：

- 可以通过测试模拟玩家打出卡牌。
- HP / Sanity 任一归零时正确结束。
- RAM 不足时无法行动。
- Daemon 每回合触发。
- Kernel 满足条件时触发一次。

### Milestone 2 - Stub Compiler

目标：不用真实 LLM，也能从 Prompt 生成卡。

交付：

- `compile(prompt)` 接口。
- 关键词到卡牌的 stub 规则。
- Schema validation。
- Balance Engine。
- 编译失败错误类型。

验收：

- `compile thermal spike` 生成 HP 攻击。
- `compile recursive doubt` 生成 Sanity 攻击。
- 过强 Prompt 被裁剪或附加 backlash。
- 非法 Prompt 被拒绝。

### Milestone 3 - CLI + Terminal TUI

目标：玩家可以通过命令行完成一场 Boss 战。

交付：

- npm package 基础配置。
- `cardiverse` CLI 入口。
- Terminal TUI 主界面。
- 命令解析器。
- 状态渲染器。
- 战斗日志面板。
- Restart / Quit 流程。

验收：

- `npx terminal-cardiverse` 可以启动游戏。
- 输入 `help` 显示命令。
- 输入 `compile <prompt>` 生成 Cache 卡。
- 输入 `play 0` 可造成伤害。
- 输入 `end` 触发 Boss 回合。
- 玩家可击败 Boss。
- Boss 可击败玩家。

### Milestone 4 - Local Persistence

目标：终端游戏具备基础本地数据能力。

交付：

- `~/.terminal-cardiverse/config.json`。
- 战斗日志保存。
- Prompt 历史。
- 基础设置命令。

验收：

- `save-log` 可将当前战斗保存到本地。
- 重启游戏后设置仍然存在。
- 不存在配置目录时自动创建。

### Milestone 5 - Real LLM Compiler

目标：接入真实模型，但不影响本地规则稳定性。

交付：

- Provider 抽象。
- Ollama 支持。
- 环境变量读取云模型 Key。
- LLM 输出修复和错误处理。
- 模型失败 fallback 到 stub。

验收：

- 模型返回合法 JSON 时可生成卡。
- 模型输出非法内容时不会破坏状态。
- 本地 balance 仍覆盖最终 cost 和数值。

### Milestone 6 - Headless Simulation

目标：为后续自博弈和 Boss 调参打基础。

交付：

- Node.js headless runner。
- 固定玩家测试卡组。
- 批量模拟。
- 胜率报告。

验收：

- 可以运行 1,000 局无 TUI 对战。
- 输出 Boss 胜率、平均回合数、常见死因。

---

## 15. MVP 验收标准

MVP 完成标准：

- 用户可以用 `npx terminal-cardiverse` 启动游戏。
- 不需要账户系统。
- 不需要 Web 页面。
- 不需要真实 LLM Key 也能游玩。
- 一场完整战斗可在 5-10 分钟内结束。
- 玩家至少有 3 种有效策略：
  - 快速攻击 HP。
  - 专注攻击 Sanity。
  - 挂载 Daemon 后打持久战。
- 非法 Prompt 会被拒绝或降级。
- 所有状态变化都有日志。
- 战斗日志可保存到本地。
- 终端窗口缩放不会导致游戏不可操作。

---

## 16. 主要风险与对策

### 16.1 TUI 兼容性

风险：不同终端、不同尺寸、不同系统下渲染不一致。

对策：

- 优先支持 macOS / Linux / Windows Terminal。
- 提供紧凑布局。
- 避免依赖过宽字符。
- ASCII 优先，Unicode 边框可作为增强。
- 保证无颜色模式也可读。

### 16.2 LLM 幻觉

风险：模型输出不合法 JSON 或越权效果。

对策：

- 强 schema 校验。
- 本地 balance。
- 非法输出直接失败。
- UI 中显示 `CORRUPTED_FILE`。

### 16.3 Prompt 许愿破坏平衡

风险：玩家输入“秒杀 Boss”“无限 RAM”等。

对策：

- 禁止规则变更类效果。
- 单卡数值上限。
- 高收益自动 backlash。
- 本地 cost 覆盖模型 cost。

### 16.4 用户配置复杂

风险：LLM Provider、API Key、Ollama 配置对用户不友好。

对策：

- MVP 默认 stub，无配置可玩。
- 真实 LLM 作为可选增强。
- `settings` 中显示当前 provider 状态。
- CLI 帮助明确环境变量格式。

---

## 17. 后续路线

### Phase 2 - 内容扩展

- 增加 3-5 个 Boss。
- 增加更多关键词和效果。
- 增加 Prompt 历史与收藏。
- 增加本地卡库导入导出。

### Phase 3 - LLM 深度玩法

- 多 Provider 接入。
- LLM 生成 Boss 草案。
- LLM 生成 ASCII Art。
- 玩家 Prompt 风格分析。

### Phase 4 - Headless 自博弈调参

- 生成 Boss 配置。
- 与标准测试卡组自动对战。
- 根据胜率生成 nerf / buff 建议。
- 导出 YAML。

### Phase 5 - Web 资料库

- 浏览本地或导出的战斗历史。
- 查看卡牌收藏。
- 查看 Boss 图鉴。
- 可视化胜率、死因、Prompt 使用频率。
- 分享回放和关卡。

### Phase 6 - 社区关卡生态

- GitHub Repository 作为官方关卡源。
- Pull Request 提交 Boss。
- 自动 CI 跑 simulation。
- Release 打包关卡。

---

## 18. 一句话版本

第一阶段要做的不是“网页里的 AI 卡牌游戏”，而是：

> 一个通过 npm 安装、在真实终端中运行、能完整打完一场 Prompt 编译 Boss 战的 TUI 游戏。
