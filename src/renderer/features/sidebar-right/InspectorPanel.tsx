import { useMemo } from 'react';
import { AlertTriangle, FolderTree, Info, Music, SlidersHorizontal } from 'lucide-react';
import type { SampleServerInfo, StudioError } from '../../../shared/types';
import { SidebarTabs, type SidebarTabDefinition } from '../../components/SidebarTabs';
import {
  findStrudelSliders,
  type StrudelSliderArgumentName,
  type StrudelSliderDescriptor,
} from '../../services/strudel/sliderScanner';
import type { EditorFile } from '../../types/workbench';

type InspectorPanelProps = {
  sampleServer: SampleServerInfo | null;
  playbackError: StudioError | null;
  workspacePath: string | null;
  activeFile: EditorFile | null;
  sliderValues: Record<string, number>;
  onSliderArgumentChange: (
    slider: StrudelSliderDescriptor,
    argumentName: StrudelSliderArgumentName,
    value: number,
  ) => void;
};

type InfoPanelProps = {
  sampleServer: SampleServerInfo | null;
  playbackError: StudioError | null;
  workspacePath: string | null;
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
  workspacePath,
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

      <section className="inspector-section">
        <div className="section-title">
          <FolderTree size={16} aria-hidden="true" />
          <h2>Workspace</h2>
        </div>
        <p className="path-label" title={workspacePath ?? undefined}>
          {workspacePath ?? 'Not saved yet'}
        </p>
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

export const InspectorPanel = ({
  sampleServer,
  playbackError,
  workspacePath,
  activeFile,
  sliderValues,
  onSliderArgumentChange,
}: InspectorPanelProps): JSX.Element => {
  const tabs: SidebarTabDefinition[] = [
    {
      id: 'info',
      label: 'Info',
      icon: <Info size={15} aria-hidden="true" />,
      content: (
        <InfoPanel sampleServer={sampleServer} playbackError={playbackError} workspacePath={workspacePath} />
      ),
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
  ];

  return (
    <aside className="sidebar sidebar-right" aria-label="Inspector">
      <SidebarTabs tabs={tabs} ariaLabel="Inspector tabs" />
    </aside>
  );
};
