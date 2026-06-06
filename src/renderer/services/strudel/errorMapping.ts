import type { StudioError } from '../../../shared/types';
import { mapCombinedLineToFile, type CombinedProgramSection } from './programCombiner';

type ParsedLocation = {
  line?: number;
  column?: number;
};

const parseLocation = (text: string): ParsedLocation => {
  const lineColumn = text.match(/(?:line\s*)?(\d+)(?::|,\s*column\s*)(\d+)/i);
  if (lineColumn?.[1] && lineColumn[2]) {
    return {
      line: Number(lineColumn[1]),
      column: Number(lineColumn[2]),
    };
  }

  const explicitLine = text.match(/line\s+(\d+)/i);
  return explicitLine?.[1] ? { line: Number(explicitLine[1]) } : {};
};

export const toStudioError = (raw: unknown, sections: CombinedProgramSection[]): StudioError => {
  const message = raw instanceof Error ? raw.message : String(raw);
  const stack = raw instanceof Error ? raw.stack ?? '' : '';
  const parsed = parseLocation(`${message}\n${stack}`);

  if (parsed.line) {
    const fileLocation = mapCombinedLineToFile(parsed.line, sections);
    if (fileLocation) {
      return {
        message,
        filePath: fileLocation.relativePath,
        line: fileLocation.line,
        column: parsed.column,
        raw,
      };
    }
  }

  return {
    message,
    line: parsed.line,
    column: parsed.column,
    raw,
  };
};
