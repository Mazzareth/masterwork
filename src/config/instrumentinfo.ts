// src/config/instrumentinfo.ts

export type InstrumentKey = "PIANO" | "GUITAR" | "BASS";

export type SliderConcept = {
  id: string;
  label: string;
  description?: string;
  minLabel?: string; // left-most notch
  maxLabel?: string; // right-most notch
};

export type InstrumentMeta = {
  key: InstrumentKey;
  label: string;
  short?: string;
};

export const INSTRUMENTS: InstrumentMeta[] = [
  { key: "PIANO", label: "Piano" },
  { key: "GUITAR", label: "Guitar" },
  { key: "BASS", label: "Bass" },
];

// Discrete slider settings: 0..4 (5 notches)
export const SLIDER_MIN = 0;
export const SLIDER_MAX = 4;
export const SLIDER_STEP = 1;
export const SLIDER_SCALE_LABELS = ["New", "Learning", "Developing", "Comfortable", "Confident"] as const;

export const PIANO_CONCEPTS: SliderConcept[] = [
  {
    id: "technique_posture",
    label: "Technique & Posture",
    description: "Bench height, relaxed wrists, finger strength/independence, pedal basics.",
    minLabel: "Getting started",
    maxLabel: "Solid foundation",
  },
  {
    id: "reading_rhythm",
    label: "Reading & Rhythm",
    description: "Treble/bass clef notation, counting, subdivisions, playing in time.",
    minLabel: "Slow reading",
    maxLabel: "Reads comfortably",
  },
  {
    id: "scales_keys",
    label: "Scales & Key Signatures",
    description: "Major/minor scales, fingerings, circle of fifths, relative keys.",
    minLabel: "Few keys",
    maxLabel: "Many keys fluently",
  },
  {
    id: "chords_voicings",
    label: "Chords & Voicings",
    description: "Triads/7ths, inversions, voice leading, accompaniment patterns.",
    minLabel: "Basics",
    maxLabel: "Rich voicings",
  },
  {
    id: "ear_playing",
    label: "Playing by Ear",
    description: "Hearing intervals, picking out melodies/chords without notation.",
    minLabel: "Rarely",
    maxLabel: "Often",
  },
  {
    id: "improv_comp",
    label: "Improvisation & Accompaniment",
    description: "Creating fills/solos, comping for singers/players, dynamics.",
    minLabel: "New to it",
    maxLabel: "Comfortable",
  },
];

export const GUITAR_CONCEPTS: SliderConcept[] = [
  {
    id: "open_chords",
    label: "Open Chords & Changes",
    description: "Common shapes (CAGED), clean fretting, efficient transitions.",
    minLabel: "Few shapes",
    maxLabel: "Fluent",
  },
  {
    id: "strumming_groove",
    label: "Strumming & Groove",
    description: "Right‑hand patterns, dynamics, keeping steady time.",
    minLabel: "Basic",
    maxLabel: "Solid feel",
  },
  {
    id: "picking_coord",
    label: "Picking & Coordination",
    description: "Alternate picking, hybrid/fingerstyle basics, string crossing.",
    minLabel: "Developing",
    maxLabel: "Accurate/Clean",
  },
  {
    id: "scales_fretboard",
    label: "Scales & Fretboard",
    description: "Pentatonics, major/minor scales, positions, navigation.",
    minLabel: "Local",
    maxLabel: "Across neck",
  },
  {
    id: "barre_power",
    label: "Barre & Power Chords",
    description: "Barre strength, muting, movable shapes.",
    minLabel: "Challenging",
    maxLabel: "Confident",
  },
  {
    id: "lead_tech",
    label: "Lead Techniques",
    description: "Bends, vibrato, slides, hammer‑ons/pull‑offs.",
    minLabel: "Starting",
    maxLabel: "Expressive",
  },
];

export const BASS_CONCEPTS: SliderConcept[] = [
  {
    id: "time_groove",
    label: "Time Feel & Groove",
    description: "Locking with drums, subdivision control, consistency.",
    minLabel: "Developing",
    maxLabel: "Solid pocket",
  },
  {
    id: "technique_hands",
    label: "Left/Right‑Hand Technique",
    description: "Fingerstyle basics, economy of motion, muting control.",
    minLabel: "Working on it",
    maxLabel: "Efficient/Clean",
  },
  {
    id: "reading_charts",
    label: "Reading Rhythms & Charts",
    description: "Rhythmic notation, simple charts/lead sheets, form awareness.",
    minLabel: "Limited",
    maxLabel: "Comfortable",
  },
  {
    id: "scales_arps",
    label: "Scales & Arpeggios",
    description: "Major/minor scales, triads/7ths, positions.",
    minLabel: "Few shapes",
    maxLabel: "Many shapes",
  },
  {
    id: "walking_lines",
    label: "Walking & Line Construction",
    description: "Connecting chord tones, approach notes, tasteful movement.",
    minLabel: "New",
    maxLabel: "Comfortable",
  },
  {
    id: "slap_articulation",
    label: "Slap & Articulation",
    description: "Thumb/pop basics, ghost notes, articulation variety.",
    minLabel: "New",
    maxLabel: "Groovy",
  },
];

export const CONCEPTS: Record<InstrumentKey, SliderConcept[]> = {
  PIANO: PIANO_CONCEPTS,
  GUITAR: GUITAR_CONCEPTS,
  BASS: BASS_CONCEPTS,
};

export const BackOfPianoCard =
  "Piano builds a complete musician: melody, harmony, and rhythm at your fingertips. Learn efficient technique, solid timing, and how to turn theory into music you love.";

export const BackOfGuitarCard =
  "Guitar is a song‑maker’s playground. From open‑chord strumming to expressive leads, we’ll build clean technique, fretboard confidence, and the ability to play with others.";

export const BackOfBassCard =
  "With Bass, you keep the groove. Master rhythm, lock with the drums, and create lines that hold songs together. Build pocket, taste, and the confidence to drive the band.";

export const BACK_OF_CARD: Record<InstrumentKey, string> = {
  PIANO: BackOfPianoCard,
  GUITAR: BackOfGuitarCard,
  BASS: BackOfBassCard,
};

// Optional: teacher profile copy used across Teach pages (centralized for easy edits)
export const TEACHER_PROFILE = {
  availability: "Weekdays 9–5 (limited evenings); within 25 minutes of Downtown Topeka; online available.",
  experience: "Teaching 3+ years; former KODA piano teacher.",
  introLength: "Free 15‑minute intro call to align on goals and availability.",
};