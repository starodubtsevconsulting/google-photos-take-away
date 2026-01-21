#!/usr/bin/env bash

_draw_progress_bar_validate() {
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

validate_unpacked_folders() {
  local -n _unpacked=$1

  echo
  echo "Validation:"
  echo "-----------"

  # Be tolerant of find errors while validating many folders.
  set +e
  set +o pipefail

  local ok=0
  local empty=0
  local total=${#_unpacked[@]}
  local count=0
  local size_threshold=0.7
  local size_report=()
  local size_warnings=0
  local size_warning_names=()
  local size_warning_zips=()

  if [ "$total" -eq 0 ]; then
    echo
    echo "Result:"
    echo "-------"
    echo "Folders with data : 0"
    echo "Empty folders     : 0"
    echo
    set -o pipefail
    set -e
    return 0
  fi

  for zip in "${_unpacked[@]}"; do
    local base="${zip%.zip}"
    local file_count
    file_count=$(find "$base" -type f 2>/dev/null -print | wc -l)

    ((count++))
    local label=${base##*/}
    if [ "${#label}" -gt 40 ]; then
      label="...${label: -37}"
    fi
    if [ "$total" -gt 0 ]; then
      _draw_progress_bar_validate "$count" "$total" "$label"
    fi

    if [ "$file_count" -gt 0 ]; then
      ((ok++))
    else
      ((empty++))
    fi

    if [ -f "$zip" ]; then
      local zip_size
      local folder_size
      local ratio
      zip_size=$(stat -c %s "$zip" 2>/dev/null)
      folder_size=$(du -sb "$base" 2>/dev/null | awk '{print $1}')
      if [ -n "$zip_size" ] && [ -n "$folder_size" ] && [ "$zip_size" -gt 0 ]; then
        ratio=$(awk -v f="$folder_size" -v z="$zip_size" 'BEGIN{printf "%.2f", f/z}')
        size_report+=( "$base|$zip_size|$folder_size|$ratio" )
        if awk -v r="$ratio" -v t="$size_threshold" 'BEGIN{exit !(r < t)}'; then
          ((size_warnings++))
          size_warning_names+=( "$base" )
          size_warning_zips+=( "$zip" )
        fi
      fi
    fi
  done
  printf "\n"

  set -o pipefail
  set -e

  echo
  echo "Result:"
  echo "-------"
  echo "Folders with data : $ok"
  echo "Empty folders     : $empty"
  echo

  if [ "$size_warnings" -gt 0 ]; then
    echo "Size check:"
    echo "-----------"
    echo "Zip size vs folder size (ratio < $size_threshold flagged)"
    for entry in "${size_report[@]}"; do
      IFS='|' read -r name zip_size folder_size ratio <<<"$entry"
      if awk -v r="$ratio" -v t="$size_threshold" 'BEGIN{exit !(r < t)}'; then
        printf "  %s | zip: %s bytes | folder: %s bytes | ratio: %s  !\n" \
          "${name##*/}" "$zip_size" "$folder_size" "$ratio"
      fi
    done
    echo "  Warning: $size_warnings folder(s) smaller than expected."
    echo "  Check:"
    local warn_name
    for warn_name in "${size_warning_names[@]}"; do
      if [ "$warn_name" = "${warn_name#/}" ]; then
        echo "    - $(pwd)/$warn_name"
      else
        echo "    - $warn_name"
      fi
    done
    echo
    echo "Next step:"
    echo "----------"
    echo "  1) Re-unzip flagged zips"
    echo "  2) Continue"
    echo
    read -rp "Enter choice [1-2]: " sizechoice
    case "$sizechoice" in
      1)
        echo
        echo "Re-unzipping flagged zips..."
        local warn_zip
        for warn_zip in "${size_warning_zips[@]}"; do
          local base="${warn_zip%.zip}"
          echo "  → $warn_zip"
          unzip -o "$warn_zip" -d "$base"
        done
        ;;
      *)
        ;;
    esac
    echo
  fi

  echo "Next step:"
  echo "----------"
  echo "  1) Remove zip files for validated folders"
  echo "  2) Back to status"
  echo
  read -rp "Enter choice [1-2]: " subchoice

  case "$subchoice" in
    1)
      remove_zip_files _unpacked
      ;;
    *)
      ;;
  esac
}
