#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=scripts/lib_validate_folders.sh
. "$SCRIPT_DIR/scripts/lib_validate_folders.sh"
# shellcheck source=scripts/lib_unpack_missing_zips.sh
. "$SCRIPT_DIR/scripts/lib_unpack_missing_zips.sh"
# shellcheck source=scripts/delete-zips.sh
. "$SCRIPT_DIR/scripts/delete-zips.sh"

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
    echo "  1) Validate unpacked folders contain data"
    echo "  2) Refresh status"
    echo "  3) Exit"
    echo
    read -rp "Enter choice [1-3]: " choice

    case "$choice" in
      1)
        echo "Nothing to validate: no zip files found."
        ;;
      2)
        continue
        ;;
      3)
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
  echo "  3) Refresh status"
  echo "  4) Exit"
  echo
  read -rp "Enter choice [1-4]: " choice

  case "$choice" in

    1)
      validate_unpacked_folders unpacked
      ;;

    2)
      unpack_missing_zips not_unpacked
      ;;

    3)
      continue
      ;;

    4)
      echo "Exit."
      exit 0
      ;;

    *)
      echo "Invalid choice."
      ;;
  esac
done
