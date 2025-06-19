
// Nhost User (from nhost.auth.getUser() or useUserData())
export interface User {
  id: string; // Nhost user ID (UUID)
  email: string | undefined; // Nhost default
  displayName: string; // Nhost default - we'll use this for 'name'
  avatarUrl: string; // Nhost default
  actualUsername: string; // Custom: To be stored in user metadata e.g. @cooluser
  isBot?: boolean; // Custom: To be stored in user metadata
  // Nhost specific fields if needed:
  // createdAt: string;
  // roles: string[];
  // metadata: Record<string, any>; // For custom fields like actualUsername, isBot
}

// Denormalized user info for embedding or quick display (less emphasis with GraphQL relations)
export interface DenormalizedUser {
  id: string;
  username: string; // This is actualUsername
  name: string; // This is displayName
  avatarUrl: string;
  isBot?: boolean;
}

// Represents a Comment, typically fetched in relation to a Post
export interface Comment {
  id: string; // Comment ID (UUID from database)
  postId: string; // ID of the parent Post
  content: string;
  created_at: string; // ISO string date
  user: DenormalizedUser; // User who made the comment
  isBotComment?: boolean;
}

// Represents a Post, with related data like user, likes, comments
export interface Post {
  id: string; // Post ID (UUID from database)
  content: string;
  image_url?: string;
  created_at: string; // ISO string date
  // user_id: string; // Foreign key to users table
  user: DenormalizedUser; // User who created the post (fetched via relationship)
  is_bot_post?: boolean;
  
  // For likes:
  likes_aggregate: { // Provided by Hasura for counting
    aggregate?: {
      count: number;
    };
  };
  // We'll also add a client-side/query-derived field:
  isLikedByCurrentUser?: boolean; 
  // Full list of likers not typically on Post object directly unless specifically queried.

  // For comments:
  comments_aggregate: { // Provided by Hasura for counting
    aggregate?: {
      count: number;
    };
  };
  comments: Comment[]; // Array of actual comment objects, fetched via relationship
}

export enum ActiveView {
  Home = 'Home',
  Explore = 'Explore',
  Notifications = 'Notifications',
  Messages = 'Messages',
  Bookmarks = 'Bookmarks',
  Profile = 'Profile',
}
