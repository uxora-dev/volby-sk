export interface ResultParty {
  name: string;
  abbr: string;
  votes: number;
  pct: number;
  seats: number;
  inParliament: boolean;
}

export interface ResultSummary {
  type: string;
  turnout: number | null;
  winnerAbbr: string;
  winnerName: string;
  winnerPct: number;
  valid?: boolean;
  regionWinners?: Record<string, string>; // VÚC — kód kraja → zvolený predseda (pre kartu „Váš župan")
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

/** Kandidát na predsedu (župana) v jednom kraji — voľby VÚC. */
export interface RegionCandidate {
  name: string; // meno a priezvisko
  party: string; // navrhujúce strany / NEKA
  pct: number;
  votes: number;
  winner: boolean; // zvolený predseda kraja
}

/** Zvolený predseda (župan) v jednom samosprávnom kraji — voľby VÚC. */
export interface ResultRegion {
  code: string; // regionCode (zhodné s FCM topic vuc_<code>)
  name: string; // Bratislavský kraj
  winner: string; // meno zvoleného župana
  pct: number | null; // podiel víťaza v kraji (null = staršie ročníky, len meno víťaza)
  votes: number | null; // počet platných hlasov víťaza
  candidates?: RegionCandidate[]; // všetci kandidáti na predsedu (zostupne podľa hlasov)
}

export interface ElectionResult {
  id: string;
  type: string;
  date: string;
  turnout: { pct: number | null; eligible: number | null; voted: number | null };
  parties: ResultParty[];
  rounds?: PresidentialRound[]; // prezidentské — kolá s kandidátmi
  regions?: ResultRegion[]; // VÚC — zvolený predseda (župan) za každý kraj
  referendum?: {
    topic: string | null;
    questionCount: number;
    valid: boolean;
    yesPct: number | null;
    resultText: string;
  };
  indirect?: {
    electedBy: string; // orgán, ktorý prezidenta zvolil (Národná rada SR)
    votes: number; // koľko poslancov hlasovalo za víťaza
    total: number; // počet poslancov spolu
    needed: number; // potrebná väčšina
    term: string; // funkčné obdobie
    note: string; // krátke faktické vysvetlenie
  };
  winner: { name: string; abbr: string; pct: number };
  source: string;
  sourceLabel?: string;
}
