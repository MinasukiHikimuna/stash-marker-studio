import { useAppSelector, useAppDispatch } from "../../../store/hooks";
import { selectMarkers, selectFilteredSwimlane, setFilteredSwimlane } from "../../../store/slices/markerSlice";
import {
  getActionMarkers,
  calculateMarkerSummary,
} from "../../../core/marker/markerLogic";

interface MarkerSummaryProps {
  className?: string;
}

export function MarkerSummary({ className = "" }: MarkerSummaryProps) {
  const dispatch = useAppDispatch();
  const markers = useAppSelector(selectMarkers);
  const filteredSwimlane = useAppSelector(selectFilteredSwimlane);

  const actionMarkers = getActionMarkers(
    markers || [],
    filteredSwimlane
  );
  const summary = calculateMarkerSummary(actionMarkers);

  return (
    <div
      className={`bg-gray-700 p-4 mb-4 rounded-none flex items-center justify-between sticky top-0 z-10 ${className}`}
      data-testid="marker-summary"
    >
      <div className="flex items-center space-x-4">
        {filteredSwimlane && (
          <div className="flex items-center bg-yellow-600 text-yellow-100 px-2 py-1 rounded-sm text-xs">
            <span className="mr-1">🔍</span>
            <span>Filtered: {filteredSwimlane}</span>
            <button
              onClick={() => dispatch(setFilteredSwimlane(null))}
              className="ml-2 text-yellow-200 hover:text-white"
              title="Clear filter"
            >
              ✕
            </button>
          </div>
        )}
        <div className="flex items-center">
          <span className="text-green-400 mr-1">✓</span>
          <span className="text-white">{summary.confirmed}</span>
        </div>
        <div className="flex items-center">
          <span className="text-red-400 mr-1">✗</span>
          <span className="text-white">{summary.rejected}</span>
        </div>
        <div className="flex items-center">
          <span className="text-yellow-400 mr-1">?</span>
          <span className="text-white">{summary.unknown}</span>
        </div>
      </div>
    </div>
  );
}
