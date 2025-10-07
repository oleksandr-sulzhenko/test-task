import { Injectable, signal, computed } from '@angular/core';
import { AppState } from '../models/data.model';

@Injectable({
  providedIn: 'root'
})
export class StateService {
  private selectedUsersSignal = signal<Set<number>>(new Set());
  private searchQuerySignal = signal<string>('');
  private sortBySignal = signal<'recent' | 'title'>('recent');

  selectedUsers = this.selectedUsersSignal.asReadonly();
  searchQuery = this.searchQuerySignal.asReadonly();
  sortBy = this.sortBySignal.asReadonly();

  stats = computed(() => ({
    selectedCount: this.selectedUsers().size,
    hasSearch: this.searchQuery().length > 0,
    sortMode: this.sortBy()
  }));  

  toggleUser(userId: number): void {
    const current = new Set(this.selectedUsersSignal());
    if (current.has(userId)) {
      current.delete(userId);
    } else {
      current.add(userId);
    }
    this.selectedUsersSignal.set(current);
  }

  clearSelection(): void {
    this.selectedUsersSignal.set(new Set());
  }

  setSearchQuery(query: string): void {
    this.searchQuerySignal.set(query);
  }

  setSortBy(sort: 'recent' | 'title'): void {
    this.sortBySignal.set(sort);
  }

  setSelectedUsers(users: Set<number>): void {
    this.selectedUsersSignal.set(users);
  }

  getState(): AppState {
    return {
      selectedUsers: this.selectedUsersSignal(),
      searchQuery: this.searchQuerySignal(),
      sortBy: this.sortBySignal()
    };
  }

  setState(state: Partial<AppState>): void {
    if (state.selectedUsers) {
      this.selectedUsersSignal.set(state.selectedUsers);
    }
    if (state.searchQuery !== undefined) {
      this.searchQuerySignal.set(state.searchQuery);
    }
    if (state.sortBy) {
      this.sortBySignal.set(state.sortBy);
    }
  }
}
