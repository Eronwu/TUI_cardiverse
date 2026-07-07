import type { BattleLogEvent, GameState } from "./types.js";

export type NewBattleLogEvent = BattleLogEvent extends infer Event
  ? Event extends BattleLogEvent
    ? Omit<Event, "id" | "turn">
    : never
  : never;

export function appendLog(state: GameState, event: NewBattleLogEvent): GameState {
  return {
    ...state,
    logs: [
      ...state.logs,
      {
        ...event,
        id: `log-${state.logs.length + 1}`,
        turn: state.turn
      } as BattleLogEvent
    ]
  };
}
