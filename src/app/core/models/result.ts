export interface ResultParty {
  name: string;
  abbr: string;
  votes: number;
  pct: number;
  seats: number;
  inParliament: boolean;
}

export interface ElectionResult {
  id: string;
  type: string;
  date: string;
  turnout: { pct: number | null; eligible: number | null; voted: number | null };
  parties: ResultParty[];
  winner: { name: string; abbr: string; pct: number };
  source: string;
}
