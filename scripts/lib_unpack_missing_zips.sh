#!/usr/bin/env bash

_draw_progress_bar() {
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

_unpack_with_progress() {
  local zip=$1
  local dest=$2
  local total
  if ! command -v zipinfo >/dev/null 2>&1; then
    unzip -o "$zip" -d "$dest"
    return
  fi

  total=$(zipinfo -1 "$zip" 2>/dev/null | wc -l | tr -d ' ')

  if [ -z "$total" ] || [ "$total" -le 0 ]; then
    unzip -o "$zip" -d "$dest"
    return
  fi

  local count=0
  unzip -o "$zip" -d "$dest" 2>/dev/null | while IFS= read -r line; do
    ((count++))
    local entry=${line#*: }
    entry=${entry##*/}
    if [ "${#entry}" -gt 40 ]; then
      entry="...${entry: -37}"
    fi
    _draw_progress_bar "$count" "$total" "$entry"
  done || true
  local unzip_rc=${PIPESTATUS[0]}
  if [ "$unzip_rc" -ne 0 ]; then
    return "$unzip_rc"
  fi
  printf "\n"
}

unpack_missing_zips() {
  local -n _not_unpacked=$1

  echo
  echo "Unpacking missing zips..."
  for zip in "${_not_unpacked[@]}"; do
    local base="${zip%.zip}"
    echo "  → $zip"
    if ! _unpack_with_progress "$zip" "$base"; then
      local rc=$?
      echo "  ! Unzip failed (rc=$rc) for $zip"
    fi
  done
}
