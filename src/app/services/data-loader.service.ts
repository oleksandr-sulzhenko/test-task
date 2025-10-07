import { Injectable } from '@angular/core';
import { Post, User, Comment } from '../models/data.model';
import { HttpClient } from '@angular/common/http';
import { forkJoin, map, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DataLoaderService {

  constructor(private http: HttpClient) {}

  loadAllData(): Observable<{ users: User[]; posts: Post[];  }> {
    return forkJoin({
      users: this.http.get<User[]>('/data/users.json'),
      posts: this.http.get<Post[]>('/data/posts.json').pipe(
        map(posts => posts.map(p => ({ ...p, date: new Date(p.date) })))
      ),
    });
  }
  
  generateComments(postId: number): Comment[] {
    const count = Math.floor(Math.random() * 14) + 2;
    return Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      postId,
      author: `Commenter ${i + 1}`,
      text: `Comment ${i + 1} on this post. ${
        i % 2 === 0 ? 'This is a longer comment with more details.' : ''
      }`,
      date: new Date(2024, 0, 1 + (i % 30))
    }));
  }
}
