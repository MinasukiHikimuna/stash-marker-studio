"use client";

import { useMemo } from "react";
import { type Tag } from "../../services/StashappService";
import { TagAutocomplete } from "./TagAutocomplete";
import { useAppSelector } from "../../store/hooks";
import { selectMarkerGroupParentId } from "../../store/slices/configSlice";

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
  const markerGroupParentId = useAppSelector(selectMarkerGroupParentId);

  // Filter tags to only show Marker Group tags (tags that have markerGroupParentId as a parent)
  const markerGroupTags = useMemo(() => {
    if (!markerGroupParentId) {
      return [];
    }

    return availableTags.filter((tag) =>
      tag.parents?.some((parent) => parent.id === markerGroupParentId)
    );
  }, [availableTags, markerGroupParentId]);

  return (
    <TagAutocomplete
      {...props}
      availableTags={markerGroupTags}
      placeholder={props.placeholder || "Type to search marker groups..."}
    />
  );
}