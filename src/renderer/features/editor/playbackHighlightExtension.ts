import type { Extension } from '@codemirror/state';
import { Decoration, EditorView } from '@codemirror/view';
import type { PlaybackHighlightRange } from '../../services/strudel/playbackHighlights';

export const playbackHighlightExtension = (ranges: PlaybackHighlightRange[]): Extension => {
  const decorations = Decoration.set(
    ranges
      .filter((range) => range.to > range.from)
      .map((range) => Decoration.mark({ class: 'cm-playback-highlight' }).range(range.from, range.to)),
    true,
  );

  return EditorView.decorations.of(decorations);
};
