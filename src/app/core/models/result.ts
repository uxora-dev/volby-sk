export interface ResultParty {
  name: string;
  abbr: string;
  votes: number;
  pct: number;
  seats: number;
  inParliament: boolean;
}

export interface ResultCandidate {
  name: string;
  pct: number;
}

export interface PresidentialRound {
  round: number;
  turnout: number | null;
  candidates: ResultCandidate[];
}

export interface ElectionResult {
  id: string;
  type: string;
  date: string;
  turnout: { pct: number | null; eligible: number | null; voted: number | null };
  parties: ResultParty[];
  rounds?: PresidentialRound[]; // prezidentské — kolá s kandidátmi
  winner: { name: string; abbr: string; pct: number };
  source: string;
  sourceLabel?: string;
}
