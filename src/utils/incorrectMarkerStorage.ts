export type IncorrectMarker = {
  markerId: string;
  tagName: string;
  startTime: number;
  endTime: number | null;
  timestamp: string;
  sceneId: string;
  sceneTitle: string;
};

const STORAGE_KEY_PREFIX = "stash-marker-studio-incorrect-";

export const incorrectMarkerStorage = {
  getIncorrectMarkers: (sceneId: string): IncorrectMarker[] => {
    const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${sceneId}`);
    return stored ? JSON.parse(stored) : [];
  },

  addIncorrectMarker: (sceneId: string, marker: IncorrectMarker) => {
    const markers = incorrectMarkerStorage.getIncorrectMarkers(sceneId);
    markers.push(marker);
    localStorage.setItem(
      `${STORAGE_KEY_PREFIX}${sceneId}`,
      JSON.stringify(markers)
    );
  },

  removeIncorrectMarker: (sceneId: string, markerId: string) => {
    const markers = incorrectMarkerStorage.getIncorrectMarkers(sceneId);
    const filtered = markers.filter((m) => m.markerId !== markerId);
    localStorage.setItem(
      `${STORAGE_KEY_PREFIX}${sceneId}`,
      JSON.stringify(filtered)
    );
  },

  clearIncorrectMarkers: (sceneId: string) => {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${sceneId}`);
  },

  getAllIncorrectMarkers: () => {
    const allMarkers: { [sceneId: string]: IncorrectMarker[] } = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_KEY_PREFIX)) {
        const sceneId = key.replace(STORAGE_KEY_PREFIX, "");
        allMarkers[sceneId] =
          incorrectMarkerStorage.getIncorrectMarkers(sceneId);
      }
    }
    return allMarkers;
  },
};
