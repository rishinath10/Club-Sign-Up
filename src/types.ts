export interface Club {
  id: string;
  name: string;
  capacity: number;
  description?: string;
}

export interface Submission {
  id: string;
  name: string;
  class: string;
  clubId: string;
  clubName: string;
  ts: string;
}

export const DEFAULT_CLUBS: Club[] = [
  { id: 'arts-craft-club', name: 'Arts & Craft Club', capacity: 30 },
  { id: 'chess-club', name: 'Chess Club', capacity: 30 },
  { id: 'coding-club', name: 'Coding Club', capacity: 30 },
  { id: 'culinary-club', name: 'Culinary Club', capacity: 30 },
  { id: 'dance-club', name: 'Dance Club', capacity: 30 },
  { id: 'entrepreneurship-club', name: 'Entrepreneurship Club', capacity: 30 },
  { id: 'futsal-club', name: 'Futsal Club', capacity: 30 },
  { id: 'literary-society', name: 'Literary Society', capacity: 30 },
  { id: 'music-club', name: 'Music Club', capacity: 30 },
  { id: 'public-speaking-club', name: 'Public Speaking Club', capacity: 30 },
  { id: 'science-innovation-club', name: 'Science & Innovation Club', capacity: 30 },
  { id: 'scrabble-club', name: 'Scrabble Club', capacity: 30 },
  { id: 'table-tennis-club', name: 'Table Tennis Club', capacity: 30 },
  { id: 'taekwondo', name: 'Taekwondo', capacity: 30 },
  { id: 'theatre-performing-arts', name: 'Theatre & Performing Arts', capacity: 30 }
];
