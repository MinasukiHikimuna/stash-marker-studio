import { defaultShortcuts, createKeyCombo } from './defaultKeyboardShortcuts';

describe('defaultKeyboardShortcuts', () => {
  describe('defaultShortcuts', () => {
    it('should contain all required shortcut categories', () => {
      const categories = new Set(defaultShortcuts.map(s => s.category));
      
      expect(categories).toContain('marker.review');
      expect(categories).toContain('marker.create');
      expect(categories).toContain('marker.edit');
      expect(categories).toContain('navigation');
      expect(categories).toContain('video.playback');
      expect(categories).toContain('video.jump');
      expect(categories).toContain('system');
    });

    it('should have unique shortcut IDs', () => {
      const ids = defaultShortcuts.map(s => s.id);
      const uniqueIds = new Set(ids);
      
      expect(ids.length).toBe(uniqueIds.size);
    });

    it('should have valid action types', () => {
      const validTypes = ['redux', 'function', 'composite'];
      
      defaultShortcuts.forEach(shortcut => {
        expect(validTypes).toContain(shortcut.action.type);
      });
    });

    it('should have bindings for all shortcuts', () => {
      defaultShortcuts.forEach(shortcut => {
        expect(shortcut.bindings).toBeDefined();
        expect(shortcut.bindings.length).toBeGreaterThan(0);
        
        shortcut.bindings.forEach(binding => {
          expect(binding.key).toBeDefined();
          expect(binding.key.length).toBeGreaterThan(0);
        });
      });
    });

    it('should have descriptions for all shortcuts', () => {
      defaultShortcuts.forEach(shortcut => {
        expect(shortcut.description).toBeDefined();
        expect(shortcut.description.length).toBeGreaterThan(0);
      });
    });
  });

  describe('createKeyCombo', () => {
    it('should create combo for simple key', () => {
      const combo = createKeyCombo('a');
      expect(combo).toBe('a');
    });

    it('should create combo with single modifier', () => {
      const combo = createKeyCombo('a', { ctrl: true });
      expect(combo).toBe('ctrl+a');
    });

    it('should create combo with multiple modifiers', () => {
      const combo = createKeyCombo('a', { ctrl: true, shift: true });
      expect(combo).toBe('ctrl+shift+a');
    });

    it('should create combo in consistent order', () => {
      const combo1 = createKeyCombo('a', { shift: true, ctrl: true });
      const combo2 = createKeyCombo('a', { ctrl: true, shift: true });
      expect(combo1).toBe(combo2);
    });

    it('should handle all modifier types', () => {
      const combo = createKeyCombo('a', { 
        ctrl: true, 
        alt: true, 
        shift: true, 
        meta: true 
      });
      expect(combo).toBe('ctrl+alt+shift+meta+a');
    });

    it('should normalize key case', () => {
      const combo1 = createKeyCombo('A');
      const combo2 = createKeyCombo('a');
      expect(combo1).toBe(combo2);
    });

    it('should handle special keys', () => {
      const spaceCombo = createKeyCombo(' ');
      expect(spaceCombo).toBe(' ');
      
      const arrowCombo = createKeyCombo('ArrowUp');
      expect(arrowCombo).toBe('arrowup');
    });
  });
});