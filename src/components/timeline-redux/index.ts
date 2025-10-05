/**
 * Timeline Redux Components
 *
 * Modern, refactored timeline component implementation with improved
 * separation of concerns and comprehensive test coverage.
 */

// Main integration component (drop-in replacement for Timeline)
export { default as TimelineRedux } from "./TimelineRedux";
export type { TimelineProps, TimelineRef } from "./TimelineRedux";

// Sub-components (can be used independently if needed)
export { default as TimelineAxis } from "./TimelineAxis";
export type { TimelineAxisProps } from "./TimelineAxis";

export { default as TimelineGrid } from "./TimelineGrid";
export type { TimelineGridProps } from "./TimelineGrid";

export { default as TimelineLabels } from "./TimelineLabels";
export type { TimelineLabelsProps } from "./TimelineLabels";

export { default as TimelinePlayhead } from "./TimelinePlayhead";
export type { TimelinePlayheadProps } from "./TimelinePlayhead";

// Note: TimelineMarkerBar is in the timeline folder as it's used by both implementations
export { TimelineMarkerBar } from "../timeline/TimelineMarkerBar";
export type { TimelineMarkerBarProps } from "../timeline/TimelineMarkerBar";
