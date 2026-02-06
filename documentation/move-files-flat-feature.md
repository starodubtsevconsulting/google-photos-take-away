# Move Files Flat Feature

## Purpose
The project provides a flat move step that consolidates nested Google Takeout media into a single destination folder. It supports images and videos, avoids reprocessing the destination tree, and resolves filename collisions by appending an incrementing suffix.

## Flow
- Source: a folder that already contains unpacked Takeout folders with nested media.
- Destination base: a folder where the script creates `photos/` and `videos/` subfolders.
- Photos step: moves image files into `<dst>/photos` with a flat structure.
- Videos step: moves video files into `<dst>/videos` with a flat structure.
- Progress: a progress bar is shown while the files are moved.
- Dry run: prints progress without moving any files.

## Script Usage
```bash
# Photos
./scripts/move_files_flat.sh --src /path/to/unpacked --dst /path/to/base/photos --type image

# Videos
./scripts/move_files_flat.sh --src /path/to/unpacked --dst /path/to/base/videos --type video

# Dry run
./scripts/move_files_flat.sh --dry-run --src /path/to/unpacked --dst /path/to/base/photos --type image
```

## Menu Usage
When running `./takeout.sh`, choose:
- Move photos to `<dst>/photos` (flat)
- Move videos to `<dst>/videos` (flat)

The flow prompts for `src` and `dst` base paths, then moves the selected media type.
