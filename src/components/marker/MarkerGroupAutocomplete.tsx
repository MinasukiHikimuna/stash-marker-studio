"use client";

import { useMemo } from "react";
import { type Tag } from "../../services/StashappService";
import { TagAutocomplete } from "./TagAutocomplete";

interface MarkerGroupAutocompleteProps {
  value: string;
  onChange: (tagId: string) => void;
  availableTags: Tag[];
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  onSave?: (tagId?: string) => void;
  onCancel?: () => void;
}

export function MarkerGroupAutocomplete({
  availableTags,
  ...props
}: MarkerGroupAutocompleteProps) {
  // Filter tags to only show Marker Group tags (tags with "Marker Group:" naming convention)
  const markerGroupTags = useMemo(() => {
    return availableTags.filter((tag) =>
      tag.name.startsWith("Marker Group: ")
    );
  }, [availableTags]);

  return (
    <TagAutocomplete
      {...props}
      availableTags={markerGroupTags}
      placeholder={props.placeholder || "Type to search marker groups..."}
    />
  );
}