import { evalScope, initStrudel } from '@strudel/web';
import type { StudioError } from '../../../shared/types';
import {
  combineStrudelFiles,
  type CombinedProgram,
  type PlayableStrudelFile,
} from './programCombiner';
import { toStudioError } from './errorMapping';

type StrudelWindow = Window & {
  evaluate?: (source: string) => unknown | Promise<unknown>;
  hush?: () => unknown | Promise<unknown>;
  samples?: (source: string) => unknown | Promise<unknown>;
  sliderWithID?: (id: string, value: number, min?: number, max?: number) => number;
};

export type PlaybackResult =
  | {
      ok: true;
      program: CombinedProgram;
    }
  | {
      ok: false;
      program: CombinedProgram;
      error: StudioError;
    };

export class StrudelPlaybackService {
  private initPromise: Promise<void> | null = null;
  private sampleManifestUrl: string | null = null;
  private loadedSampleManifestUrl: string | null = null;
  private sliderValues = new Map<string, number>();

  setSampleManifestUrl(manifestUrl: string | null): void {
    this.sampleManifestUrl = manifestUrl;
    if (!manifestUrl) {
      this.loadedSampleManifestUrl = null;
    }
  }

  async playFiles(files: PlayableStrudelFile[], restart: boolean): Promise<PlaybackResult> {
    const program = combineStrudelFiles(files);
    await this.ensureInitialized();

    if (restart) {
      await this.stop();
    }

    await this.loadProjectSamples();

    try {
      await Promise.resolve(this.getStrudelFunction('evaluate')(program.code));
      return { ok: true, program };
    } catch (error) {
      return {
        ok: false,
        program,
        error: toStudioError(error, program.sections),
      };
    }
  }

  async stop(): Promise<void> {
    const hush = (window as StrudelWindow).hush;
    if (typeof hush === 'function') {
      await Promise.resolve(hush());
    }
  }

  async panic(): Promise<void> {
    await this.stop();
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initPromise) {
      const sliderWithID = this.sliderWithID;
      (window as StrudelWindow).sliderWithID = sliderWithID;
      this.initPromise = Promise.resolve(
        initStrudel({
          prebake: async () => {
            await evalScope({ sliderWithID });
            await this.loadProjectSamples();
          },
        }),
      ).then(() => undefined);
    }
    await this.initPromise;
  }

  private async loadProjectSamples(): Promise<void> {
    if (!this.sampleManifestUrl || this.loadedSampleManifestUrl === this.sampleManifestUrl) {
      return;
    }

    const samples = (window as StrudelWindow).samples;
    if (typeof samples === 'function') {
      const cacheBustedUrl = `${this.sampleManifestUrl}?studio=${Date.now()}`;
      await Promise.resolve(samples(cacheBustedUrl));
      this.loadedSampleManifestUrl = this.sampleManifestUrl;
    }
  }

  private getStrudelFunction(name: 'evaluate'): NonNullable<StrudelWindow['evaluate']> {
    const candidate = (window as StrudelWindow)[name];
    if (typeof candidate !== 'function') {
      throw new Error(`Strudel ${name}() is not available after initialization.`);
    }
    return candidate;
  }

  private sliderWithID = (id: string, value: number, min?: number, max?: number): number => {
    const previous = this.sliderValues.get(id);
    const next = previous ?? value;
    const lower = min ?? Number.NEGATIVE_INFINITY;
    const upper = max ?? Number.POSITIVE_INFINITY;
    const clamped = Math.min(Math.max(next, lower), upper);
    this.sliderValues.set(id, clamped);
    return clamped;
  };
}
