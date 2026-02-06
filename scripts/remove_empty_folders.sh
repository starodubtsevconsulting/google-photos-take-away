#!/usr/bin/env bash
set -euo pipefail

DEFAULT_ROOT="/media/USER/DRIVE/takeout"

prompt_root_dir() {
  local default_root=$1
  local input

  read -rp "Root folder to clean empty directories [${default_root}]: " input
  if [ -z "$input" ]; then
    input="$default_root"
  fi
  echo "$input"
}

_draw_progress_bar_remove() {
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

remove_empty_folders() {
  local root=$1

  if [ ! -d "$root" ]; then
    echo "Directory not found: $root"
    return 1
  fi

  echo
  echo "Removing empty folders in: $root"

  local removed=0
  local failed=0
  local pass=0

  while true; do
    local total
    total=$(find "$root" -depth -type d -empty -print0 | tr -cd '\0' | wc -c | tr -d ' ')
    if [ -z "$total" ] || [ "$total" -le 0 ]; then
      if [ "$pass" -eq 0 ]; then
        echo "No empty folders found."
      fi
      break
    fi

    ((++pass))
    local processed=0
    local removed_this_pass=0
    local failed_this_pass=0

    while IFS= read -r -d '' dir; do
      if [ "$dir" = "$root" ]; then
        continue
      fi
      if rmdir "$dir" 2>/dev/null; then
        ((++removed))
        ((++removed_this_pass))
      else
        ((++failed))
        ((++failed_this_pass))
      fi
      ((++processed))
      local label=${dir##*/}
      if [ "${#label}" -gt 40 ]; then
        label="...${label: -37}"
      fi
      _draw_progress_bar_remove "$processed" "$total" "$label"
    done < <(find "$root" -depth -type d -empty -print0)
    printf "\n"

    if [ "$removed_this_pass" -eq 0 ]; then
      break
    fi
  done

  echo "Removed $removed empty folder(s)."
  if [ "$failed" -gt 0 ]; then
    echo "Failed to remove $failed empty folder(s)."
  fi

  local remaining
  remaining=$(find "$root" -type d ! -empty -print0 | tr -cd '\0' | wc -c | tr -d ' ')
  if [ -z "$remaining" ]; then
    remaining=0
  fi

  if [ "$remaining" -gt 0 ]; then
    echo "Not removed (non-empty) folder(s): $remaining"
    echo "Top file extensions in remaining folders (up to 10):"
    find "$root" -type f -print0 | \
      awk -v RS='\0' '
        {
          name=$0
          base=name
          sub(/^.*\//,"",base)
          ext=""
          if (base ~ /^\./ && index(substr(base,2), ".") == 0) {
            ext="<no-ext>"
          } else if (base ~ /\./) {
            ext=tolower("." substr(base, match(base, /[^.]*$/)))
          } else {
            ext="<no-ext>"
          }
          if (!(ext in seen)) {
            seen[ext]=1
            order[++count]=ext
          }
        }
        END {
          for (i=1; i<=count && i<=10; i++) {
            print "  " order[i]
          }
        }
      '
  fi
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  root_dir=""

  while [ "$#" -gt 0 ]; do
    case "$1" in
      --root)
        shift
        root_dir=${1:-}
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

  remove_empty_folders "$root_dir"
fi
