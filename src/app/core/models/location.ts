export interface Region {
  code: string; // zhodné s FCM topic vuc_<code>
  name: string;
  topic: string;
}

export interface Municipality {
  id: number;
  name: string;
  region: string; // kód kraja
  district: string;
}
