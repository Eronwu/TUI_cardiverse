import type { BossDefinition } from "../../core/types.js";
import { initEchoStory } from "../story/terminalCardiverse.js";

export const initEcho: BossDefinition = {
  id: "init-echo",
  name: "INIT ECHO",
  title: "Initial Residual Process",
  ascii: [
    "     .-----------.",
    "    /  INIT ECHO \\",
    "   |  0x00 :: 0xFF |",
    "   |   checksum?   |",
    "    \\   repeat    /",
    "     '-----------'"
  ],
  hp: 120,
  sanity: 90,
  ramMax: 18,
  ramGainPerTurn: 8,
  deck: [
    {
      id: "init-echo-static-pulse",
      kind: "attack",
      name: "Static Pulse",
      description: "A low-voltage burst leaks through the terminal boundary.",
      target: "enemy",
      effects: [{ type: "damage", track: "hp", amount: 10 }],
      tags: ["electric"],
      cost: 3
    },
    {
      id: "init-echo-echo-doubt",
      kind: "attack",
      name: "Echo Doubt",
      description: "A repeated checksum question destabilizes the target process.",
      target: "enemy",
      effects: [{ type: "damage", track: "sanity", amount: 12 }],
      tags: ["logic"],
      cost: 4
    },
    {
      id: "init-echo-checksum-skin",
      kind: "daemon",
      name: "Checksum Skin",
      description: "A defensive checksum layer absorbs shell-level corruption.",
      target: "self",
      duration: 3,
      effects: [{ type: "shield", track: "hp", amount: 6 }],
      tags: ["defense"],
      cost: 5
    },
    {
      id: "init-echo-boot-loop",
      kind: "attack",
      name: "Boot Loop",
      description: "A broken boot sequence attacks both shell and logic layers.",
      target: "enemy",
      effects: [
        { type: "damage", track: "sanity", amount: 8 },
        { type: "damage", track: "hp", amount: 6 }
      ],
      tags: ["hybrid"],
      cost: 5
    }
  ],
  intro: initEchoStory.lines
};
