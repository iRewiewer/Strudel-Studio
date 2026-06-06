declare module '@strudel/web' {
  export function evalScope(...modules: Array<Record<string, unknown> | Promise<Record<string, unknown>>>): Promise<unknown[]>;

  export function initStrudel(options?: {
    prebake?: () => unknown | Promise<unknown>;
  }): Promise<unknown> | unknown;
}
