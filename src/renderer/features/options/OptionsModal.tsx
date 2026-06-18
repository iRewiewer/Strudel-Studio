import { X } from 'lucide-react';
import { useEffect } from 'react';
import type { StudioSettings } from '../../types/workbench';

type OptionsModalProps = {
  open: boolean;
  settings: StudioSettings;
  onChangeSettings: (settings: StudioSettings) => void;
  onClose: () => void;
};

type OptionKey = keyof StudioSettings;

const options: Array<{
  key: OptionKey;
  title: string;
  detail: string;
}> = [
  {
    key: 'keepPlayAllSelectionOnClose',
    title: 'Keep enabled files after closing tabs',
    detail: 'Closing the last tab hides the file but keeps it included in Play All.',
  },
  {
    key: 'openFileOnInclude',
    title: 'Open files when enabling Play All',
    detail: 'Checking a file also opens it in the active editor panel.',
  },
  {
    key: 'liveReevaluate',
    title: 'Live re-evaluate while playing',
    detail: 'Edits to playing files are sent to Strudel automatically.',
  },
];

export const OptionsModal = ({
  open,
  settings,
  onChangeSettings,
  onClose,
}: OptionsModalProps): JSX.Element | null => {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  const updateOption = (key: OptionKey, value: boolean): void => {
    onChangeSettings({
      ...settings,
      [key]: value,
    });
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section className="options-modal" role="dialog" aria-modal="true" aria-labelledby="options-title">
        <header className="theme-modal-header">
          <div>
            <p className="eyebrow">Preferences</p>
            <h2 id="options-title">Options</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} title="Close">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <main className="options-body">
          {options.map((option) => (
            <label className="option-row" key={option.key}>
              <span>
                <strong>{option.title}</strong>
                <small>{option.detail}</small>
              </span>
              <input
                type="checkbox"
                checked={settings[option.key]}
                onChange={(event) => updateOption(option.key, event.target.checked)}
              />
            </label>
          ))}
        </main>
      </section>
    </div>
  );
};
