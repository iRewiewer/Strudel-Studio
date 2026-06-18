export type StrudelSliderDescriptor = {
  id: string;
  displayId: string;
  line: number;
  column: number;
  functionName: string | null;
  value: number;
  min: number;
  max: number;
  step: number;
  callStart: number;
  firstArgumentStart: number;
  argumentListStart: number;
  argumentListEnd: number;
  arguments: StrudelSliderArguments;
};

export type StrudelSliderArgumentName = 'value' | 'min' | 'max' | 'step';

export type SourceArgument = {
  start: number;
  end: number;
  text: string;
};

export type SourceOffsetEdit = {
  transformedStart: number;
  transformedEnd: number;
  originalStart: number;
  originalEnd: number;
};

export type StableSliderIdTransform = {
  source: string;
  offsetEdits: SourceOffsetEdit[];
};

export type StrudelSliderArguments = {
  value: SourceArgument;
  min: SourceArgument | null;
  max: SourceArgument | null;
  step: SourceArgument | null;
};

const sliderCallee = 'slider';

const isIdentifierCharacter = (value: string | undefined): boolean => {
  return Boolean(value && /[A-Za-z0-9_$]/.test(value));
};

const skipQuotedString = (source: string, index: number, quote: string): number => {
  let cursor = index + 1;
  while (cursor < source.length) {
    if (source[cursor] === '\\') {
      cursor += 2;
      continue;
    }
    if (source[cursor] === quote) {
      return cursor + 1;
    }
    cursor += 1;
  }
  return source.length;
};

const skipLineComment = (source: string, index: number): number => {
  const nextLine = source.indexOf('\n', index + 2);
  return nextLine === -1 ? source.length : nextLine + 1;
};

const skipBlockComment = (source: string, index: number): number => {
  const commentEnd = source.indexOf('*/', index + 2);
  return commentEnd === -1 ? source.length : commentEnd + 2;
};

const skipIgnorable = (source: string, index: number): number => {
  const current = source[index];
  const next = source[index + 1];

  if (current === '"' || current === "'" || current === '`') {
    return skipQuotedString(source, index, current);
  }
  if (current === '/' && next === '/') {
    return skipLineComment(source, index);
  }
  if (current === '/' && next === '*') {
    return skipBlockComment(source, index);
  }

  return index;
};

const findMatchingParen = (source: string, openIndex: number): number | null => {
  let depth = 0;
  let cursor = openIndex;

  while (cursor < source.length) {
    const skipped = skipIgnorable(source, cursor);
    if (skipped !== cursor) {
      cursor = skipped;
      continue;
    }

    if (source[cursor] === '(') {
      depth += 1;
    } else if (source[cursor] === ')') {
      depth -= 1;
      if (depth === 0) {
        return cursor;
      }
    }

    cursor += 1;
  }

  return null;
};

const trimArgument = (source: string, start: number, end: number): SourceArgument | null => {
  let trimmedStart = start;
  let trimmedEnd = end;

  while (trimmedStart < trimmedEnd && /\s/.test(source.charAt(trimmedStart))) {
    trimmedStart += 1;
  }
  while (trimmedEnd > trimmedStart && /\s/.test(source.charAt(trimmedEnd - 1))) {
    trimmedEnd -= 1;
  }

  if (trimmedStart >= trimmedEnd) {
    return null;
  }

  return {
    start: trimmedStart,
    end: trimmedEnd,
    text: source.slice(trimmedStart, trimmedEnd),
  };
};

const splitArguments = (source: string, start: number, end: number): SourceArgument[] => {
  const args: SourceArgument[] = [];
  let depth = 0;
  let argumentStart = start;
  let cursor = start;

  while (cursor < end) {
    const skipped = skipIgnorable(source, cursor);
    if (skipped !== cursor) {
      cursor = skipped;
      continue;
    }

    if (source[cursor] === '(' || source[cursor] === '[' || source[cursor] === '{') {
      depth += 1;
    } else if (source[cursor] === ')' || source[cursor] === ']' || source[cursor] === '}') {
      depth -= 1;
    } else if (source[cursor] === ',' && depth === 0) {
      const argument = trimArgument(source, argumentStart, cursor);
      if (argument) {
        args.push(argument);
      }
      argumentStart = cursor + 1;
    }

    cursor += 1;
  }

  const finalArgument = trimArgument(source, argumentStart, end);
  if (finalArgument) {
    args.push(finalArgument);
  }

  return args;
};

const toFiniteNumber = (value: string | undefined): number | null => {
  if (!value) {
    return null;
  }

  const numericValue = Number(value.trim());
  return Number.isFinite(numericValue) ? numericValue : null;
};

const getLineColumn = (source: string, offset: number): { line: number; column: number } => {
  let line = 1;
  let column = 1;

  for (let index = 0; index < offset; index += 1) {
    if (source[index] === '\n') {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }

  return { line, column };
};

const getFunctionName = (source: string, callStart: number): string | null => {
  const previousOpenParen = source.lastIndexOf('(', callStart - 1);
  if (previousOpenParen === -1) {
    return null;
  }

  const prefix = source.slice(0, previousOpenParen).trimEnd();
  const match = prefix.match(/(?:\.|\b)([A-Za-z_$][\w$]*)$/);
  return match?.[1] ?? null;
};

const createSliderId = (relativePath: string, firstArgumentStart: number): string => {
  return `studio:${relativePath}:slider:${firstArgumentStart}`;
};

const createDisplayId = (firstArgumentStart: number): string => {
  return `slider_${firstArgumentStart}`;
};

const formatSourceNumber = (value: number): string => {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return Number(value.toFixed(6)).toString();
};

const getArgumentValue = (
  argumentName: StrudelSliderArgumentName,
  args: StrudelSliderArguments,
): SourceArgument | null => {
  return args[argumentName];
};

export const findStrudelSliders = (source: string, relativePath: string): StrudelSliderDescriptor[] => {
  const sliders: StrudelSliderDescriptor[] = [];
  let cursor = 0;

  while (cursor < source.length) {
    const skipped = skipIgnorable(source, cursor);
    if (skipped !== cursor) {
      cursor = skipped;
      continue;
    }

    if (
      source.startsWith(sliderCallee, cursor) &&
      !isIdentifierCharacter(source[cursor - 1]) &&
      !isIdentifierCharacter(source[cursor + sliderCallee.length])
    ) {
      const calleeEnd = cursor + sliderCallee.length;
      let openIndex = calleeEnd;
      while (/\s/.test(source.charAt(openIndex))) {
        openIndex += 1;
      }

      if (source[openIndex] === '(') {
        const closeIndex = findMatchingParen(source, openIndex);
        if (closeIndex !== null) {
          const args = splitArguments(source, openIndex + 1, closeIndex);
          const value = toFiniteNumber(args[0]?.text);

          if (value !== null && args[0]) {
            const min = toFiniteNumber(args[1]?.text) ?? 0;
            const max = toFiniteNumber(args[2]?.text) ?? 1;
            const normalizedMax = max > min ? max : min + 1;
            const explicitStep = toFiniteNumber(args[3]?.text);
            const step = explicitStep && explicitStep > 0 ? explicitStep : Math.max((normalizedMax - min) / 100, 0.001);
            const location = getLineColumn(source, cursor);

            sliders.push({
              id: createSliderId(relativePath, args[0].start),
              displayId: createDisplayId(args[0].start),
              line: location.line,
              column: location.column,
              functionName: getFunctionName(source, cursor),
              value,
              min,
              max: normalizedMax,
              step,
              callStart: cursor,
              firstArgumentStart: args[0].start,
              argumentListStart: openIndex + 1,
              argumentListEnd: closeIndex,
              arguments: {
                value: args[0],
                min: args[1] ?? null,
                max: args[2] ?? null,
                step: args[3] ?? null,
              },
            });
          }

          cursor = closeIndex + 1;
          continue;
        }
      }
    }

    cursor += 1;
  }

  return sliders;
};

export const updateStrudelSliderArgument = (
  source: string,
  slider: StrudelSliderDescriptor,
  argumentName: StrudelSliderArgumentName,
  value: number,
): string => {
  const nextValue = formatSourceNumber(value);
  const existingArgument = getArgumentValue(argumentName, slider.arguments);

  if (existingArgument) {
    return source.slice(0, existingArgument.start) + nextValue + source.slice(existingArgument.end);
  }

  const nextArguments = [
    slider.arguments.value.text,
    slider.arguments.min?.text ?? formatSourceNumber(slider.min),
    slider.arguments.max?.text ?? formatSourceNumber(slider.max),
    slider.arguments.step?.text ?? formatSourceNumber(slider.step),
  ];
  const argumentIndex: Record<StrudelSliderArgumentName, number> = {
    value: 0,
    min: 1,
    max: 2,
    step: 3,
  };
  const nextArgumentIndex = argumentIndex[argumentName];
  nextArguments[nextArgumentIndex] = nextValue;

  return (
    source.slice(0, slider.argumentListStart) +
    nextArguments.slice(0, nextArgumentIndex + 1).join(', ') +
    source.slice(slider.argumentListEnd)
  );
};

export const mapStableSliderTransformedOffsetToOriginal = (offset: number, edits: SourceOffsetEdit[]): number => {
  let accumulatedDelta = 0;

  for (const edit of edits) {
    if (offset < edit.transformedStart) {
      break;
    }

    if (offset < edit.transformedEnd) {
      const originalLength = edit.originalEnd - edit.originalStart;
      if (originalLength <= 0) {
        return edit.originalStart;
      }

      const relativeOffset = offset - edit.transformedStart;
      return Math.min(edit.originalEnd, edit.originalStart + Math.min(relativeOffset, originalLength));
    }

    accumulatedDelta += (edit.transformedEnd - edit.transformedStart) - (edit.originalEnd - edit.originalStart);
  }

  return offset - accumulatedDelta;
};

export const applyStableSliderIdsWithMap = (source: string, relativePath: string): StableSliderIdTransform => {
  const sliders = findStrudelSliders(source, relativePath);
  let output = source;
  const offsetEdits: SourceOffsetEdit[] = [];
  let accumulatedDelta = 0;

  for (const slider of sliders) {
    const replacement = 'sliderWithID';
    offsetEdits.push({
      transformedStart: slider.callStart + accumulatedDelta,
      transformedEnd: slider.callStart + accumulatedDelta + replacement.length,
      originalStart: slider.callStart,
      originalEnd: slider.callStart + sliderCallee.length,
    });
    accumulatedDelta += replacement.length - sliderCallee.length;

    const insertion = `${JSON.stringify(slider.id)}, `;
    offsetEdits.push({
      transformedStart: slider.firstArgumentStart + accumulatedDelta,
      transformedEnd: slider.firstArgumentStart + accumulatedDelta + insertion.length,
      originalStart: slider.firstArgumentStart,
      originalEnd: slider.firstArgumentStart,
    });
    accumulatedDelta += insertion.length;
  }

  for (const slider of [...sliders].reverse()) {
    output =
      output.slice(0, slider.callStart) +
      'sliderWithID' +
      output.slice(slider.callStart + sliderCallee.length, slider.firstArgumentStart) +
      `${JSON.stringify(slider.id)}, ` +
      output.slice(slider.firstArgumentStart);
  }

  return {
    source: output,
    offsetEdits,
  };
};

export const applyStableSliderIds = (source: string, relativePath: string): string => {
  return applyStableSliderIdsWithMap(source, relativePath).source;
};
