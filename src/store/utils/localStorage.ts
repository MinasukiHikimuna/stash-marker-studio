import { Tag } from '@/services/StashappService';
import { SortField, SelectedTag } from '../slices/searchSlice';

export interface SearchParams {
  query: string;
  tags: SelectedTag[];
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
    if (!saved) return null;
    
    const parsed = JSON.parse(saved);
    
    // Handle backward compatibility - if tags don't have type field, default to 'included'
    if (parsed.tags && Array.isArray(parsed.tags)) {
      parsed.tags = parsed.tags.map((tag: Tag | SelectedTag) => ({
        ...tag,
        type: ('type' in tag) ? tag.type : 'included' // Default to 'included' for old data
      }));
    }
    
    return parsed;
  } catch (error) {
    console.error('Error loading search parameters:', error);
    return null;
  }
};

export const matchSavedTagsWithLoadedTags = (
  savedTags: SelectedTag[],
  loadedTags: Tag[]
): SelectedTag[] => {
  return savedTags
    .map((savedTag) => {
      const match = loadedTags.find((tag) => tag.id === savedTag.id);
      if (!match) {
        console.log('Could not find matching tag for:', savedTag);
        return undefined;
      }
      // Preserve the type from saved tag, use loaded tag data
      return {
        ...match,
        type: savedTag.type
      };
    })
    .filter((tag): tag is SelectedTag => tag !== undefined);
};