/**
 * Types matching GET /friends API response (backend Friend model, data-models.md).
 */
export interface Friend {
  shareToken: string;
  name: string;
  imageUrl?: string;
}

export interface FriendsResponse {
  friends: Friend[];
}
