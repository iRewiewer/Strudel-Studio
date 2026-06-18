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
import { getCps, getTime } from '@strudel/core';
import type { StudioError } from '../../../shared/types';
import {
  combineStrudelFiles,
  type CombinedProgram,
  type PlayableStrudelFile,
} from './programCombiner';
import { toStudioError } from './errorMapping';

type StrudelWindow = Window & {
  sliderWithID?: (id: string, value: number, min?: number, max?: number, step?: number) => number;
};

type PatternPrototype = Record<string, (...args: unknown[]) => unknown>;

const studioRootId = 'root';
const visualWidgetMethods = [
  'pianoroll',
  '_pianoroll',
  'punchcard',
  '_punchcard',
  'wordfall',
  '_wordfall',
  'pitchwheel',
  '_pitchwheel',
  'spiral',
  '_spiral',
  'scope',
  '_scope',
  'tscope',
  '_tscope',
  'fscope',
  '_fscope',
  'spectrum',
  '_spectrum',
];

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
  private previewStopTimeout: number | null = null;
  private loadedExternalSampleSources = new Set<string>();
  private loadedPluginScripts = new Map<string, string>();
  private sliderValues = new Map<string, number>();

  setSampleManifestUrl(manifestUrl: string | null): void {
    this.sampleManifestUrl = manifestUrl;
    if (!manifestUrl) {
      this.loadedSampleManifestUrl = null;
    }
  }

  setSliderValue(id: string, value: number): void {
    if (!Number.isFinite(value)) {
      return;
    }

    this.sliderValues.set(id, value);
  }

  async playFiles(files: PlayableStrudelFile[], restart: boolean): Promise<PlaybackResult> {
    this.clearPreviewStopTimeout();
    const program = combineStrudelFiles(files);
    await this.ensureInitialized();
    await this.ensureAudioReady();

    if (restart) {
      await this.stop();
    }

    await this.loadProjectSamples();

    try {
      await evaluate(program.code, true);
      this.cleanupStrudelDomArtifacts();
      return { ok: true, program };
    } catch (error) {
      this.cleanupStrudelDomArtifacts();
      return {
        ok: false,
        program,
        error: toStudioError(error, program.sections),
      };
    }
  }

  async stop(): Promise<void> {
    this.clearPreviewStopTimeout();
    if (!this.initPromise) {
      return;
    }

    await this.initPromise;
    await Promise.resolve(hush());
    this.cleanupStrudelDomArtifacts();
  }

  async panic(): Promise<void> {
    await this.stop();
    resetGlobalEffects();
  }

  async previewSound(soundName: string, volume = 0.9): Promise<void> {
    const trimmedName = soundName.trim();
    if (!trimmedName) {
      return;
    }

    const previewGain = Math.min(Math.max(volume, 0), 1);
    this.clearPreviewStopTimeout();
    await this.ensureInitialized();
    await this.ensureAudioReady();
    await this.stop();
    await this.loadProjectSamples();
    try {
      await evaluate(`s(${JSON.stringify(trimmedName)}).gain(${previewGain})`, true);
    } finally {
      this.cleanupStrudelDomArtifacts();
    }

    this.previewStopTimeout = window.setTimeout(() => {
      this.previewStopTimeout = null;
      void this.panic();
    }, 900);
  }

  async loadExternalSamples(source: string, cacheKey = source): Promise<void> {
    if (this.loadedExternalSampleSources.has(cacheKey)) {
      return;
    }

    await this.ensureInitialized();
    await this.ensureAudioReady();
    await Promise.resolve(samples(source));
    this.loadedExternalSampleSources.add(cacheKey);
  }

  forgetExternalSamples(source: string): void {
    this.loadedExternalSampleSources.delete(source);
  }

  async loadPlugin(pluginId: string, code: string): Promise<void> {
    if (this.loadedPluginScripts.has(pluginId)) {
      return;
    }

    await this.ensureInitialized();
    try {
      await Promise.resolve(evaluate(code, false));
    } finally {
      this.cleanupStrudelDomArtifacts();
    }
    this.loadedPluginScripts.set(pluginId, code);
  }

  unloadPlugin(pluginId: string): void {
    this.loadedPluginScripts.delete(pluginId);
  }

  getPlaybackTime(): number | null {
    if (!this.initPromise) {
      return null;
    }

    try {
      const time = Number(getTime());
      const cps = Number(getCps());
      if (!Number.isFinite(time)) {
        return null;
      }

      return Number.isFinite(cps) && cps > 0 ? time * cps : time;
    } catch {
      return null;
    }
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
            this.disableVisualWidgets();
            await this.loadProjectSamples();
          },
        }),
      ).then(() => undefined);
    }
    await this.initPromise;
  }

  private clearPreviewStopTimeout(): void {
    if (this.previewStopTimeout === null) {
      return;
    }

    window.clearTimeout(this.previewStopTimeout);
    this.previewStopTimeout = null;
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

  private sliderWithID = (id: string, value: number, min?: number, max?: number, step?: number): number => {
    const previous = this.sliderValues.get(id);
    const next = previous ?? value;
    const lower = min ?? Number.NEGATIVE_INFINITY;
    const upper = max ?? Number.POSITIVE_INFINITY;
    const clamped = Math.min(Math.max(next, lower), upper);
    this.sliderValues.set(id, clamped);
    return clamped;
  };

  private disableVisualWidgets(): void {
    const prototype = Pattern.prototype as PatternPrototype;
    const passthroughWidget = function passthroughWidget(this: unknown): unknown {
      return this;
    };

    for (const methodName of visualWidgetMethods) {
      prototype[methodName] = passthroughWidget;
    }
  }

  private cleanupStrudelDomArtifacts(): void {
    for (const child of Array.from(document.body.children)) {
      if (child.id === studioRootId) {
        continue;
      }

      child.remove();
    }
  }
}
