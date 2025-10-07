import { Component, OnInit, signal, computed, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Post, User, Comment } from './models/data.model';
import { DataLoaderService } from './services/data-loader.service';
import { StateService } from './services/state.service';
import { VirtualScrollerComponent } from './components/virtual-scroller.component/virtual-scroller.component';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [DatePipe, DecimalPipe, VirtualScrollerComponent, FormsModule, CommonModule, ReactiveFormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnInit {
  users: User[] = [];
  posts: Post[] = [];
  searchQuery = '';
  searchControl = new FormControl('');
  sortBy: 'recent' | 'title' = 'recent';
  selectedPost = signal<Post | null>(null);
  comments = signal<Comment[]>([]);

  private destroy$ = new Subject<void>();

  private debouncedSearch = signal('');

  constructor(
    private dataLoaderService: DataLoaderService,
    public stateService: StateService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.dataLoaderService.loadAllData().pipe(
      takeUntil(this.destroy$)
    ).subscribe(data => {
      this.users = data.users;
      this.posts = data.posts;
      this.loadStateFromUrl();
    });

    this.searchControl.valueChanges.pipe(
      debounceTime(200),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe((query: any) => {
      this.searchQuery = query || '';
      this.debouncedSearch.set(query || '');
      this.updateUrl();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  filteredPosts = computed(() => {
    const selectedUsers = this.stateService.selectedUsers();
    const search = this.debouncedSearch().toLowerCase();
    let filtered = this.posts;

    if (selectedUsers.size > 0) {
      filtered = filtered.filter(post => selectedUsers.has(post.userId));
    }

    if (search) {
      filtered = filtered.filter(post =>
        post.title.toLowerCase().includes(search) ||
        post.body.toLowerCase().includes(search)
      );
    }

    const sorted = [...filtered];
    if (this.stateService.sortBy() === 'title') {
      sorted.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      sorted.sort((a, b) => b.date.getTime() - a.date.getTime());
    }

    return sorted;
  });

  toggleUser(userId: number): void {
    this.stateService.toggleUser(userId);
    this.updateUrl();
  }

  clearUserSelection(): void {
    this.stateService.clearSelection();
    this.updateUrl();
  }

  isUserSelected(userId: number): boolean {
    return this.stateService.selectedUsers().has(userId);
  }

  onSortChange(): void {
    this.stateService.setSortBy(this.sortBy);
    this.updateUrl();
  }

  openPostDialog(post: Post): void {
    this.selectedPost.set(post);
    const postComments = this.dataLoaderService.generateComments(post.id);
    this.comments.set(postComments);
  }

  closeDialog(): void {
    this.selectedPost.set(null);
  }

  getUserName(userId: number): string {
    return this.users.find(u => u.id === userId)?.name || 'Unknown';
  }

  trackByUserId(index: number, user: User): number {
    return user.id;
  }

  trackByPostId(index: number, post: Post): number {
    return post.id;
  }

  private loadStateFromUrl(): void {
    this.route.queryParams.subscribe(params => {
      if (params['users']) {
        const userIds = params['users'].split(',').map(Number);
        this.stateService.setSelectedUsers(new Set(userIds));
      } else {
        this.stateService.clearSelection();
      }
      if (params['search']) {
        this.searchQuery = params['search'];
        this.debouncedSearch.set(params['search']);
      }
      if (params['sort']) {
        this.sortBy = params['sort'];
        this.stateService.setSortBy(params['sort']);
      }
    });
  }

  private updateUrl(): void {
    const queryParams: any = {};
    
    const selected = Array.from(this.stateService.selectedUsers());
    if (selected.length > 0) {
      queryParams.users = selected.join(',');
    } else {
      queryParams.users = null;
    }
    
    if (this.debouncedSearch()) {
      queryParams.search = this.debouncedSearch();
    } else {
      queryParams.search = null;
    }
    
    if (this.stateService.sortBy() !== 'recent') {
      queryParams.sort = this.stateService.sortBy();
    }

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge'
    });
  }
}
