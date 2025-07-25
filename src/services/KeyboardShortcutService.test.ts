import { KeyboardShortcutService } from './KeyboardShortcutService';
import { KeyBinding, KeyboardShortcutConfig } from '../types/keyboard';

// Create a new instance for each test
let service: KeyboardShortcutService;

beforeEach(() => {
  service = new KeyboardShortcutService();
});

describe('KeyboardShortcutService', () => {
  describe('initialization', () => {
    it('should initialize with default shortcuts', async () => {
      await service.initialize();
      
      const shortcuts = service.getAllShortcuts();
      expect(shortcuts.length).toBeGreaterThan(0);
      
      // Check that basic shortcuts exist
      const confirmShortcut = service.getShortcut('marker.confirm');
      expect(confirmShortcut).toBeDefined();
      expect(confirmShortcut?.bindings).toEqual([{ key: 'z' }]);
    });

    it('should merge user config with defaults', async () => {
      const userConfig: KeyboardShortcutConfig = {
        'marker.confirm': {
          bindings: [{ key: 'c' }]
        }
      };

      await service.initialize(userConfig);
      
      const confirmShortcut = service.getShortcut('marker.confirm');
      expect(confirmShortcut?.bindings).toEqual([{ key: 'c' }]);
    });
  });

  describe('key binding lookup', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should find action for simple key', () => {
      const actionId = service.getActionForKeyBinding('z');
      expect(actionId).toBe('marker.confirm');
    });

    it('should find action for key with modifiers', () => {
      const actionId = service.getActionForKeyBinding('x', { shift: true });
      expect(actionId).toBe('system.deleteRejected');
    });

    it('should return null for unknown key combination', () => {
      const actionId = service.getActionForKeyBinding('unknown');
      expect(actionId).toBeNull();
    });

    it('should handle multiple bindings for same action', () => {
      // Video play/pause has both Space and K
      const spaceAction = service.getActionForKeyBinding(' ');
      const kAction = service.getActionForKeyBinding('k');
      
      expect(spaceAction).toBe('video.playPause');
      expect(kAction).toBe('video.playPause');
    });
  });

  describe('shortcut management', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should update shortcut bindings', () => {
      const newBindings: KeyBinding[] = [{ key: 'ctrl+z' }];
      const success = service.updateShortcut('marker.confirm', newBindings);
      
      expect(success).toBe(true);
      
      const updatedShortcut = service.getShortcut('marker.confirm');
      expect(updatedShortcut?.bindings).toEqual(newBindings);
    });

    it('should prevent conflicting shortcuts', () => {
      // Try to set marker.confirm to use 'x' (already used by marker.reject)
      const conflictingBindings: KeyBinding[] = [{ key: 'x' }];
      const success = service.updateShortcut('marker.confirm', conflictingBindings);
      
      expect(success).toBe(false);
    });

    it('should reset shortcut to default', () => {
      // First change the shortcut
      service.updateShortcut('marker.confirm', [{ key: 'test' }]);
      
      // Then reset it
      const success = service.resetShortcut('marker.confirm');
      expect(success).toBe(true);
      
      const resetShortcut = service.getShortcut('marker.confirm');
      expect(resetShortcut?.bindings).toEqual([{ key: 'z' }]);
    });

    it('should reset all shortcuts', () => {
      // Change a shortcut
      service.updateShortcut('marker.confirm', [{ key: 'test' }]);
      
      // Reset all
      service.resetAllShortcuts();
      
      const confirmShortcut = service.getShortcut('marker.confirm');
      expect(confirmShortcut?.bindings).toEqual([{ key: 'z' }]);
    });
  });

  describe('conflict detection', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should detect conflicts with existing shortcuts', () => {
      const conflicts = service.findConflicts([{ key: 'z' }], 'test.action');
      
      expect(conflicts.length).toBe(1);
      expect(conflicts[0].actionId).toBe('marker.confirm');
    });

    it('should exclude action from conflict check', () => {
      const conflicts = service.findConflicts([{ key: 'z' }], 'marker.confirm');
      
      expect(conflicts.length).toBe(0);
    });

    it('should detect multiple conflicts', () => {
      const conflicts = service.findConflicts([
        { key: 'z' },
        { key: 'x' }
      ], 'test.action');
      
      expect(conflicts.length).toBe(2);
    });
  });

  describe('binding validation', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should validate valid bindings', () => {
      const result = service.validateBinding({ key: 'a' });
      expect(result.valid).toBe(true);
    });

    it('should reject empty keys', () => {
      const result = service.validateBinding({ key: '' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should reject reserved keys', () => {
      const result = service.validateBinding({ key: 'F5' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('reserved');
    });
  });

  describe('display formatting', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should format simple key', () => {
      const display = service.getBindingDisplayString({ key: 'a' });
      expect(display).toBe('a');
    });

    it('should format key with modifiers', () => {
      const display = service.getBindingDisplayString({ 
        key: 'a', 
        modifiers: { ctrl: true, shift: true }
      });
      expect(display).toBe('Ctrl + Shift + a');
    });

    it('should format special keys', () => {
      const spaceDisplay = service.getBindingDisplayString({ key: ' ' });
      expect(spaceDisplay).toBe('Space');
      
      const arrowDisplay = service.getBindingDisplayString({ key: 'ArrowUp' });
      expect(arrowDisplay).toBe('↑');
    });
  });

  describe('configuration export', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should export only changed shortcuts', () => {
      // Change a shortcut
      service.updateShortcut('marker.confirm', [{ key: 'c' }]);
      
      const config = service.exportConfig();
      
      // Should only contain the changed shortcut
      expect(Object.keys(config)).toEqual(['marker.confirm']);
      expect(config['marker.confirm'].bindings).toEqual([{ key: 'c' }]);
    });

    it('should export empty config when no changes', () => {
      const config = service.exportConfig();
      expect(Object.keys(config)).toHaveLength(0);
    });
  });
});