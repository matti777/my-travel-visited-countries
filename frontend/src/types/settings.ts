export interface SharingSettings {
  shareMediaUrl: boolean;
  shareNotes: boolean;
  shareTags: boolean;
}

export interface UserSettings {
  homeCountryCode?: string;
  description?: string;
  sharing: SharingSettings;
}
