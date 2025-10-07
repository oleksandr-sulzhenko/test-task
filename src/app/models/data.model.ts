export interface User {
  id: number;
  name: string;
  email: string;
  avatar: string;
  bio: string;
}

export interface Post {
  id: number;
  userId: number;
  title: string;
  body: string;
  date: Date;
}

export interface Comment {
  id: number;
  postId: number;
  author: string;
  text: string;
  date: Date;
}

export interface AppState {
  selectedUsers: Set<number>;
  searchQuery: string;
  sortBy: 'recent' | 'title';
}