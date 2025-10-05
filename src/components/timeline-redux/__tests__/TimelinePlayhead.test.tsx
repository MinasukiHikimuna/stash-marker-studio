import React from 'react';
import { render } from '@testing-library/react';
import TimelinePlayhead from '../TimelinePlayhead';

describe('TimelinePlayhead', () => {
  describe('positioning', () => {
    it('should render at correct pixel position for given time', () => {
      const { container } = render(
        <TimelinePlayhead
          currentTime={10}
          pixelsPerSecond={5}
          swimlaneHeight={100}
        />
      );

      const playhead = container.querySelector('div');
      expect(playhead).toHaveStyle({ left: '50px' }); // 10 * 5 = 50
    });

    it('should render at position 0 when currentTime is 0', () => {
      const { container } = render(
        <TimelinePlayhead
          currentTime={0}
          pixelsPerSecond={5}
          swimlaneHeight={100}
        />
      );

      const playhead = container.querySelector('div');
      expect(playhead).toHaveStyle({ left: '0px' });
    });

    it('should handle fractional seconds', () => {
      const { container } = render(
        <TimelinePlayhead
          currentTime={2.5}
          pixelsPerSecond={10}
          swimlaneHeight={100}
        />
      );

      const playhead = container.querySelector('div');
      expect(playhead).toHaveStyle({ left: '25px' }); // 2.5 * 10 = 25
    });

    it('should handle fractional pixels per second', () => {
      const { container } = render(
        <TimelinePlayhead
          currentTime={10}
          pixelsPerSecond={1.5}
          swimlaneHeight={100}
        />
      );

      const playhead = container.querySelector('div');
      expect(playhead).toHaveStyle({ left: '15px' }); // 10 * 1.5 = 15
    });

    it('should handle very small pixelsPerSecond values (zoomed out)', () => {
      const { container } = render(
        <TimelinePlayhead
          currentTime={1000}
          pixelsPerSecond={0.1}
          swimlaneHeight={100}
        />
      );

      const playhead = container.querySelector('div');
      expect(playhead).toHaveStyle({ left: '100px' }); // 1000 * 0.1 = 100
    });

    it('should handle very large pixelsPerSecond values (zoomed in)', () => {
      const { container } = render(
        <TimelinePlayhead
          currentTime={5}
          pixelsPerSecond={100}
          swimlaneHeight={100}
        />
      );

      const playhead = container.querySelector('div');
      expect(playhead).toHaveStyle({ left: '500px' }); // 5 * 100 = 500
    });
  });

  describe('height', () => {
    it('should render with correct height', () => {
      const { container } = render(
        <TimelinePlayhead
          currentTime={5}
          pixelsPerSecond={5}
          swimlaneHeight={200}
        />
      );

      const playhead = container.querySelector('div');
      expect(playhead).toHaveStyle({ height: '200px' });
    });

    it('should handle small swimlane heights', () => {
      const { container } = render(
        <TimelinePlayhead
          currentTime={5}
          pixelsPerSecond={5}
          swimlaneHeight={32}
        />
      );

      const playhead = container.querySelector('div');
      expect(playhead).toHaveStyle({ height: '32px' });
    });

    it('should handle large swimlane heights', () => {
      const { container } = render(
        <TimelinePlayhead
          currentTime={5}
          pixelsPerSecond={5}
          swimlaneHeight={1000}
        />
      );

      const playhead = container.querySelector('div');
      expect(playhead).toHaveStyle({ height: '1000px' });
    });
  });

  describe('appearance', () => {
    it('should render with orange color', () => {
      const { container } = render(
        <TimelinePlayhead
          currentTime={5}
          pixelsPerSecond={5}
          swimlaneHeight={100}
        />
      );

      const playhead = container.querySelector('div');
      expect(playhead).toHaveClass('bg-orange-500');
    });

    it('should render as thin vertical line', () => {
      const { container } = render(
        <TimelinePlayhead
          currentTime={5}
          pixelsPerSecond={5}
          swimlaneHeight={100}
        />
      );

      const playhead = container.querySelector('div');
      expect(playhead).toHaveClass('w-0.5'); // 2px width
    });

    it('should be positioned absolutely', () => {
      const { container } = render(
        <TimelinePlayhead
          currentTime={5}
          pixelsPerSecond={5}
          swimlaneHeight={100}
        />
      );

      const playhead = container.querySelector('div');
      expect(playhead).toHaveClass('absolute');
      expect(playhead).toHaveClass('top-0');
    });

    it('should not respond to pointer events', () => {
      const { container } = render(
        <TimelinePlayhead
          currentTime={5}
          pixelsPerSecond={5}
          swimlaneHeight={100}
        />
      );

      const playhead = container.querySelector('div');
      expect(playhead).toHaveClass('pointer-events-none');
    });

    it('should have high z-index to appear above other elements', () => {
      const { container } = render(
        <TimelinePlayhead
          currentTime={5}
          pixelsPerSecond={5}
          swimlaneHeight={100}
        />
      );

      const playhead = container.querySelector('div');
      expect(playhead).toHaveClass('z-10');
    });

    it('should be hidden from screen readers', () => {
      const { container } = render(
        <TimelinePlayhead
          currentTime={5}
          pixelsPerSecond={5}
          swimlaneHeight={100}
        />
      );

      const playhead = container.querySelector('div');
      expect(playhead).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('edge cases', () => {
    it('should handle currentTime of 0', () => {
      const { container } = render(
        <TimelinePlayhead
          currentTime={0}
          pixelsPerSecond={10}
          swimlaneHeight={100}
        />
      );

      const playhead = container.querySelector('div');
      expect(playhead).toHaveStyle({ left: '0px' });
    });

    it('should handle pixelsPerSecond of 0 (should not crash)', () => {
      const { container } = render(
        <TimelinePlayhead
          currentTime={10}
          pixelsPerSecond={0}
          swimlaneHeight={100}
        />
      );

      const playhead = container.querySelector('div');
      expect(playhead).toHaveStyle({ left: '0px' }); // 10 * 0 = 0
    });

    it('should handle very large currentTime values', () => {
      const { container } = render(
        <TimelinePlayhead
          currentTime={10000}
          pixelsPerSecond={1}
          swimlaneHeight={100}
        />
      );

      const playhead = container.querySelector('div');
      expect(playhead).toHaveStyle({ left: '10000px' });
    });

    it('should handle negative currentTime (should render off-screen to the left)', () => {
      const { container } = render(
        <TimelinePlayhead
          currentTime={-5}
          pixelsPerSecond={10}
          swimlaneHeight={100}
        />
      );

      const playhead = container.querySelector('div');
      expect(playhead).toHaveStyle({ left: '-50px' });
    });
  });

  describe('updates', () => {
    it('should update position when currentTime changes', () => {
      const { container, rerender } = render(
        <TimelinePlayhead
          currentTime={5}
          pixelsPerSecond={10}
          swimlaneHeight={100}
        />
      );

      let playhead = container.querySelector('div');
      expect(playhead).toHaveStyle({ left: '50px' });

      rerender(
        <TimelinePlayhead
          currentTime={10}
          pixelsPerSecond={10}
          swimlaneHeight={100}
        />
      );

      playhead = container.querySelector('div');
      expect(playhead).toHaveStyle({ left: '100px' });
    });

    it('should update position when pixelsPerSecond changes', () => {
      const { container, rerender } = render(
        <TimelinePlayhead
          currentTime={10}
          pixelsPerSecond={5}
          swimlaneHeight={100}
        />
      );

      let playhead = container.querySelector('div');
      expect(playhead).toHaveStyle({ left: '50px' });

      rerender(
        <TimelinePlayhead
          currentTime={10}
          pixelsPerSecond={10}
          swimlaneHeight={100}
        />
      );

      playhead = container.querySelector('div');
      expect(playhead).toHaveStyle({ left: '100px' });
    });

    it('should update height when swimlaneHeight changes', () => {
      const { container, rerender } = render(
        <TimelinePlayhead
          currentTime={5}
          pixelsPerSecond={10}
          swimlaneHeight={100}
        />
      );

      let playhead = container.querySelector('div');
      expect(playhead).toHaveStyle({ height: '100px' });

      rerender(
        <TimelinePlayhead
          currentTime={5}
          pixelsPerSecond={10}
          swimlaneHeight={200}
        />
      );

      playhead = container.querySelector('div');
      expect(playhead).toHaveStyle({ height: '200px' });
    });
  });

  describe('precision', () => {
    it('should handle sub-pixel positioning accurately', () => {
      const { container } = render(
        <TimelinePlayhead
          currentTime={1.234567}
          pixelsPerSecond={10.987654}
          swimlaneHeight={100}
        />
      );

      const playhead = container.querySelector('div');
      const expectedPosition = 1.234567 * 10.987654;
      expect(playhead).toHaveStyle({ left: `${expectedPosition}px` });
    });

    it('should maintain precision with very small values', () => {
      const { container } = render(
        <TimelinePlayhead
          currentTime={0.001}
          pixelsPerSecond={1000}
          swimlaneHeight={100}
        />
      );

      const playhead = container.querySelector('div');
      expect(playhead).toHaveStyle({ left: '1px' }); // 0.001 * 1000 = 1
    });
  });
});
