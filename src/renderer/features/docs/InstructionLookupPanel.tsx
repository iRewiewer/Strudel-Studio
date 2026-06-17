import { useMemo, useState } from 'react';
import { BookOpen, Search } from 'lucide-react';
import { strudelScope } from '@strudel/web';
import controlsSource from '@strudel/core/controls.mjs?raw';
import euclidSource from '@strudel/core/euclid.mjs?raw';
import patternSource from '@strudel/core/pattern.mjs?raw';
import pickSource from '@strudel/core/pick.mjs?raw';
import signalSource from '@strudel/core/signal.mjs?raw';
import tonalSource from '@strudel/tonal/tonal.mjs?raw';

type InstructionCategory =
  | 'Pattern'
  | 'Structure'
  | 'Time'
  | 'Random'
  | 'Pitch'
  | 'Sound'
  | 'Envelope'
  | 'Filter'
  | 'Effect'
  | 'Sample'
  | 'MIDI'
  | 'Visual'
  | 'System'
  | 'Internal';

type InstructionMetadata = {
  category: InstructionCategory;
  signature: string;
  description: string;
  tags?: string[];
};

type InstructionEntry = InstructionMetadata & {
  name: string;
};

type RuntimeInstructionDoc = {
  description: string;
  signature: string;
  tags: string[];
};

const runtimeDocSources = [
  controlsSource,
  euclidSource,
  patternSource,
  pickSource,
  signalSource,
  tonalSource,
];

const cleanDocLine = (line: string): string => {
  return line.replace(/^\s*\*\s?/, '').trimEnd();
};

const normalizeParamName = (value: string): string => {
  const withoutDecorators = value
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .replace(/^\.\.\./, '');
  const [beforeDefault = ''] = withoutDecorators.split('=');
  const [rootName = ''] = beforeDefault.split('.');
  return rootName.trim();
};

const parseDocNames = (value: string): string[] => {
  return value
    .split(/[,\s]+/)
    .map((name) => name.trim())
    .filter(Boolean);
};

const parseRuntimeDocBlock = (block: string): Array<[string, RuntimeInstructionDoc]> => {
  const lines = block.split('\n').map(cleanDocLine);
  const names: string[] = [];
  const tags: string[] = [];
  const params: string[] = [];
  const descriptionLines: string[] = [];
  let readingDescription = true;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      if (readingDescription && descriptionLines.length > 0) {
        descriptionLines.push(' ');
      }
      continue;
    }

    if (!trimmed.startsWith('@')) {
      if (readingDescription) {
        descriptionLines.push(trimmed);
      }
      continue;
    }

    readingDescription = false;
    if (trimmed.startsWith('@name ')) {
      names.push(...parseDocNames(trimmed.slice('@name '.length)));
      continue;
    }

    if (trimmed.startsWith('@synonyms ')) {
      names.push(...parseDocNames(trimmed.slice('@synonyms '.length)));
      continue;
    }

    if (trimmed.startsWith('@memberof ')) {
      tags.push(trimmed.slice('@memberof '.length).trim());
      continue;
    }

    if (trimmed.startsWith('@superdirtOnly')) {
      tags.push('superdirt');
      continue;
    }

    if (trimmed.startsWith('@param ')) {
      const paramMatch = trimmed.match(/^@param\s+\{[^}]+\}\s+([^\s]+)/);
      const paramName = paramMatch?.[1] ? normalizeParamName(paramMatch[1]) : '';
      if (paramName && !params.includes(paramName)) {
        params.push(paramName);
      }
    }
  }

  const description = descriptionLines
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (names.length === 0 || !description) {
    return [];
  }

  return uniqueInstructionNames(names).map((name) => [
    name,
    {
      description,
      signature: `${name}(${params.join(', ')})`,
      tags,
    },
  ]);
};

const parseRuntimeDocs = (): Map<string, RuntimeInstructionDoc> => {
  const docs = new Map<string, RuntimeInstructionDoc>();
  const blockPattern = /\/\*\*([\s\S]*?)\*\//g;

  for (const source of runtimeDocSources) {
    for (const match of source.matchAll(blockPattern)) {
      for (const [name, doc] of parseRuntimeDocBlock(match[1] ?? '')) {
        if (!docs.has(name)) {
          docs.set(name, doc);
        }
      }
    }
  }

  return docs;
};

function uniqueInstructionNames(names: string[]): string[] {
  return [...new Set(names.filter((name) => /^[A-Za-z_$][\w$]*$/.test(name)))];
}

const runtimeDocsByName = parseRuntimeDocs();

const curatedInstructions: Record<string, InstructionMetadata> = {
  s: {
    category: 'Sample',
    signature: 's("bd sd hh")',
    description: 'Selects sample names for playback.',
    tags: ['sound'],
  },
  sound: {
    category: 'Sample',
    signature: 'sound("bd sd")',
    description: 'Alias for sample or synth sound selection.',
    tags: ['s'],
  },
  note: {
    category: 'Pitch',
    signature: 'note("c e g")',
    description: 'Sets notes by name, MIDI number, or pattern.',
  },
  n: {
    category: 'Pitch',
    signature: 'n("0 2 4")',
    description: 'Sets numeric note, sample, or scale degrees depending on context.',
  },
  chord: {
    category: 'Pitch',
    signature: 'chord("C^7 Am7")',
    description: 'Builds harmonic note collections from chord symbols.',
  },
  scale: {
    category: 'Pitch',
    signature: 'scale("C:minor")',
    description: 'Maps degrees through a named scale.',
  },
  stack: {
    category: 'Structure',
    signature: 'stack(patternA, patternB)',
    description: 'Plays patterns at the same time.',
  },
  cat: {
    category: 'Structure',
    signature: 'cat(patternA, patternB)',
    description: 'Concatenates patterns one after another.',
  },
  seq: {
    category: 'Structure',
    signature: 'seq("bd", "sd")',
    description: 'Sequences values across a cycle.',
  },
  arrange: {
    category: 'Structure',
    signature: 'arrange([4, patternA], [2, patternB])',
    description: 'Builds longer forms from duration and pattern pairs.',
  },
  fast: {
    category: 'Time',
    signature: 'fast(2)',
    description: 'Speeds a pattern up by a factor.',
  },
  slow: {
    category: 'Time',
    signature: 'slow(2)',
    description: 'Slows a pattern down by a factor.',
  },
  early: {
    category: 'Time',
    signature: 'early(0.125)',
    description: 'Moves events earlier in time.',
  },
  late: {
    category: 'Time',
    signature: 'late(0.125)',
    description: 'Moves events later in time.',
  },
  off: {
    category: 'Time',
    signature: 'off(0.25, x => x.rev())',
    description: 'Adds a transformed copy offset in time.',
  },
  every: {
    category: 'Structure',
    signature: 'every(4, rev)',
    description: 'Applies a transformation every N cycles.',
  },
  when: {
    category: 'Structure',
    signature: 'when(condition, transform)',
    description: 'Applies a transformation when a condition matches.',
  },
  sometimes: {
    category: 'Random',
    signature: 'sometimes(transform)',
    description: 'Occasionally applies a transformation.',
  },
  rarely: {
    category: 'Random',
    signature: 'rarely(transform)',
    description: 'Applies a transformation with low probability.',
  },
  degrade: {
    category: 'Random',
    signature: 'degrade()',
    description: 'Randomly removes events from a pattern.',
  },
  degradeBy: {
    category: 'Random',
    signature: 'degradeBy(0.25)',
    description: 'Randomly removes events by a given amount.',
  },
  choose: {
    category: 'Random',
    signature: 'choose("bd", "sd", "hh")',
    description: 'Chooses one value randomly.',
  },
  rand: {
    category: 'Random',
    signature: 'rand.range(0, 1)',
    description: 'Produces random values from 0 to 1.',
  },
  irand: {
    category: 'Random',
    signature: 'irand(8)',
    description: 'Produces random integers below the supplied maximum.',
  },
  euclid: {
    category: 'Structure',
    signature: 'euclid(3, 8)',
    description: 'Distributes pulses evenly across steps.',
  },
  euclidRot: {
    category: 'Structure',
    signature: 'euclidRot(3, 8, 1)',
    description: 'Euclidean rhythm with rotation.',
  },
  struct: {
    category: 'Structure',
    signature: 'struct("x ~ x ~")',
    description: 'Applies a rhythmic mask or structure.',
  },
  mask: {
    category: 'Structure',
    signature: 'mask("<1 0 1 0>")',
    description: 'Keeps events where the mask is active.',
  },
  rev: {
    category: 'Structure',
    signature: 'rev()',
    description: 'Reverses event order inside the cycle.',
  },
  palindrome: {
    category: 'Structure',
    signature: 'palindrome()',
    description: 'Alternates forward and reversed cycles.',
  },
  iter: {
    category: 'Structure',
    signature: 'iter(4)',
    description: 'Rotates subdivisions over repeated cycles.',
  },
  jux: {
    category: 'Structure',
    signature: 'jux(rev)',
    description: 'Layers the original pattern with a transformed copy.',
  },
  superimpose: {
    category: 'Structure',
    signature: 'superimpose(x => x.fast(2))',
    description: 'Adds a transformed copy over the source pattern.',
  },
  gain: {
    category: 'Sound',
    signature: 'gain(0.8)',
    description: 'Sets output level.',
  },
  amp: {
    category: 'Sound',
    signature: 'amp(0.8)',
    description: 'Controls amplitude.',
  },
  pan: {
    category: 'Sound',
    signature: 'pan("<0 .5 1>")',
    description: 'Positions sound between left and right.',
  },
  speed: {
    category: 'Sample',
    signature: 'speed(1.5)',
    description: 'Changes sample playback speed.',
  },
  begin: {
    category: 'Sample',
    signature: 'begin(0.25)',
    description: 'Sets the sample start position.',
  },
  end: {
    category: 'Sample',
    signature: 'end(0.75)',
    description: 'Sets the sample end position.',
  },
  cut: {
    category: 'Sample',
    signature: 'cut(1)',
    description: 'Groups sample events so new events cut off old ones.',
  },
  loopAt: {
    category: 'Sample',
    signature: 'loopAt(4)',
    description: 'Stretches a sample loop across a cycle count.',
  },
  legato: {
    category: 'Envelope',
    signature: 'legato(1)',
    description: 'Controls event duration relative to its span.',
  },
  attack: {
    category: 'Envelope',
    signature: 'attack(0.01)',
    description: 'Sets attack time.',
  },
  decay: {
    category: 'Envelope',
    signature: 'decay(0.2)',
    description: 'Sets decay time.',
  },
  sustain: {
    category: 'Envelope',
    signature: 'sustain(0.7)',
    description: 'Sets sustain level or time.',
  },
  release: {
    category: 'Envelope',
    signature: 'release(0.4)',
    description: 'Sets release time.',
  },
  lpf: {
    category: 'Filter',
    signature: 'lpf(1200)',
    description: 'Sets low-pass filter cutoff.',
  },
  hpf: {
    category: 'Filter',
    signature: 'hpf(200)',
    description: 'Sets high-pass filter cutoff.',
  },
  bpf: {
    category: 'Filter',
    signature: 'bpf(900)',
    description: 'Sets band-pass filter cutoff.',
  },
  resonance: {
    category: 'Filter',
    signature: 'resonance(0.5)',
    description: 'Controls filter resonance.',
  },
  room: {
    category: 'Effect',
    signature: 'room(0.4)',
    description: 'Adds reverb amount.',
  },
  delay: {
    category: 'Effect',
    signature: 'delay(0.25)',
    description: 'Adds delay amount.',
  },
  delaytime: {
    category: 'Effect',
    signature: 'delaytime(0.25)',
    description: 'Sets delay time.',
  },
  delayfeedback: {
    category: 'Effect',
    signature: 'delayfeedback(0.5)',
    description: 'Sets delay feedback.',
  },
  crush: {
    category: 'Effect',
    signature: 'crush(8)',
    description: 'Applies bit crushing.',
  },
  shape: {
    category: 'Effect',
    signature: 'shape(0.4)',
    description: 'Adds waveshaping distortion.',
  },
  vowel: {
    category: 'Effect',
    signature: 'vowel("a e i")',
    description: 'Applies vowel-like filtering.',
  },
  orbit: {
    category: 'Sound',
    signature: 'orbit(1)',
    description: 'Routes events to an output orbit.',
  },
  cps: {
    category: 'Time',
    signature: 'setcps(0.75)',
    description: 'Cycles-per-second tempo control.',
  },
  cpm: {
    category: 'Time',
    signature: 'cpm(120)',
    description: 'Cycles-per-minute tempo control.',
  },
  samples: {
    category: 'Sample',
    signature: 'samples(source)',
    description: 'Loads sample maps.',
  },
  slider: {
    category: 'System',
    signature: 'slider(0.5, 0, 1, 0.01)',
    description: 'Creates an interactive numeric control.',
  },
  hush: {
    category: 'System',
    signature: 'hush()',
    description: 'Stops playback.',
  },
  midiport: {
    category: 'MIDI',
    signature: 'midiport("IAC Driver")',
    description: 'Selects a MIDI output port.',
  },
  midichan: {
    category: 'MIDI',
    signature: 'midichan(1)',
    description: 'Sets MIDI channel.',
  },
  ccn: {
    category: 'MIDI',
    signature: 'ccn(74)',
    description: 'Sets MIDI control-change number.',
  },
  ccv: {
    category: 'MIDI',
    signature: 'ccv(64)',
    description: 'Sets MIDI control-change value.',
  },
  color: {
    category: 'Visual',
    signature: 'color("cyan")',
    description: 'Sets event color metadata.',
  },
};

const categoryOrder: InstructionCategory[] = [
  'Pattern',
  'Structure',
  'Time',
  'Random',
  'Pitch',
  'Sound',
  'Envelope',
  'Filter',
  'Effect',
  'Sample',
  'MIDI',
  'Visual',
  'System',
  'Internal',
];

const fallbackNames = [
  'bank',
  'chop',
  'clip',
  'coarse',
  'compressor',
  'distort',
  'drive',
  'fm',
  'freq',
  'gate',
  'loop',
  'mode',
  'octave',
  'phasdp',
  'phaser',
  'pitchJump',
  'ply',
  'polymeter',
  'polyrhythm',
  'press',
  'scrub',
  'slice',
  'squiz',
  'stut',
  'swing',
  'transpose',
  'tremolo',
  'velocity',
  'vibrato',
  'voice',
  'wchoose',
  'wrandcat',
  'zcrush',
  'zdelay',
];

const inferCategory = (name: string): InstructionCategory => {
  if (curatedInstructions[name]) {
    return curatedInstructions[name].category;
  }
  if (name.startsWith('_') || /^[A-Z]/.test(name) || name.startsWith('get') || name.startsWith('set')) {
    return 'Internal';
  }
  if (/midi|ccn|ccv|nrpn|sysex|prog/i.test(name)) {
    return 'MIDI';
  }
  if (/lpf|hpf|bpf|cutoff|resonance|band|filter|lp|hp|bp/.test(name)) {
    return 'Filter';
  }
  if (/delay|room|dist|crush|phaser|trem|vib|chorus|compress|drive|shape|duck|ring|leslie|z/.test(name)) {
    return 'Effect';
  }
  if (/att|dec|sus|rel|env|adsr|gate|legato/.test(name)) {
    return 'Envelope';
  }
  if (/sample|sound|bank|begin|end|loop|slice|chop|speed|cut/.test(name)) {
    return 'Sample';
  }
  if (/note|chord|scale|oct|freq|transpose|voic|degree|arp/.test(name)) {
    return 'Pitch';
  }
  if (/rand|choose|often|rare|always|never|degrade|perlin|shuffle|scram/.test(name)) {
    return 'Random';
  }
  if (/fast|slow|time|late|early|cps|cpm|cycle|dur|second|minute|hour|swing/.test(name)) {
    return 'Time';
  }
  if (/stack|cat|seq|euclid|struct|mask|rev|jux|iter|ply|poly|arrange|chunk|palindrome|repeat/.test(name)) {
    return 'Structure';
  }
  if (/color|colour|draw|scope|spectrum|punchcard|pianoroll|spiral/.test(name)) {
    return 'Visual';
  }
  return 'Pattern';
};

const inferDescription = (name: string, category: InstructionCategory): string => {
  if (curatedInstructions[name]) {
    return curatedInstructions[name].description;
  }

  switch (category) {
    case 'Filter':
      return 'Filter parameter or filter-related pattern control.';
    case 'Effect':
      return 'Audio effect or effect parameter control.';
    case 'Envelope':
      return 'Envelope, modulation, or articulation parameter.';
    case 'Sample':
      return 'Sample selection, slicing, playback, or buffer control.';
    case 'Pitch':
      return 'Pitch, tuning, scale, chord, or voicing instruction.';
    case 'Random':
      return 'Randomness, probability, or selection instruction.';
    case 'Time':
      return 'Timing, tempo, or cycle transformation.';
    case 'Structure':
      return 'Pattern structure, layering, masking, or sequencing transformation.';
    case 'MIDI':
      return 'MIDI output or control instruction.';
    case 'Visual':
      return 'Visual metadata, drawing, or widget instruction.';
    case 'Internal':
      return 'Exported Strudel runtime helper.';
    case 'System':
      return 'Playback, setup, or runtime utility.';
    case 'Pattern':
    default:
      return 'Pattern construction, transformation, or value helper from the installed Strudel runtime.';
  }
};

const createEntry = (name: string): InstructionEntry => {
  const curated = curatedInstructions[name];
  if (curated) {
    const runtimeDoc = runtimeDocsByName.get(name);
    return {
      name,
      ...curated,
      tags: [...(curated.tags ?? []), ...(runtimeDoc?.tags ?? [])],
    };
  }

  const runtimeDoc = runtimeDocsByName.get(name);
  const category = inferCategory(name);
  return {
    name,
    category,
    signature: runtimeDoc?.signature ?? `${name}(...)`,
    description: runtimeDoc?.description ?? inferDescription(name, category),
    tags: runtimeDoc?.tags,
  };
};

const getInstructionEntries = (): InstructionEntry[] => {
  const scopeNames = Object.keys(strudelScope ?? {});
  const names = new Set([...scopeNames, ...Object.keys(curatedInstructions), ...fallbackNames]);

  return [...names]
    .filter((name) => /^[A-Za-z_$][\w$]*$/.test(name))
    .map(createEntry)
    .sort((left, right) => {
      const categoryDelta = categoryOrder.indexOf(left.category) - categoryOrder.indexOf(right.category);
      return categoryDelta || left.name.localeCompare(right.name);
    });
};

const categories = ['All', ...categoryOrder] as const;

export const InstructionLookupPanel = (): JSX.Element => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<(typeof categories)[number]>('All');
  const entries = useMemo(() => getInstructionEntries(), []);
  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return entries.filter((entry) => {
      if (category !== 'All' && entry.category !== category) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const searchable = [
        entry.name,
        entry.signature,
        entry.description,
        entry.category,
        ...(entry.tags ?? []),
      ].join(' ').toLowerCase();

      return searchable.includes(normalizedQuery);
    });
  }, [category, entries, query]);

  return (
    <section className="instruction-lookup">
      <div className="section-title">
        <BookOpen size={16} aria-hidden="true" />
        <h2>Instructions</h2>
      </div>

      <label className="lookup-search">
        <Search size={15} aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search Strudel"
          aria-label="Search Strudel instructions"
        />
      </label>

      <div className="lookup-toolbar">
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value as (typeof categories)[number])}
          aria-label="Instruction category"
        >
          {categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <span>{filteredEntries.length} / {entries.length}</span>
      </div>

      <div className="instruction-list">
        {filteredEntries.map((entry) => (
          <article className="instruction-card" key={entry.name}>
            <div className="instruction-card-heading">
              <code>{entry.name}</code>
              <span>{entry.category}</span>
            </div>
            <code className="instruction-signature">{entry.signature}</code>
            <p>{entry.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
};
