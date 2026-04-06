declare module './wasm/pkg/atari_go_ai.js' {
  export default function init(options: { module_or_path: URL | string }): Promise<void>;
  export function init(seed: number): void;
  export function set_position(board: Uint8Array, toPlay: number): void;
  export function best_move(timeMs: number, level: number): number;
  export function stats(): unknown;
}
