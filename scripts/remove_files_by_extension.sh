#!/usr/bin/env bash
set -euo pipefail

DEFAULT_ROOT="/media/USER/DRIVE/takeout"

prompt_root_dir() {
  local default_root=$1
  local input

  read -rp "Root folder to remove files from [${default_root}]: " input
  if [ -z "$input" ]; then
    input="$default_root"
  fi
  echo "$input"
}

prompt_extension() {
  local input
  read -rp "File extension to remove (e.g. .json): " input
  echo "$input"
}

_draw_progress_bar_remove_files() {
  local current=$1
  local total=$2
  local label=${3:-}
  local width=30
  local filled=$(( current * width / total ))
  local empty=$(( width - filled ))
  local pct=$(( current * 100 / total ))

  printf "\r  ["
  local i
  for ((i=0; i<filled; i++)); do printf "#"; done
  for ((i=0; i<empty; i++)); do printf "-"; done
  if [ -n "$label" ]; then
    printf "] %3d%% %s" "$pct" "$label"
  else
    printf "] %3d%%" "$pct"
  fi
}

remove_files_by_extension() {
  local root=$1
  local ext=$2
  local dry_run=${3:-0}

  if [ ! -d "$root" ]; then
    echo "Directory not found: $root"
    return 1
  fi

  if [ -z "$ext" ]; then
    echo "Extension is required."
    return 1
  fi

  if [[ "$ext" != .* ]]; then
    echo "Extension must start with a dot, e.g. .json"
    return 1
  fi

  echo
  echo "Removing files with extension $ext in: $root"

  local total
  total=$(find "$root" -type f -iname "*$ext" -print0 | tr -cd '\0' | wc -c | tr -d ' ')
  if [ -z "$total" ] || [ "$total" -le 0 ]; then
    echo "No matching files found."
    return 0
  fi

  local removed=0
  local processed=0
  while IFS= read -r -d '' file; do
    ((++processed))
    local label=${file##*/}
    if [ "${#label}" -gt 40 ]; then
      label="...${label: -37}"
    fi
    _draw_progress_bar_remove_files "$processed" "$total" "$label"

    if [ "$dry_run" -eq 1 ]; then
      continue
    fi

    rm -f "$file"
    ((++removed))
  done < <(find "$root" -type f -iname "*$ext" -print0)
  printf "\n"

  if [ "$dry_run" -eq 1 ]; then
    echo "Would remove $processed file(s)."
  else
    echo "Removed $removed file(s)."
  fi
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  root_dir=""
  extension=""
  dry_run=0

  while [ "$#" -gt 0 ]; do
    case "$1" in
      --root)
        shift
        root_dir=${1:-}
        ;;
      --ext)
        shift
        extension=${1:-}
        ;;
      --dry-run)
        dry_run=1
        ;;
      *)
        echo "Unknown argument: $1"
        exit 1
        ;;
    esac
    shift || true
  done

  if [ -z "$root_dir" ]; then
    root_dir=$(prompt_root_dir "$DEFAULT_ROOT")
  fi
  if [ -z "$extension" ]; then
    extension=$(prompt_extension)
  fi

  remove_files_by_extension "$root_dir" "$extension" "$dry_run"
fi
