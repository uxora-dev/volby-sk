export type ElectionType =
  | 'parliamentary'
  | 'presidential'
  | 'referendum'
  | 'european'
  | 'vuc'
  | 'municipal';

export type ElectionScope = 'national' | 'regional' | 'municipal';
export type ElectionStatus = 'upcoming' | 'past';

export interface Election {
  id: string;
  type: ElectionType;
  scope: ElectionScope;
  title: string;
  date: string; // ISO YYYY-MM-DD
  status: ElectionStatus;
  legalRef: string;
  sourceUrl: string;
}

export interface ElectionsFile {
  generatedAt: string;
  count: number;
  elections: Election[];
}

export interface ElectionTypeMeta {
  label: string;
  short: string;
  icon: string;
  color: string; // CSS premenná farby typu (adaptívna v dark režime)
}

export const TYPE_META: Record<ElectionType, ElectionTypeMeta> = {
  parliamentary: { label: 'Parlamentné voľby (NR SR)', short: 'Parlamentné', icon: 'business', color: 'var(--type-parliamentary)' },
  presidential: { label: 'Prezidentské voľby', short: 'Prezidentské', icon: 'person', color: 'var(--type-presidential)' },
  referendum: { label: 'Referendum', short: 'Referendum', icon: 'help-circle', color: 'var(--type-referendum)' },
  european: { label: 'Eurovoľby (Európsky parlament)', short: 'Eurovoľby', icon: 'globe-outline', color: 'var(--type-european)' },
  vuc: { label: 'Župné voľby (VÚC)', short: 'Župné', icon: 'map', color: 'var(--type-vuc)' },
  municipal: { label: 'Komunálne voľby', short: 'Komunálne', icon: 'home', color: 'var(--type-municipal)' },
};

export const ELECTION_TYPES: ElectionType[] = [
  'parliamentary',
  'presidential',
  'referendum',
  'european',
  'vuc',
  'municipal',
];
