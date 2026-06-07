import {
  evalScope,
  evaluate,
  getAudioContext,
  hush,
  initAudio,
  initStrudel,
  Pattern,
  resetGlobalEffects,
  samples,
} from '@strudel/web';
import type { StudioError } from '../../../shared/types';
import {
  combineStrudelFiles,
  type CombinedProgram,
  type PlayableStrudelFile,
} from './programCombiner';
import { toStudioError } from './errorMapping';

type StrudelWindow = Window & {
  sliderWithID?: (id: string, value: number, min?: number, max?: number) => number;
};

type WidgetOptions = Record<string, unknown>;

type PatternPrototype = Record<string, (...args: unknown[]) => unknown>;

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
  private audioReadyPromise: Promise<void> | null = null;
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
    await this.ensureAudioReady();

    if (restart) {
      await this.stop();
    }

    await this.loadProjectSamples();

    try {
      await evaluate(program.code, true);
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
    if (!this.initPromise) {
      return;
    }

    await this.initPromise;
    await Promise.resolve(hush());
  }

  async panic(): Promise<void> {
    await this.stop();
    resetGlobalEffects();
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initPromise) {
      const sliderWithID = this.sliderWithID;
      (window as StrudelWindow).sliderWithID = sliderWithID;
      this.initPromise = Promise.resolve(
        initStrudel({
          beforeStart: () => this.ensureAudioReady(),
          prebake: async () => {
            await evalScope({ sliderWithID });
            this.installWidgetAliases();
            await this.loadProjectSamples();
          },
        }),
      ).then(() => undefined);
    }
    await this.initPromise;
  }

  private async ensureAudioReady(): Promise<void> {
    if (!this.audioReadyPromise) {
      this.audioReadyPromise = (async () => {
        await initAudio();
        const audioContext = getAudioContext();
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }
      })();
    }

    await this.audioReadyPromise;
  }

  private async loadProjectSamples(): Promise<void> {
    if (!this.sampleManifestUrl || this.loadedSampleManifestUrl === this.sampleManifestUrl) {
      return;
    }

    const cacheBustedUrl = `${this.sampleManifestUrl}?studio=${Date.now()}`;
    await Promise.resolve(samples(cacheBustedUrl));
    this.loadedSampleManifestUrl = this.sampleManifestUrl;
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

  private installWidgetAliases(): void {
    const prototype = Pattern.prototype as PatternPrototype;

    const aliasWidget = (plainName: string, transformedName: string): void => {
      const plainMethod = prototype[plainName];
      if (typeof plainMethod !== 'function' || typeof prototype[transformedName] === 'function') {
        return;
      }

      prototype[transformedName] = function widgetAlias(this: unknown, widgetIdOrOptions?: unknown, options?: unknown) {
        const widgetOptions =
          typeof widgetIdOrOptions === 'string'
            ? { ...(isWidgetOptions(options) ? options : {}), id: widgetIdOrOptions }
            : isWidgetOptions(widgetIdOrOptions)
              ? widgetIdOrOptions
              : {};
        return plainMethod.call(this, widgetOptions);
      };
    };

    aliasWidget('pianoroll', '_pianoroll');
    aliasWidget('punchcard', '_punchcard');
    aliasWidget('wordfall', '_wordfall');
    aliasWidget('pitchwheel', '_pitchwheel');
    aliasWidget('spiral', '_spiral');
    aliasWidget('scope', '_scope');
    aliasWidget('tscope', '_tscope');
    aliasWidget('spectrum', '_spectrum');
  }
}

const isWidgetOptions = (value: unknown): value is WidgetOptions => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};
