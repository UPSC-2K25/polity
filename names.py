# File: create_missing_files.py
# Run this script from your project root directory.

import json
from pathlib import Path, PurePosixPath

PROJECT_ROOT = Path(__file__).resolve().parent
NAVIGATION_FILE = PROJECT_ROOT / "data" / "navigation.json"


def collect_paths(config):
    paths = set()

    # Root homepage
    homepage = config.get("site", {}).get("home")
    if homepage:
        paths.add(homepage)

    # Module landing pages and chapter pages
    for section in config.get("sections", []):
        module_path = section.get("path")
        if module_path:
            paths.add(module_path)

        for chapter in section.get("chapters", []):
            chapter_path = chapter.get("path")
            if chapter_path:
                paths.add(chapter_path)

    return sorted(paths)


def create_missing_files():
    if not NAVIGATION_FILE.is_file():
        raise FileNotFoundError(
            f"Navigation file not found: {NAVIGATION_FILE}"
        )

    with NAVIGATION_FILE.open("r", encoding="utf-8") as file:
        config = json.load(file)

    paths = collect_paths(config)

    created = []
    existing = []
    invalid = []

    for relative_path in paths:
        # Validate paths before creating anything.
        parsed_path = PurePosixPath(relative_path)

        if (
            parsed_path.is_absolute()
            or ".." in parsed_path.parts
            or "\\" in relative_path
            or parsed_path.suffix.lower() != ".html"
        ):
            invalid.append(relative_path)
            continue

        target = PROJECT_ROOT.joinpath(*parsed_path.parts)

        if target.exists():
            existing.append(relative_path)
            continue

        target.parent.mkdir(parents=True, exist_ok=True)

        # Create a genuinely empty file; never overwrite existing files.
        try:
            with target.open("x", encoding="utf-8"):
                pass
            created.append(relative_path)
        except FileExistsError:
            existing.append(relative_path)

    print("\nFILE CREATION REPORT")
    print("-" * 40)
    print(f"Paths listed in navigation.json : {len(paths)}")
    print(f"New empty files created         : {len(created)}")
    print(f"Existing files preserved        : {len(existing)}")
    print(f"Invalid paths skipped           : {len(invalid)}")

    if created:
        print("\nCREATED FILES:")
        for path in created:
            print(f"  + {path}")

    if existing:
        print("\nEXISTING FILES (NOT MODIFIED):")
        for path in existing:
            print(f"  = {path}")

    if invalid:
        print("\nINVALID PATHS (SKIPPED):")
        for path in invalid:
            print(f"  ! {path}")

    print("\nCompleted. No existing file was overwritten.")


if __name__ == "__main__":
    create_missing_files()
