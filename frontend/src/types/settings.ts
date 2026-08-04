export interface SharingSettings {
  shareMediaUrl: boolean;
  shareNotes: boolean;
  shareTags: boolean;
  shareWishList: boolean;
}

export interface UserSettings {
  homeCountryCode?: string;
  instagramUserName?: string;
  description?: string;
  sharing: SharingSettings;
}



