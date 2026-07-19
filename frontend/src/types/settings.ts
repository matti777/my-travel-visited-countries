export interface SharingSettings {
  shareMediaUrl: boolean;
  shareNotes: boolean;
  shareTags: boolean;
}

export interface UserSettings {
  sharing: SharingSettings;
}
