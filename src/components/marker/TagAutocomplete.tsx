"use client";

import { useEffect, useRef, useState } from "react";
import { type Tag } from "../../services/StashappService";

interface TagAutocompleteProps {
  value: string;
  onChange: (tagId: string) => void;
  availableTags: Tag[];
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  onSave?: (tagId?: string) => void;
  onCancel?: () => void;
}

export function TagAutocomplete({
  value,
  onChange,
  availableTags,
  placeholder = "Type to search tags...",
  className = "",
  autoFocus = false,
  onSave,
  onCancel,
}: TagAutocompleteProps) {
  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [openUpward, setOpenUpward] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Find the current tag name based on value
  const currentTag = availableTags.find((tag) => tag.id === value);

  useEffect(() => {
    if (currentTag && !autoFocus) {
      setInputValue(currentTag.name);
    } else if (autoFocus) {
      // Clear input when starting inline editing so user can just start typing
      setInputValue("");
    }
  }, [currentTag, autoFocus]);

  // Auto-focus when component mounts if autoFocus is true
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
      // Don't select text since we're clearing it - just focus for typing
    }
  }, [autoFocus]);

  // Filter and sort tags based on input with priority scoring
  const filteredTags = availableTags
    .filter((tag) => tag.name.toLowerCase().includes(inputValue.toLowerCase()))
    .sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      const searchTerm = inputValue.toLowerCase();

      // Exact match gets highest priority
      const aExact = aName === searchTerm;
      const bExact = bName === searchTerm;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      // Starts with gets second priority
      const aStartsWith = aName.startsWith(searchTerm);
      const bStartsWith = bName.startsWith(searchTerm);
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;

      // Within same priority level, sort alphabetically
      return aName.localeCompare(bName);
    });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setIsOpen(true);
    setSelectedIndex(-1);
    checkDropdownDirection();
  };

  const handleInputFocus = () => {
    setIsOpen(true);
    checkDropdownDirection();
  };

  const checkDropdownDirection = () => {
    if (!inputRef.current) return;

    // Find the scrollable marker list container by traversing up the DOM
    let scrollContainer = inputRef.current.parentElement;
    while (scrollContainer) {
      const styles = window.getComputedStyle(scrollContainer);
      if (
        styles.overflowY === "auto" ||
        styles.overflowY === "scroll" ||
        scrollContainer.classList.contains("overflow-y-auto")
      ) {
        break;
      }
      scrollContainer = scrollContainer.parentElement;
    }

    if (!scrollContainer) {
      setOpenUpward(false);
      return;
    }

    const inputRect = inputRef.current.getBoundingClientRect();
    const containerRect = scrollContainer.getBoundingClientRect();
    const dropdownMaxHeight = 192; // max-h-48 = 192px

    // Calculate space within the scrollable container
    const spaceBelow = containerRect.bottom - inputRect.bottom;
    const spaceAbove = inputRect.top - containerRect.top;

    // If there's not enough space below but more space above, open upward
    if (
      spaceBelow < dropdownMaxHeight &&
      spaceAbove > spaceBelow &&
      spaceAbove > 100
    ) {
      setOpenUpward(true);
    } else {
      setOpenUpward(false);
    }
  };

  const handleSelectTag = (tag: Tag) => {
    setInputValue(tag.name);
    onChange(tag.id);
    setIsOpen(false);
    setSelectedIndex(-1);
    // Auto-save when a tag is selected if onSave is provided
    if (onSave) {
      onSave(tag.id);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < filteredTags.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < filteredTags.length) {
        handleSelectTag(filteredTags[selectedIndex]);
      } else if (filteredTags.length > 0) {
        // Select the first matching tag if no specific selection
        handleSelectTag(filteredTags[0]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setSelectedIndex(-1);
      inputRef.current?.blur();
      // Call onCancel if provided
      if (onCancel) {
        onCancel();
      }
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle window resize to recalculate dropdown direction
  useEffect(() => {
    const handleResize = () => {
      if (isOpen) {
        checkDropdownDirection();
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isOpen]);

  return (
    <div className={`relative ${className}`}>
      <input
        ref={inputRef}
        type="text"
        className="w-full bg-gray-700 text-white px-2 py-1 rounded-sm"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
      />
      {isOpen && filteredTags.length > 0 && (
        <div
          ref={dropdownRef}
          className={`absolute z-50 w-full bg-gray-700 border border-gray-600 rounded-sm shadow-lg max-h-48 overflow-y-auto ${
            openUpward ? "bottom-full mb-1" : "top-full mt-1"
          }`}
        >
          {filteredTags.map((tag, index) => (
            <div
              key={tag.id}
              className={`px-3 py-2 cursor-pointer text-white ${
                index === selectedIndex ? "bg-blue-600" : "hover:bg-gray-600"
              }`}
              onClick={() => handleSelectTag(tag)}
              title={tag.description || undefined}
            >
              <div className="font-medium">{tag.name}</div>
            </div>
          ))}
        </div>
      )}
      {isOpen && filteredTags.length === 0 && inputValue && (
        <div
          ref={dropdownRef}
          className={`absolute z-50 w-full bg-gray-700 border border-gray-600 rounded-sm shadow-lg ${
            openUpward ? "bottom-full mb-1" : "top-full mt-1"
          }`}
        >
          <div className="px-3 py-2 text-gray-400">
            No tags found matching &quot;{inputValue}&quot;
          </div>
        </div>
      )}
    </div>
  );
}