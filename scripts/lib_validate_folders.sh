#!/usr/bin/env bash

validate_unpacked_folders() {
  local -n _unpacked=$1

  echo
  echo "Validation:"
  echo "-----------"

  local ok=0
  local empty=0

  for zip in "${_unpacked[@]}"; do
    local base="${zip%.zip}"
    local file_count
    file_count=$( (find "$base" -type f 2>/dev/null | wc -l) || true )

    if [ "$file_count" -gt 0 ]; then
      ((ok++))
    else
      ((empty++))
    fi
  done

  echo
  echo "Result:"
  echo "-------"
  echo "Folders with data : $ok"
  echo "Empty folders     : $empty"
  echo

  echo "Next step:"
  echo "----------"
  echo "  1) Remove zip files for validated folders"
  echo "  2) Back to status"
  echo
  read -rp "Enter choice [1-2]: " subchoice

  case "$subchoice" in
    1)
      echo
      echo "Removing zip files..."
      for zip in "${_unpacked[@]}"; do
        rm -v "$zip"
      done
      ;;
    *)
      ;;
  esac
}
