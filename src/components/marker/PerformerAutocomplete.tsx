"use client";

import { useEffect, useRef, useState } from "react";
import { type Performer } from "../../services/StashappService";
import { type GenderHint } from "@/core/slot/types";

interface PerformerAutocompleteProps {
  value: string | null; // performer ID or null for empty
  onChange: (performerId: string | null) => void;
  availablePerformers: Performer[];
  genderHint?: GenderHint | null;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  allowEmpty?: boolean; // Allow clearing the performer
}

export function PerformerAutocomplete({
  value,
  onChange,
  availablePerformers,
  genderHint = null,
  placeholder = "Type to search performers...",
  className = "",
  autoFocus = false,
  allowEmpty = true,
}: PerformerAutocompleteProps) {
  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [openUpward, setOpenUpward] = useState(false);
  const [shouldAutoOpen, setShouldAutoOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Find the current performer based on value
  const currentPerformer = value
    ? availablePerformers.find((p) => p.id === value)
    : null;

  useEffect(() => {
    if (currentPerformer && !autoFocus) {
      setInputValue(currentPerformer.name);
    } else if (autoFocus) {
      setInputValue("");
    } else if (!currentPerformer && !autoFocus) {
      setInputValue("");
    }
  }, [currentPerformer, autoFocus]);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      setShouldAutoOpen(true);
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Filter performers by gender hint if specified
  const genderFilteredPerformers = genderHint
    ? availablePerformers.filter((p) => p.gender === genderHint)
    : availablePerformers;

  // Filter and sort performers based on input
  const filteredPerformers = genderFilteredPerformers
    .filter((p) => p.name.toLowerCase().includes(inputValue.toLowerCase()))
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
    if (shouldAutoOpen) {
      setIsOpen(true);
      checkDropdownDirection();
      setShouldAutoOpen(false);
    }
  };

  const checkDropdownDirection = () => {
    if (!inputRef.current) return;

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
    const dropdownMaxHeight = 192;

    const spaceBelow = containerRect.bottom - inputRect.bottom;
    const spaceAbove = inputRect.top - containerRect.top;

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

  const handleSelectPerformer = (performer: Performer | null) => {
    if (performer) {
      setInputValue(performer.name);
      onChange(performer.id);
    } else {
      setInputValue("");
      onChange(null);
    }
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < filteredPerformers.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < filteredPerformers.length) {
        handleSelectPerformer(filteredPerformers[selectedIndex]);
      } else if (filteredPerformers.length > 0) {
        handleSelectPerformer(filteredPerformers[0]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setSelectedIndex(-1);
      inputRef.current?.blur();
    } else if (e.key === "Backspace" && allowEmpty && inputValue === "") {
      // Clear the performer when backspace on empty input
      onChange(null);
    }
  };

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
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          type="text"
          className="flex-1 bg-gray-700 text-white px-2 py-1 rounded-sm text-xs"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
        />
        {allowEmpty && value && (
          <button
            type="button"
            onClick={() => handleSelectPerformer(null)}
            className="text-gray-400 hover:text-white px-1"
            title="Clear performer"
          >
            ×
          </button>
        )}
      </div>
      {isOpen && filteredPerformers.length > 0 && (
        <div
          ref={dropdownRef}
          className={`absolute z-50 w-full bg-gray-700 border border-gray-600 rounded-sm shadow-lg max-h-48 overflow-y-auto ${
            openUpward ? "bottom-full mb-1" : "top-full mt-1"
          }`}
        >
          {filteredPerformers.map((performer, index) => (
            <div
              key={performer.id}
              className={`px-3 py-2 cursor-pointer text-white text-xs ${
                index === selectedIndex ? "bg-blue-600" : "hover:bg-gray-600"
              }`}
              onClick={() => handleSelectPerformer(performer)}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{performer.name}</span>
                {performer.gender && (
                  <span className="text-xs text-gray-400 ml-2">
                    {performer.gender}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {isOpen && filteredPerformers.length === 0 && inputValue && (
        <div
          ref={dropdownRef}
          className={`absolute z-50 w-full bg-gray-700 border border-gray-600 rounded-sm shadow-lg ${
            openUpward ? "bottom-full mb-1" : "top-full mt-1"
          }`}
        >
          <div className="px-3 py-2 text-gray-400 text-xs">
            No performers found
            {genderHint && ` (filtered by ${genderHint})`}
          </div>
        </div>
      )}
    </div>
  );
}
