declare module '@strudel/web' {
  export function initStrudel(options?: {
    prebake?: () => unknown | Promise<unknown>;
  }): Promise<unknown> | unknown;
}
