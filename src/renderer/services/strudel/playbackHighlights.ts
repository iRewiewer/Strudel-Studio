import { transpiler } from '@strudel/transpiler';

export type PlaybackHighlightRange = {
  from: number;
  to: number;
};

export type PlaybackHighlightGroup = {
  ranges: PlaybackHighlightRange[];
};

type StringSpan = {
  from: number;
  to: number;
};

const isEscaped = (source: string, index: number): boolean => {
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && source[cursor] === '\\'; cursor -= 1) {
    slashCount += 1;
  }

  return slashCount % 2 === 1;
};

const findMiniStringSpans = (source: string): StringSpan[] => {
  const spans: StringSpan[] = [];

  for (let index = 0; index < source.length; index += 1) {
    const quote = source[index];
    if (quote !== '"' && quote !== '`') {
      continue;
    }

    const start = index;
    index += 1;
    while (index < source.length) {
      if (source[index] === quote && !isEscaped(source, index)) {
        spans.push({ from: start + 1, to: index });
        break;
      }
      index += 1;
    }
  }

  return spans;
};

const findContainingSpan = (spans: StringSpan[], range: PlaybackHighlightRange): StringSpan | null => {
  return spans.find((span) => range.from >= span.from && range.to <= span.to) ?? null;
};

export const collectPlaybackHighlightGroups = (source: string): PlaybackHighlightGroup[] => {
  const result = transpiler(source, { emitMiniLocations: true, emitWidgets: false }) as {
    miniLocations?: Array<[number, number]>;
  };
  const miniLocations = result.miniLocations ?? [];
  const spans = findMiniStringSpans(source);
  const groupsBySpan = new Map<string, PlaybackHighlightRange[]>();
  const fallbackRanges: PlaybackHighlightRange[] = [];

  for (const [from, to] of miniLocations) {
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
      continue;
    }

    const range = { from, to };
    const span = findContainingSpan(spans, range);
    if (!span) {
      fallbackRanges.push(range);
      continue;
    }

    const key = `${span.from}:${span.to}`;
    groupsBySpan.set(key, [...(groupsBySpan.get(key) ?? []), range]);
  }

  return [
    ...Array.from(groupsBySpan.values()),
    ...fallbackRanges.map((range) => [range]),
  ]
    .map((ranges) => ({ ranges: ranges.sort((left, right) => left.from - right.from) }))
    .filter((group) => group.ranges.length > 0);
};

export const getActivePlaybackHighlightRanges = (
  groups: PlaybackHighlightGroup[],
  playbackTime: number,
): PlaybackHighlightRange[] => {
  const phase = ((playbackTime % 1) + 1) % 1;

  return groups
    .map((group) => {
      const index = Math.min(group.ranges.length - 1, Math.floor(phase * group.ranges.length));
      return group.ranges[index];
    })
    .filter((range): range is PlaybackHighlightRange => Boolean(range));
};
