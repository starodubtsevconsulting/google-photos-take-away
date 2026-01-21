#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./manage_takeout_zips.sh [path]
# If path is not provided, current directory is used.

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
    exit 0
  fi

  # --------------------
  # PHASE 1 — FAST STATUS
  # --------------------
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
  echo "${#not_unpacked[@]} not unpacked"
  echo

  # --------------------
  # MENU
  # --------------------
  echo "Choose action:"
  echo "--------------"
  echo "  1) Validate unpacked folders contain data"
  echo "  2) Unpack missing zips"
  echo "  3) Refresh status"
  echo "  4) Exit"
  echo
  read -rp "Enter choice [1-4]: " choice

  case "$choice" in

    # --------------------
    # PHASE 2 — VALIDATION
    # --------------------
    1)
      echo
      echo "Validation:"
      echo "-----------"

      ok=0
      empty=0

      for zip in "${unpacked[@]}"; do
        base="${zip%.zip}"
        file_count=$(find "$base" -type f | wc -l)

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
          for zip in "${unpacked[@]}"; do
            rm -v "$zip"
          done
          ;;
        *)
          ;;
      esac
      ;;

    # --------------------
    # UNPACK MISSING
    # --------------------
    2)
      echo
      echo "Unpacking missing zips..."
      for zip in "${not_unpacked[@]}"; do
        base="${zip%.zip}"
        echo "  → $zip"
        unzip -o "$zip" -d "$base"
      done
      ;;

    # --------------------
    # REFRESH STATUS
    # --------------------
    3)
      continue
      ;;

    # --------------------
    # EXIT
    # --------------------
    4)
      echo "Exit."
      exit 0
      ;;

    *)
      echo "Invalid choice."
      ;;
  esac
done

