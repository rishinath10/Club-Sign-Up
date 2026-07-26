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
  { id: 'book-club', name: 'Book club', capacity: 30, description: 'Literature analysis, group discussions, and creative writing.' },
  { id: 'futsal', name: 'Futsal', capacity: 22, description: 'Indoor soccer training, tactical skills, and friendly matches.' },
  { id: 'entrepreneurship', name: 'Entrepreneurship', capacity: 25, description: 'Business basics, product development, and pitching ideas.' },
  { id: 'coding', name: 'Coding', capacity: 25, description: 'Web development, programming logic, and building apps.' }
];
