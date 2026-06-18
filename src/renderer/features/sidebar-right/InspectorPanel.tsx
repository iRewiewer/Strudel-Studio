import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  AudioWaveform,
  BookOpen,
  ChevronDown,
  ChevronRight,
  FolderTree,
  Info,
  Music,
  Search,
  SlidersHorizontal,
  Volume2,
} from 'lucide-react';
import type { SampleServerInfo, StudioError } from '../../../shared/types';
import { SidebarTabs, type SidebarTabDefinition } from '../../components/SidebarTabs';
import { InstructionLookupPanel } from '../docs/InstructionLookupPanel';
import {
  findStrudelSliders,
  type StrudelSliderArgumentName,
  type StrudelSliderDescriptor,
} from '../../services/strudel/sliderScanner';
import type { ExternalSampleGroup } from '../../services/strudel/externalSamplePacks';
import type { EditorFile } from '../../types/workbench';

type InspectorPanelProps = {
  sampleServer: SampleServerInfo | null;
  playbackError: StudioError | null;
  activeFile: EditorFile | null;
  sliderValues: Record<string, number>;
  externalSampleGroups: ExternalSampleGroup[];
  onSliderArgumentChange: (
    slider: StrudelSliderDescriptor,
    argumentName: StrudelSliderArgumentName,
    value: number,
  ) => void;
  onPreviewSound: (soundName: string, volume: number) => Promise<void>;
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

type InfoPanelProps = {
  sampleServer: SampleServerInfo | null;
  playbackError: StudioError | null;
};

type SlidersPanelProps = {
  activeFile: EditorFile | null;
  sliderValues: Record<string, number>;
  onSliderArgumentChange: (
    slider: StrudelSliderDescriptor,
    argumentName: StrudelSliderArgumentName,
    value: number,
  ) => void;
};

type SoundsPanelProps = {
  sampleServer: SampleServerInfo | null;
  externalSampleGroups: ExternalSampleGroup[];
  onPreviewSound: (soundName: string, volume: number) => Promise<void>;
};

type SoundGroup = {
  id: string;
  title: string;
  names: string[];
};

const builtInSoundGroups: SoundGroup[] = [
  {
    id: 'built-in-synths',
    title: 'Synths',
    names: ['triangle', 'tri', 'square', 'sqr', 'sawtooth', 'saw', 'sine', 'sin', 'pulse', 'supersaw', 'sbd', 'bytebeat'],
  },
  {
    id: 'built-in-noise',
    title: 'Noise',
    names: ['white', 'pink', 'brown', 'crackle'],
  },
  {
    id: 'built-in-utility',
    title: 'Utility',
    names: ['bus', 'one', 'user'],
  },
];

type SoundGroupDrawerProps = {
  id: string;
  title: string;
  names: string[];
  collapsed: boolean;
  emptyMessage?: string;
  previewVolume: number;
  onToggle: (id: string) => void;
  onPreviewSound: (soundName: string, volume: number) => Promise<void>;
};

const SoundGroupDrawer = ({
  id,
  title,
  names,
  collapsed,
  emptyMessage,
  previewVolume,
  onToggle,
  onPreviewSound,
}: SoundGroupDrawerProps): JSX.Element => {
  return (
    <article className={`sound-group ${collapsed ? 'is-collapsed' : ''}`}>
      <button
        type="button"
        className="sound-group-heading"
        onClick={() => onToggle(id)}
        aria-expanded={!collapsed}
      >
        {collapsed ? <ChevronRight size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}
        <h3>{title}</h3>
        <span className="sound-group-count">{names.length}</span>
      </button>

      {!collapsed ? (
        names.length > 0 ? (
          <div className="sound-chip-list">
            {names.map((name) => (
              <button
                type="button"
                className="sound-chip"
                key={`${id}-${name}`}
                onClick={() => void onPreviewSound(name, previewVolume)}
                title={`Play ${name}`}
              >
                {name}
              </button>
            ))}
          </div>
        ) : (
          <p className="detail-line sound-group-empty">{emptyMessage ?? 'No matching sounds.'}</p>
        )
      ) : null}
    </article>
  );
};

const formatSliderNumber = (value: number): string => {
  return Number.isInteger(value) ? String(value) : Number(value.toFixed(4)).toString();
};

const clampSliderValue = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

const commitNumberInput = (
  event: React.FocusEvent<HTMLInputElement> | React.KeyboardEvent<HTMLInputElement>,
  currentValue: number,
  onCommit: (value: number) => void,
): void => {
  const input = event.currentTarget;
  const nextValue = Number(input.value);

  if (!Number.isFinite(nextValue)) {
    input.value = formatSliderNumber(currentValue);
    return;
  }

  onCommit(nextValue);
};

type EditableSliderNumberProps = {
  label: string;
  value: number;
  min?: number;
  step?: number | 'any';
  onCommit: (value: number) => void;
};

const EditableSliderNumber = ({
  label,
  value,
  min,
  step,
  onCommit,
}: EditableSliderNumberProps): JSX.Element => {
  return (
    <label className="slider-number-field">
      <span>{label}</span>
      <strong>{formatSliderNumber(value)}</strong>
      <input
        key={`${label}-${value}`}
        type="number"
        defaultValue={formatSliderNumber(value)}
        min={min}
        step={step ?? 'any'}
        onBlur={(event) => commitNumberInput(event, value, onCommit)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            commitNumberInput(event, value, onCommit);
            event.currentTarget.blur();
          }
        }}
      />
    </label>
  );
};

const InfoPanel = ({
  sampleServer,
  playbackError,
}: InfoPanelProps): JSX.Element => {
  return (
    <>
      <section className="inspector-section">
        <div className="section-title">
          <Music size={16} aria-hidden="true" />
          <h2>Playback</h2>
        </div>
        <p className="detail-line">Mode: combined fallback</p>
        <p className="detail-line">Update: live re-evaluate</p>
      </section>

      <section className="inspector-section">
        <div className="section-title">
          <FolderTree size={16} aria-hidden="true" />
          <h2>Samples</h2>
        </div>
        {sampleServer ? (
          <>
            <p className="detail-line">{sampleServer.sampleCount} local names</p>
            <p className="path-label" title={sampleServer.manifestUrl}>
              {sampleServer.manifestUrl}
            </p>
          </>
        ) : (
          <p className="detail-line">No local samples folder</p>
        )}
      </section>

      {playbackError ? (
        <section className="inspector-section error-section">
          <div className="section-title">
            <AlertTriangle size={16} aria-hidden="true" />
            <h2>Error</h2>
          </div>
          {playbackError.filePath ? <p className="detail-line">{playbackError.filePath}</p> : null}
          {playbackError.line ? (
            <p className="detail-line">
              line {playbackError.line}
              {playbackError.column ? `, column ${playbackError.column}` : ''}
            </p>
          ) : null}
          <pre>{playbackError.message}</pre>
        </section>
      ) : null}
    </>
  );
};

const SlidersPanel = ({
  activeFile,
  sliderValues,
  onSliderArgumentChange,
}: SlidersPanelProps): JSX.Element => {
  const sliders = useMemo(
    () => (activeFile ? findStrudelSliders(activeFile.content, activeFile.relativePath) : []),
    [activeFile],
  );

  if (!activeFile) {
    return <p className="empty-sidebar-state">No active file.</p>;
  }

  if (sliders.length === 0) {
    return (
      <section className="inspector-section">
        <div className="section-title">
          <SlidersHorizontal size={16} aria-hidden="true" />
          <h2>Sliders</h2>
        </div>
        <p className="detail-line">No slider calls in {activeFile.name}.</p>
      </section>
    );
  }

  return (
    <section className="inspector-section slider-section">
      <div className="section-title">
        <SlidersHorizontal size={16} aria-hidden="true" />
        <h2>Sliders</h2>
      </div>

      <div className="slider-control-list">
        {sliders.map((slider) => {
          const currentValue = clampSliderValue(sliderValues[slider.id] ?? slider.value, slider.min, slider.max);

          return (
            <article className="slider-control-card" key={slider.id}>
              <div className="slider-control-heading">
                <span>
                  line {slider.line}
                  {slider.functionName ? ` · ${slider.functionName}()` : ''}
                </span>
                <output>{formatSliderNumber(currentValue)}</output>
              </div>
              <input
                type="range"
                min={slider.min}
                max={slider.max}
                step={slider.step}
                value={currentValue}
                aria-label={`${slider.displayId} on line ${slider.line}`}
                onChange={(event) =>
                  onSliderArgumentChange(slider, 'value', Number(event.currentTarget.value))
                }
              />
              <div className="slider-argument-row">
                <EditableSliderNumber
                  label="min:"
                  value={slider.min}
                  step={slider.step}
                  onCommit={(value) => onSliderArgumentChange(slider, 'min', value)}
                />
                <EditableSliderNumber
                  label="max:"
                  value={slider.max}
                  step={slider.step}
                  onCommit={(value) => onSliderArgumentChange(slider, 'max', value)}
                />
                <EditableSliderNumber
                  label="step:"
                  value={slider.step}
                  min={0.000001}
                  step="any"
                  onCommit={(value) => onSliderArgumentChange(slider, 'step', value)}
                />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

const SoundsPanel = ({ sampleServer, externalSampleGroups, onPreviewSound }: SoundsPanelProps): JSX.Element => {
  const [query, setQuery] = useState('');
  const [previewVolume, setPreviewVolume] = useState(0.9);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [sampleNames, setSampleNames] = useState<string[]>([]);
  const [sampleError, setSampleError] = useState<string | null>(null);

  useEffect(() => {
    if (!sampleServer) {
      setSampleNames([]);
      setSampleError(null);
      return undefined;
    }

    const controller = new AbortController();
    void fetch(sampleServer.manifestUrl, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Sample manifest returned ${response.status}.`);
        }
        return response.json() as Promise<Record<string, unknown>>;
      })
      .then((manifest) => {
        const names = Object.keys(manifest)
          .filter((name) => name !== '_base')
          .sort((left, right) => left.localeCompare(right));
        setSampleNames(names);
        setSampleError(null);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        setSampleError(error instanceof Error ? error.message : String(error));
      });

    return () => controller.abort();
  }, [sampleServer]);

  const normalizedQuery = query.trim().toLowerCase();
  const filterNames = (names: string[]): string[] => {
    return normalizedQuery
      ? names.filter((name) => name.toLowerCase().includes(normalizedQuery))
      : names;
  };
  const filteredSampleNames = filterNames(sampleNames);
  const filteredExternalSampleGroups = externalSampleGroups
    .map((group) => ({ ...group, names: filterNames(group.names) }))
    .filter((group) => group.names.length > 0);
  const toggleCollapsedGroup = (id: string): void => {
    setCollapsedGroups((previous) => ({ ...previous, [id]: !previous[id] }));
  };

  return (
    <section className="sound-browser">
      <div className="section-title">
        <AudioWaveform size={16} aria-hidden="true" />
        <h2>Sounds</h2>
      </div>

      <label className="sound-preview-volume">
        <span>
          <Volume2 size={15} aria-hidden="true" />
          Preview volume
        </span>
        <output>{Math.round(previewVolume * 100)}%</output>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={previewVolume}
          onChange={(event) => setPreviewVolume(Number(event.currentTarget.value))}
          aria-label="Sound preview volume"
        />
      </label>

      <label className="lookup-search">
        <Search size={15} aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search sounds"
          aria-label="Search sounds"
        />
      </label>

      {builtInSoundGroups.map((group) => {
        const names = filterNames(group.names);
        if (names.length === 0) {
          return null;
        }

        return (
          <SoundGroupDrawer
            key={group.id}
            id={group.id}
            title={group.title}
            names={names}
            collapsed={Boolean(collapsedGroups[group.id])}
            previewVolume={previewVolume}
            onToggle={toggleCollapsedGroup}
            onPreviewSound={onPreviewSound}
          />
        );
      })}

      <SoundGroupDrawer
        id="project-samples"
        title="Project Samples"
        names={sampleError ? [] : filteredSampleNames}
        collapsed={Boolean(collapsedGroups['project-samples'])}
        emptyMessage={sampleError ?? (sampleServer ? 'No matching local samples.' : 'No local samples folder.')}
        previewVolume={previewVolume}
        onToggle={toggleCollapsedGroup}
        onPreviewSound={onPreviewSound}
      />

      {filteredExternalSampleGroups.map((group) => (
        <SoundGroupDrawer
          key={`external-${group.id}`}
          id={`external-${group.id}`}
          title={group.title}
          names={group.names}
          collapsed={Boolean(collapsedGroups[`external-${group.id}`])}
          previewVolume={previewVolume}
          onToggle={toggleCollapsedGroup}
          onPreviewSound={onPreviewSound}
        />
      ))}
    </section>
  );
};

export const InspectorPanel = ({
  sampleServer,
  playbackError,
  activeFile,
  sliderValues,
  externalSampleGroups,
  onSliderArgumentChange,
  onPreviewSound,
  collapsed,
  onToggleCollapsed,
}: InspectorPanelProps): JSX.Element => {
  const tabs: SidebarTabDefinition[] = [
    {
      id: 'info',
      label: 'Info',
      icon: <Info size={15} aria-hidden="true" />,
      content: <InfoPanel sampleServer={sampleServer} playbackError={playbackError} />,
    },
    {
      id: 'sliders',
      label: 'Sliders',
      icon: <SlidersHorizontal size={15} aria-hidden="true" />,
      content: (
        <SlidersPanel
          activeFile={activeFile}
          sliderValues={sliderValues}
          onSliderArgumentChange={onSliderArgumentChange}
        />
      ),
    },
    {
      id: 'sounds',
      label: 'Sounds',
      icon: <AudioWaveform size={15} aria-hidden="true" />,
      content: (
        <SoundsPanel
          sampleServer={sampleServer}
          externalSampleGroups={externalSampleGroups}
          onPreviewSound={onPreviewSound}
        />
      ),
    },
    {
      id: 'instructions',
      label: 'Docs',
      icon: <BookOpen size={15} aria-hidden="true" />,
      content: <InstructionLookupPanel />,
    },
  ];

  return (
    <aside className={`sidebar sidebar-right ${collapsed ? 'is-collapsed' : ''}`} aria-label="Inspector">
      <SidebarTabs
        tabs={tabs}
        ariaLabel="Inspector tabs"
        collapsed={collapsed}
        onToggleCollapsed={onToggleCollapsed}
      />
    </aside>
  );
};
