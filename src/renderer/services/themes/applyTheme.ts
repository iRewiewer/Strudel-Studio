import type { StudioTheme } from '../../../shared/types';

const cssVariableByColor = {
  background: '--studio-background',
  surface: '--studio-surface',
  panel: '--studio-panel',
  border: '--studio-border',
  primary: '--studio-primary',
  primaryText: '--studio-primary-text',
  text: '--studio-text',
  mutedText: '--studio-muted-text',
  warning: '--studio-warning',
  danger: '--studio-danger',
  editorBackground: '--studio-editor-background',
  editorText: '--studio-editor-text',
} as const;

export const applyStudioTheme = (theme: StudioTheme): void => {
  const root = document.documentElement;

  for (const [key, variableName] of Object.entries(cssVariableByColor)) {
    root.style.setProperty(variableName, theme.colors[key as keyof StudioTheme['colors']]);
  }

  root.style.setProperty('--studio-interface-font', theme.fonts.interface);
  root.style.setProperty('--studio-editor-font', theme.fonts.editor);
  root.style.setProperty('--studio-editor-font-size', `${theme.fontSizes.editor}px`);
};
