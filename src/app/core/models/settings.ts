export type NationalType = 'parliamentary' | 'presidential' | 'referendum' | 'european';

export interface AppSettings {
  notificationsEnabled: boolean;
  national: Record<NationalType, boolean>;
  regionCode: string | null;
  municipality: { id: number; name: string } | null;
  regionalEnabled: boolean; // župné (VÚC)
  municipalEnabled: boolean; // komunálne
  reminders: { d7: boolean; d1: boolean; d0: boolean };
  onboarded: boolean; // dokončený úvodný sprievodca (prvé spustenie)
}

export const NATIONAL_TYPES: NationalType[] = ['parliamentary', 'presidential', 'referendum', 'european'];

export const DEFAULT_SETTINGS: AppSettings = {
  notificationsEnabled: true,
  national: { parliamentary: true, presidential: true, referendum: true, european: true },
  regionCode: null,
  municipality: null,
  regionalEnabled: true,
  municipalEnabled: true,
  reminders: { d7: true, d1: true, d0: false },
  onboarded: false,
};
