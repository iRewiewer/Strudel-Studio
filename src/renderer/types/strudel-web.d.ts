declare module '@strudel/web' {
  export const Pattern: {
    prototype: Record<string, unknown>;
  };

  export const strudelScope: Record<string, unknown>;

  export function evalScope(...modules: Array<Record<string, unknown> | Promise<Record<string, unknown>>>): Promise<unknown[]>;

  export function evaluate(code: string, autoplay?: boolean): Promise<unknown>;

  export function getAudioContext(): AudioContext;

  export function hush(): void;

  export function initAudio(options?: Record<string, unknown>): Promise<void>;

  export function initStrudel(options?: {
    editPattern?: (pattern: unknown) => unknown;
    beforeStart?: () => unknown | Promise<unknown>;
    prebake?: () => unknown | Promise<unknown>;
  }): Promise<unknown> | unknown;

  export function resetGlobalEffects(): void;

  export function samples(source: string): unknown | Promise<unknown>;
}
