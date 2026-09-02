export type SchoolLevel = 'primary' | 'secondary';

export interface Club {
  id: string;
  name: string;
  capacity: number;
  schoolLevel: SchoolLevel;
  description?: string;
}

export interface Submission {
  id: string;
  schoolLevel: SchoolLevel;
  fullName: string;
  class: string;
  clubId: string;
  clubName: string;
  ts: string;
}

// A classroom a student can pick from - editable by teachers, scoped per
// school level exactly like clubs are.
export interface Classroom {
  id: string;
  name: string;
  schoolLevel: SchoolLevel;
}

// Emoji keyed by club id, so the club list is scannable at a glance instead of
// being rows of near-identical text. Falls back to a star for any club a
// teacher adds later that isn't in this map.
export const CLUB_ICONS: Record<string, string> = {
  'arts-craft-club': '🎨',
  'chess-club': '♟️',
  'coding-club': '💻',
  'culinary-club': '🍳',
  'dance-club': '💃',
  'entrepreneurship-club': '💵',
  'futsal-club': '⚽',
  'literary-society': '📖',
  'music-club': '🎵',
  'public-speaking-club': '🎤',
  'science-innovation-club': '🔬',
  'scrabble-club': '🔤',
  'table-tennis-club': '🏓',
  'taekwondo': '🥋',
  'theatre-performing-arts': '🎭',

  'secondary-chess-club': '♟️',
  'secondary-coding-club': '💻',
  'secondary-culinary-club': '🍳',
  'secondary-entrepreneurship-club': '💵',
  'secondary-futsal-club': '⚽',
  'secondary-interact-club': '🤝',
  'secondary-media-visual-arts-club': '🖼️',
  'secondary-model-united-nations': '🌐',
  'secondary-music-band': '🥁',
  'secondary-photography-production': '📷',
  'secondary-ping-pong-club': '🏓',
  'secondary-science-innovation-club': '🔬',
  'secondary-taekwondo-club': '🥋',
  'secondary-youth-volunteer-club': '⛑️'
};

export const DEFAULT_CLUB_ICON = '⭐';

export const DEFAULT_CLUBS_PRIMARY: Club[] = [
  { id: 'arts-craft-club', name: 'Arts & Craft Club', capacity: 30, schoolLevel: 'primary' },
  { id: 'chess-club', name: 'Chess Club', capacity: 30, schoolLevel: 'primary' },
  { id: 'coding-club', name: 'Coding Club', capacity: 30, schoolLevel: 'primary' },
  { id: 'culinary-club', name: 'Culinary Club', capacity: 25, schoolLevel: 'primary' },
  { id: 'dance-club', name: 'Dance Club', capacity: 30, schoolLevel: 'primary' },
  { id: 'entrepreneurship-club', name: 'Entrepreneurship Club', capacity: 30, schoolLevel: 'primary' },
  { id: 'futsal-club', name: 'Futsal Club', capacity: 35, schoolLevel: 'primary' },
  { id: 'literary-society', name: 'Literary Society', capacity: 30, schoolLevel: 'primary' },
  { id: 'music-club', name: 'Music Club', capacity: 30, schoolLevel: 'primary' },
  { id: 'public-speaking-club', name: 'Public Speaking Club', capacity: 30, schoolLevel: 'primary' },
  { id: 'science-innovation-club', name: 'Science & Innovation Club', capacity: 30, schoolLevel: 'primary' },
  { id: 'scrabble-club', name: 'Scrabble Club', capacity: 30, schoolLevel: 'primary' },
  { id: 'table-tennis-club', name: 'Table Tennis Club', capacity: 30, schoolLevel: 'primary' },
  { id: 'taekwondo', name: 'Taekwondo', capacity: 30, schoolLevel: 'primary' },
  { id: 'theatre-performing-arts', name: 'Theatre & Performing Arts', capacity: 30, schoolLevel: 'primary' }
];

export const DEFAULT_CLUBS_SECONDARY: Club[] = [
  { id: 'secondary-chess-club', name: 'Chess Club', capacity: 35, schoolLevel: 'secondary' },
  { id: 'secondary-coding-club', name: 'Coding Club', capacity: 25, schoolLevel: 'secondary' },
  { id: 'secondary-culinary-club', name: 'Culinary Club', capacity: 30, schoolLevel: 'secondary' },
  { id: 'secondary-entrepreneurship-club', name: 'Entrepreneurship Club', capacity: 30, schoolLevel: 'secondary' },
  { id: 'secondary-futsal-club', name: 'Futsal Club', capacity: 35, schoolLevel: 'secondary' },
  { id: 'secondary-interact-club', name: 'Interact Club', capacity: 30, schoolLevel: 'secondary' },
  { id: 'secondary-media-visual-arts-club', name: 'Media & Visual Arts Club', capacity: 30, schoolLevel: 'secondary' },
  { id: 'secondary-model-united-nations', name: 'Model United Nations', capacity: 30, schoolLevel: 'secondary' },
  { id: 'secondary-music-band', name: 'Music Band', capacity: 30, schoolLevel: 'secondary' },
  { id: 'secondary-photography-production', name: 'Photography & Production', capacity: 25, schoolLevel: 'secondary' },
  { id: 'secondary-ping-pong-club', name: 'Ping Pong Club', capacity: 25, schoolLevel: 'secondary' },
  { id: 'secondary-science-innovation-club', name: 'Science & Innovation Club', capacity: 25, schoolLevel: 'secondary' },
  { id: 'secondary-taekwondo-club', name: 'Taekwondo Club', capacity: 25, schoolLevel: 'secondary' },
  { id: 'secondary-youth-volunteer-club', name: 'Youth Volunteer & Community Service Club', capacity: 25, schoolLevel: 'secondary' }
];

export function defaultClubsFor(level: SchoolLevel): Club[] {
  return level === 'primary' ? DEFAULT_CLUBS_PRIMARY : DEFAULT_CLUBS_SECONDARY;
}
