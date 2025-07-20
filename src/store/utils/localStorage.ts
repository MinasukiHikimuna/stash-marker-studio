import { Tag } from '@/services/StashappService';
import { SortField } from '../slices/searchSlice';

export interface SearchParams {
  query: string;
  tags: Tag[];
  sortField: SortField;
  sortDirection: 'ASC' | 'DESC';
}

const STORAGE_KEY = 'stash_marker_search_params';

export const saveSearchParams = (params: SearchParams): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(params));
  } catch (error) {
    console.error('Error saving search parameters:', error);
  }
};

export const loadSearchParams = (): SearchParams | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    console.error('Error loading search parameters:', error);
    return null;
  }
};

export const matchSavedTagsWithLoadedTags = (
  savedTags: Tag[],
  loadedTags: Tag[]
): Tag[] => {
  return savedTags
    .map((savedTag) => {
      const match = loadedTags.find((tag) => tag.id === savedTag.id);
      if (!match) {
        console.log('Could not find matching tag for:', savedTag);
      }
      return match;
    })
    .filter((tag): tag is Tag => tag !== undefined);
};