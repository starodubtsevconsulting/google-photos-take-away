#!/usr/bin/env bash

remove_zip_files() {
  local -n _zips=$1

  echo
  echo "Removing zip files..."
  local total=${#_zips[@]}
  local count=0
  local zip
  for zip in "${_zips[@]}"; do
    ((count++))
    if [ "$total" -gt 0 ]; then
      _draw_progress_bar_delete "$count" "$total"
    fi
    rm -f "$zip"
  done
  printf "\n"
}

_draw_progress_bar_delete() {
  local current=$1
  local total=$2
  local width=30
  local filled=$(( current * width / total ))
  local empty=$(( width - filled ))
  local pct=$(( current * 100 / total ))

  printf "\r  ["
  local i
  for ((i=0; i<filled; i++)); do printf "#"; done
  for ((i=0; i<empty; i++)); do printf "-"; done
  printf "] %3d%%" "$pct"
}
