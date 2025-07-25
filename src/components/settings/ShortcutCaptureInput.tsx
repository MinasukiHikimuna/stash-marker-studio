"use client";

import React, { useState, useRef, useCallback, useEffect, useId } from 'react';
import { KeyBinding } from '@/types/keyboard';
import { keyboardShortcutService } from '@/services/KeyboardShortcutService';
import { useShortcutCapture } from '@/contexts/ShortcutCaptureContext';

interface ShortcutCaptureInputProps {
  bindings: KeyBinding[];
  onBindingsChange: (bindings: KeyBinding[]) => void;
  onReset?: () => void;
  disabled?: boolean;
  className?: string;
}

export function ShortcutCaptureInput({ 
  bindings, 
  onBindingsChange, 
  onReset,
  disabled = false,
  className = '' 
}: ShortcutCaptureInputProps) {
  const id = useId();
  const { startCapture, stopCapture, isCapturing: isCaptureActive } = useShortcutCapture();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  
  const isCapturing = isCaptureActive(id);

  // Focus handler to start capture mode
  const handleFocus = useCallback(() => {
    if (disabled) return;
    startCapture(id);
  }, [disabled, startCapture, id]);

  // Blur handler to stop capture mode
  const handleBlur = useCallback(() => {
    stopCapture(id);
    setEditingIndex(null);
  }, [stopCapture, id]);

  // Key capture handler
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!isCapturing || disabled) return;

    // Prevent default behavior during capture
    event.preventDefault();
    event.stopPropagation();

    // Ignore modifier keys by themselves
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) {
      return;
    }

    // Create new binding
    const newBinding: KeyBinding = {
      key: event.key,
      modifiers: {
        ctrl: event.ctrlKey || event.metaKey,
        alt: event.altKey,
        shift: event.shiftKey,
        meta: event.metaKey,
      }
    };

    // Validate the binding
    const validation = keyboardShortcutService.validateBinding(newBinding);
    if (!validation.valid) {
      // TODO: Show error message
      console.warn(`Invalid binding: ${validation.error}`);
      return;
    }

    // If editing existing binding, replace it
    if (editingIndex !== null) {
      const newBindings = [...bindings];
      newBindings[editingIndex] = newBinding;
      onBindingsChange(newBindings);
      setEditingIndex(null);
    } else {
      // Add new binding (avoid duplicates)
      const isDuplicate = bindings.some(binding => 
        binding.key === newBinding.key &&
        JSON.stringify(binding.modifiers) === JSON.stringify(newBinding.modifiers)
      );
      
      if (!isDuplicate) {
        onBindingsChange([...bindings, newBinding]);
      }
    }

    // Stop capturing
    stopCapture(id);
    inputRef.current?.blur();
  }, [isCapturing, disabled, bindings, onBindingsChange, editingIndex, stopCapture, id]);

  // Add event listeners when capturing
  useEffect(() => {
    if (isCapturing) {
      // Use capture phase and stop propagation to prevent other keyboard handlers
      const captureHandler = (event: KeyboardEvent) => {
        event.stopImmediatePropagation();
        handleKeyDown(event);
      };
      
      document.addEventListener('keydown', captureHandler, true);
      return () => {
        document.removeEventListener('keydown', captureHandler, true);
      };
    }
  }, [isCapturing, handleKeyDown]);

  // Remove a binding
  const removeBinding = useCallback((index: number) => {
    if (disabled) return;
    const newBindings = bindings.filter((_, i) => i !== index);
    onBindingsChange(newBindings);
  }, [bindings, onBindingsChange, disabled]);

  // Edit a binding
  const editBinding = useCallback((index: number) => {
    if (disabled) return;
    setEditingIndex(index);
    startCapture(id);
    inputRef.current?.focus();
  }, [disabled, startCapture, id]);

  const baseClasses = `
    min-h-[2.5rem] p-2 border rounded-md bg-gray-800 border-gray-600
    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-text hover:border-gray-500'}
    ${isCapturing ? 'ring-2 ring-blue-500 border-transparent bg-blue-900 bg-opacity-20' : ''}
  `.trim();

  return (
    <div className={`${baseClasses} ${className}`}>
      <div
        ref={inputRef}
        tabIndex={disabled ? -1 : 0}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className="min-h-[1.25rem] flex items-center flex-wrap gap-2 text-white"
        role="textbox"
        aria-label="Keyboard shortcut input"
        data-keyboard-capture={isCapturing ? "true" : "false"}
      >
        {/* Display existing bindings */}
        {bindings.map((binding, index) => (
          <div
            key={index}
            className={`
              flex items-center gap-1 px-2 py-1 bg-gray-700 rounded text-sm
              ${editingIndex === index ? 'ring-2 ring-yellow-500' : ''}
            `}
          >
            <span className="font-mono">
              {keyboardShortcutService.getBindingDisplayString(binding)}
            </span>
            {!disabled && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => editBinding(index)}
                  className="text-gray-400 hover:text-white text-xs p-0.5"
                  title="Edit binding"
                >
                  ✎
                </button>
                <button
                  type="button"
                  onClick={() => removeBinding(index)}
                  className="text-gray-400 hover:text-red-400 text-xs p-0.5"
                  title="Remove binding"
                >
                  ×
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Capture state indicator */}
        {isCapturing && (
          <div className="text-blue-400 text-sm italic animate-pulse">
            {editingIndex !== null 
              ? "Press new key combination to replace..."
              : "Press key combination to add..."
            }
          </div>
        )}

        {/* Empty state */}
        {bindings.length === 0 && !isCapturing && (
          <div className="text-gray-400 text-sm flex-1">
            {disabled ? "No bindings configured" : "Click to add keyboard shortcut"}
          </div>
        )}

        {/* Action buttons - inline on the right */}
        {!disabled && !isCapturing && (
          <div className="flex items-center gap-1 ml-auto">
            {onReset && (
              <button
                type="button"
                onClick={onReset}
                className="text-blue-400 hover:text-blue-300 text-sm px-1"
                title="Reset to default"
              >
                ↻
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                startCapture(id);
                inputRef.current?.focus();
              }}
              className="text-blue-400 hover:text-blue-300 text-lg font-semibold px-1"
              title="Add binding"
            >
              +
            </button>
          </div>
        )}
      </div>
    </div>
  );
}