#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=scripts/lib_validate_folders.sh
. "$SCRIPT_DIR/scripts/lib_validate_folders.sh"
# shellcheck source=scripts/lib_unpack_missing_zips.sh
. "$SCRIPT_DIR/scripts/lib_unpack_missing_zips.sh"
# shellcheck source=scripts/delete-zips.sh
. "$SCRIPT_DIR/scripts/delete-zips.sh"

DEFAULT_SRC_ROOT="/media/USER/DRIVE/takeout"
DEFAULT_DST_ROOT="/media/USER/DRIVE/takeout"

prompt_src_dir() {
  local input
  read -rp "Source folder with unpacked takeout [${DEFAULT_SRC_ROOT}]: " input
  if [ -z "$input" ]; then
    input="$DEFAULT_SRC_ROOT"
  fi
  echo "$input"
}

prompt_dst_root() {
  local input
  read -rp "Destination base folder [${DEFAULT_DST_ROOT}]: " input
  if [ -z "$input" ]; then
    input="$DEFAULT_DST_ROOT"
  fi
  echo "$input"
}

move_photos_flow() {
  local src_dir=$1
  local dst_root=$2
  "$SCRIPT_DIR/scripts/move_files_flat.sh" \
    --src "$src_dir" \
    --dst "$dst_root/photos" \
    --type image
}

move_videos_flow() {
  local src_dir=$1
  local dst_root=$2
  "$SCRIPT_DIR/scripts/move_files_flat.sh" \
    --src "$src_dir" \
    --dst "$dst_root/videos" \
    --type video
}
TARGET_DIR="${1:-.}"

if [ ! -d "$TARGET_DIR" ]; then
  echo "Directory not found: $TARGET_DIR"
  exit 1
fi

cd "$TARGET_DIR"
shopt -s nullglob

while true; do
  ZIP_FILES=( *.zip )
  TOTAL=${#ZIP_FILES[@]}

  if [ "$TOTAL" -eq 0 ]; then
    echo "No zip files found."
    echo
    echo "Choose action:"
    echo "--------------"
    echo "  1) Move photos to <dst>/photos (flat)"
    echo "  2) Move videos to <dst>/videos (flat)"
    echo "  3) Validate unpacked folders contain data"
    echo "  4) Refresh status"
    echo "  5) Exit"
    echo
    read -rp "Enter choice [1-5]: " choice

    case "$choice" in
      1)
        src_dir=$(prompt_src_dir)
        dst_root=$(prompt_dst_root)
        move_photos_flow "$src_dir" "$dst_root"
        ;;
      2)
        src_dir=$(prompt_src_dir)
        dst_root=$(prompt_dst_root)
        move_videos_flow "$src_dir" "$dst_root"
        ;;
      3)
        echo "Nothing to validate: no zip files found."
        ;;
      4)
        continue
        ;;
      5)
        echo "Exit."
        exit 0
        ;;
      *)
        echo "Invalid choice."
        ;;
    esac
    continue
  fi

  unpacked=()
  not_unpacked=()

  for zip in "${ZIP_FILES[@]}"; do
    base="${zip%.zip}"
    if [ -d "$base" ]; then
      unpacked+=( "$zip" )
    else
      not_unpacked+=( "$zip" )
    fi
  done

  echo
  echo "Status:"
  echo "-------"
  echo "${#unpacked[@]} out of $TOTAL unpacked"
  if [ "${#not_unpacked[@]}" -eq 0 ]; then
    echo "All unpacked"
  else
    echo "${#not_unpacked[@]} not unpacked"
  fi
  echo

  if [ "${#not_unpacked[@]}" -eq 0 ]; then
    read -rp "All unpacked. Validate now? [y/N]: " auto_validate
    case "$auto_validate" in
      [yY]|[yY][eE][sS])
        validate_unpacked_folders unpacked
        continue
        ;;
      *)
        ;;
    esac
  fi

  echo "Choose action:"
  echo "--------------"
  echo "  1) Validate unpacked folders contain data"
  echo "  2) Unpack missing zips"
  echo "  3) Move photos to <dst>/photos (flat)"
  echo "  4) Move videos to <dst>/videos (flat)"
  echo "  5) Refresh status"
  echo "  6) Exit"
  echo
  read -rp "Enter choice [1-6]: " choice

  case "$choice" in

    1)
      validate_unpacked_folders unpacked
      ;;

    2)
      unpack_missing_zips not_unpacked
      ;;

    3)
      src_dir=$(prompt_src_dir)
      dst_root=$(prompt_dst_root)
      move_photos_flow "$src_dir" "$dst_root"
      ;;

    4)
      src_dir=$(prompt_src_dir)
      dst_root=$(prompt_dst_root)
      move_videos_flow "$src_dir" "$dst_root"
      ;;

    5)
      continue
      ;;

    6)
      echo "Exit."
      exit 0
      ;;
    *)
      echo "Invalid choice."
      ;;
  esac
done
