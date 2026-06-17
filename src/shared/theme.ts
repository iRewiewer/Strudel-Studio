import type { StudioTheme, ThemeColorKey, ThemeFontKey } from './types';

export const themeColorKeys: ThemeColorKey[] = [
  'background',
  'surface',
  'panel',
  'border',
  'primary',
  'primaryText',
  'text',
  'mutedText',
  'warning',
  'danger',
  'editorBackground',
  'editorText',
];

export const themeFontKeys: ThemeFontKey[] = ['interface', 'editor'];

export const defaultStudioTheme: StudioTheme = {
  version: 1,
  name: 'Strudel Studio Default',
  colors: {
    background: '#101312',
    surface: '#171b19',
    panel: '#151917',
    border: '#28302c',
    primary: '#95d988',
    primaryText: '#10220e',
    text: '#f2f6ef',
    mutedText: '#87938b',
    warning: '#f0ba67',
    danger: '#f26d6d',
    editorBackground: '#0f1211',
    editorText: '#f2f6ef',
  },
  fonts: {
    interface: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    editor: '"Cascadia Code", "Fira Code", Consolas, monospace',
  },
};
