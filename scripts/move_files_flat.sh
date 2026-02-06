#!/usr/bin/env bash
set -euo pipefail

DEFAULT_SRC="/media/USER/DRIVE/takeout"
DEFAULT_DST="/media/USER/DRIVE/takeout/photos"

prompt_src_dir() {
  local default_root=$1
  local input

  read -rp "Source folder with unpacked takeout [${default_root}]: " input
  if [ -z "$input" ]; then
    input="$default_root"
  fi
  echo "$input"
}

prompt_dst_dir() {
  local default_root=$1
  local input

  read -rp "Destination folder for flat photos [${default_root}]: " input
  if [ -z "$input" ]; then
    input="$default_root"
  fi
  echo "$input"
}

_draw_progress_bar_move() {
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

_file_find() {
  local root=$1
  local dest_dir=$2
  local file_type=$3

  local match=()
  case "$file_type" in
    image)
      match=( \
        -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.gif' -o \
        -iname '*.heic' -o -iname '*.heif' -o -iname '*.webp' -o -iname '*.tiff' -o \
        -iname '*.tif' -o -iname '*.bmp' -o -iname '*.dng' -o -iname '*.cr2' -o \
        -iname '*.cr3' -o -iname '*.nef' -o -iname '*.arw' -o -iname '*.raf' -o \
        -iname '*.rw2' \
      )
      ;;
    video)
      match=( \
        -iname '*.mp4' -o -iname '*.mov' -o -iname '*.m4v' -o -iname '*.avi' -o \
        -iname '*.mkv' -o -iname '*.mts' -o -iname '*.m2ts' -o -iname '*.3gp' -o \
        -iname '*.3gpp' -o -iname '*.3g2' -o -iname '*.webm' -o -iname '*.mpg' -o \
        -iname '*.mpeg' -o -iname '*.mpe' -o -iname '*.wmv' -o -iname '*.flv' -o \
        -iname '*.dv' \
      )
      ;;
    *)
      echo "Unknown --type: $file_type (use image or video)"
      return 1
      ;;
  esac

  find "$root" \
    \( -path "$dest_dir" -o -path "$dest_dir/*" \) -prune -o \
    -type f \( "${match[@]}" \) -print0
}

move_files_flat() {
  local root=$1
  local dest_dir=$2
  local dry_run=${3:-0}
  local file_type=${4:-image}

  if [ ! -d "$root" ]; then
    echo "Directory not found: $root"
    return 1
  fi

  mkdir -p "$dest_dir"

  echo
  echo "Moving files to: $dest_dir"

  local total
  total=$(_file_find "$root" "$dest_dir" "$file_type" | tr -cd '\0' | wc -c | tr -d ' ')
  if [ -z "$total" ] || [ "$total" -le 0 ]; then
    echo "No files found."
    return 0
  fi

  local moved=0
  while IFS= read -r -d '' file; do
    local base
    local target
    local name
    local ext
    local i

    base=$(basename "$file")
    target="$dest_dir/$base"

    if [ -e "$target" ]; then
      name="${base%.*}"
      ext=""
      if [ "$base" != "$name" ]; then
        ext=".${base##*.}"
      fi
      i=1
      while [ -e "$dest_dir/${name}-$i$ext" ]; do
        ((i++))
      done
      target="$dest_dir/${name}-$i$ext"
    fi

    ((++moved))
    local label=${base##*/}
    if [ "${#label}" -gt 40 ]; then
      label="...${label: -37}"
    fi
    _draw_progress_bar_move "$moved" "$total" "$label"

    if [ "$dry_run" -eq 1 ]; then
      continue
    fi

    mv "$file" "$target"
  done < <(_file_find "$root" "$dest_dir" "$file_type")
  printf "\n"

  if [ "$dry_run" -eq 1 ]; then
    echo "Would move $moved file(s)."
  else
    echo "Moved $moved file(s)."
  fi
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  dry_run=0
  src_dir=""
  dst_dir=""
  file_type="image"

  while [ "$#" -gt 0 ]; do
    case "$1" in
      --dry-run)
        dry_run=1
        ;;
      --src)
        shift
        src_dir=${1:-}
        ;;
      --dst)
        shift
        dst_dir=${1:-}
        ;;
      --type)
        shift
        file_type=${1:-}
        ;;
      *)
        echo "Unknown argument: $1"
        exit 1
        ;;
    esac
    shift || true
  done

  if [ -z "$src_dir" ]; then
    src_dir=$(prompt_src_dir "$DEFAULT_SRC")
  fi
  if [ -z "$dst_dir" ]; then
    dst_dir=$(prompt_dst_dir "$DEFAULT_DST")
  fi

  move_files_flat "$src_dir" "$dst_dir" "$dry_run" "$file_type"
fi
