import { 
  Component, Input, Output, EventEmitter, ChangeDetectionStrategy,
  OnInit, OnDestroy, ElementRef, ViewChild, signal, computed, TemplateRef, ContentChild,
  ChangeDetectorRef, PLATFORM_ID, inject
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';

interface VirtualScrollItem {
  id: number;
  [key: string]: any;
}

interface ItemPosition {
  index: number;
  offset: number;
  height: number;
}

@Component({
  selector: 'app-virtual-scroller',
  imports: [CommonModule],
  templateUrl: './virtual-scroller.component.html',
  styleUrl: './virtual-scroller.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VirtualScrollerComponent<T extends VirtualScrollItem> implements OnInit, OnDestroy {
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  private itemsInput = signal<T[]>([]);
  items: T[] = [];

  @Input() set itemsData(value: T[]) {
    this.items = value;
    this.itemsInput.set(value);
    this.focusedIndex.set(-1);
    this.itemHeights.clear();
    this.initializePositions();
    
    if (this.isBrowser && this.scrollContainer) {
      this.scrollContainer.nativeElement.scrollTop = 0;
      this.scrollTop.set(0);
    }
    
    this.cdr.markForCheck();
  }

  @Input() overscan = 3;
  @Input() containerHeight = 600;
  @Output() itemClick = new EventEmitter<T>();

  @ContentChild(TemplateRef) itemTemplate!: TemplateRef<any>;
  @ViewChild('scrollContainer', { static: true }) scrollContainer!: ElementRef<HTMLDivElement>;

  private scrollTop = signal(0);
  focusedIndex = signal(-1);
  private itemHeights = new Map<number, number>();
  private itemPositions: ItemPosition[] = [];
  
  private rafId: number | null = null;
  
  private resizeObserver?: ResizeObserver;
  private focusOutListener?: (event: Event) => void;

  visibleRange = computed(() => {
    const scroll = this.scrollTop();
    const itemsLength = this.itemsInput().length;
    
    if (itemsLength === 0) {
      return { start: 0, end: -1 };
    }
    
    return this.getVisibleRangeDynamic(this.isBrowser ? scroll : 0);
  });

  visibleItems = computed(() => {
    const itemsLength = this.itemsInput().length;
    const range = this.visibleRange();
    const focused = this.focusedIndex();
    
    if (itemsLength === 0) {
      return [];
    }
    
    if (!this.isBrowser) {
      let totalHeight = 0;
      let count = 0;

      for (let i = 0; i < itemsLength && totalHeight < this.containerHeight; i++) {
        const estimatedHeight = this.estimateItemHeight(this.items[i]);
        totalHeight += estimatedHeight;
        count++;
      }
      
      const initialCount = Math.min(count + 1, itemsLength);

      return this.items.slice(0, initialCount).map((item, idx) => ({
        item,
        index: idx,
        isFocused: false
      }));
    }
    
    return this.items.slice(range.start, range.end + 1).map((item, idx) => ({
      item,
      index: range.start + idx,
      isFocused: range.start + idx === focused
    }));
  });

  offsetY = computed(() => {
    if (!this.isBrowser) return 0;
    
    const range = this.visibleRange();
    if (this.itemPositions.length > 0) {
      return this.itemPositions[range.start]?.offset || 0;
    }
    return 0;
  });

  get totalHeight(): number {
    if (this.itemPositions.length > 0) {
      const lastPos = this.itemPositions[this.itemPositions.length - 1];
      const calculatedHeight = lastPos ? lastPos.offset + lastPos.height : 0;
      return calculatedHeight;
    }
    return 0;
  }

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    if (this.isBrowser) {
      queueMicrotask(() => this.scrollContainer?.nativeElement.focus());
      this.setupFocusTracking();
      this.setupResizeObserver();
    }
  }

  ngOnDestroy(): void {
    if (!this.isBrowser) return;
    
    this.resizeObserver?.disconnect();
    
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
    
    if (this.focusOutListener && this.scrollContainer) {
      this.scrollContainer.nativeElement.removeEventListener('focusout', this.focusOutListener);
    }
  }

  private lastScrollTop = 0;

  onScroll(event: Event): void {
    if (!this.isBrowser) return;
    
    const target = event.target as HTMLElement;
    this.lastScrollTop = target.scrollTop;

    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(() => {
        this.scrollTop.set(this.lastScrollTop);
        this.rafId = null;
      });
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    if (!this.isBrowser) return;
    
    event.stopPropagation();
    
    let focused = this.focusedIndex();
    
    if (focused < 0 && this.items.length > 0) {
      const range = this.visibleRange();
      focused = range.start;
      this.focusedIndex.set(focused);
      this.cdr.markForCheck();
      return;
    }
    
    switch(event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.moveFocus(Math.min(this.items.length - 1, focused + 1));
        break;
        
      case 'ArrowUp':
        event.preventDefault();
        this.moveFocus(Math.max(0, focused - 1));
        break;
        
      case 'Enter':
        if (focused >= 0) {
          event.preventDefault();
          this.itemClick.emit(this.items[focused]);
        }
        break;
    }
  }

  onItemMouseDown(index: number): void {
    if (!this.isBrowser) return;
    
    this.focusedIndex.set(index);
    this.cdr.markForCheck();
  }

  onContainerBlur(event: FocusEvent): void {
    if (!this.isBrowser) return;
    
    const relatedTarget = event.relatedTarget as HTMLElement;
    if (!relatedTarget || !this.scrollContainer.nativeElement.contains(relatedTarget)) {
      this.focusedIndex.set(-1);
      this.cdr.markForCheck();
    }
  }

  trackByFn(index: number, data: { item: T; index: number; isFocused: boolean }): number {
    return data.item.id;
  }

  private moveFocus(newIndex: number): void {
    this.focusedIndex.set(newIndex);
    this.scrollToFocused();
    this.cdr.markForCheck();
  }

  private estimateItemHeight(item: T): number {
    const body = (item as any).body || '';
    const title = (item as any).title || '';
    
    const contentLength = body.length + title.length;
    const estimatedTextHeight = Math.ceil(contentLength / 50) * 20;
    const padding = 40;
    
    return Math.max(80, estimatedTextHeight + padding);
  }

  private initializePositions(): void {
    this.itemPositions = [];
    let offset = 0;

    for (let i = 0; i < this.items.length; i++) {
      const height = this.itemHeights.get(i) || this.estimateItemHeight(this.items[i]);
      this.itemPositions.push({ index: i, offset, height });
      offset += height;
    }
  }

  private updatePositions(fromIndex: number): void {
    if (fromIndex >= this.items.length) return;

    let offset = fromIndex > 0 
      ? this.itemPositions[fromIndex - 1].offset + this.itemPositions[fromIndex - 1].height 
      : 0;

    for (let i = fromIndex; i < this.items.length; i++) {
      const height = this.itemHeights.get(i) || this.estimateItemHeight(this.items[i]);
      this.itemPositions[i] = { index: i, offset, height };
      offset += height;
    }
  }

  private getVisibleRangeDynamic(scroll: number): { start: number; end: number } {
    if (this.itemPositions.length === 0) {
      return { start: 0, end: Math.min(20, this.items.length - 1) };
    }

    const scrollBottom = scroll + this.containerHeight;
    let start = 0;
    let end = this.items.length - 1;

    let left = 0;
    let right = this.itemPositions.length - 1;
    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      const pos = this.itemPositions[mid];
      if (pos.offset + pos.height < scroll) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }
    start = Math.max(0, left - this.overscan);

    left = start;
    right = this.itemPositions.length - 1;
    while (left < right) {
      const mid = Math.ceil((left + right) / 2);
      const pos = this.itemPositions[mid];
      if (pos.offset > scrollBottom) {
        right = mid - 1;
      } else {
        left = mid;
      }
    }
    end = Math.min(this.items.length - 1, left + this.overscan);

    return { start, end };
  }

  private scrollToFocused(): void {
    if (!this.isBrowser) return;
    
    const focused = this.focusedIndex();
    if (focused < 0 || !this.itemPositions[focused]) return;

    const container = this.scrollContainer.nativeElement;
    const itemY = this.itemPositions[focused].offset;
    const itemHeight = this.itemPositions[focused].height;
    const scrollTop = this.scrollTop();
    const itemBottom = itemY + itemHeight;
    
    const topPadding = this.containerHeight * 0.05;
    const bottomPadding = this.containerHeight * 0.4;

    let newScrollTop: number | null = null;

    if (itemY < scrollTop + topPadding) {
      newScrollTop = Math.max(0, itemY - topPadding);
    }
    else if (itemBottom > scrollTop + this.containerHeight - bottomPadding) {
      newScrollTop = itemBottom - this.containerHeight + bottomPadding;
    }

    if (newScrollTop !== null) {
      container.scrollTo({
        top: newScrollTop,
        behavior: 'auto'
      });
    }
  }

  private setupFocusTracking(): void {
    const container = this.scrollContainer.nativeElement;
    
    this.focusOutListener = (event: Event) => {
      const focusEvent = event as FocusEvent;
      const relatedTarget = focusEvent.relatedTarget as HTMLElement;
      
      if (!relatedTarget || !container.contains(relatedTarget)) {
        this.focusedIndex.set(-1);
        this.cdr.markForCheck();
      }
    };
    
    container.addEventListener('focusout', this.focusOutListener);
  }

  private resizeRaf: number | null = null;

  private setupResizeObserver(): void {
    this.resizeObserver = new ResizeObserver((entries) => {
      if (this.resizeRaf) cancelAnimationFrame(this.resizeRaf);
      this.resizeRaf = requestAnimationFrame(() => {
        for (const entry of entries) {
          const element = entry.target as HTMLElement;
          const index = parseInt(element.dataset['index'] || '-1', 10);
          if (index >= 0) {
            const newHeight = element.offsetHeight;
            const oldHeight = this.itemHeights.get(index);
            if (oldHeight !== newHeight) {
              this.itemHeights.set(index, newHeight);
              this.updatePositions(index);
              this.cdr.markForCheck();
            }
          }
        }
      });
    });
  }
}