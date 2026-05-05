#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

sync_file() {
  local filename="$1"
  local lang="$2"
  local src="$REPO_ROOT/${3:-$filename}"
  local readme="$REPO_ROOT/README.md"
  local tmp="$REPO_ROOT/README.md.tmp"
  local begin="<!-- BEGIN:$filename -->"
  local end="<!-- END:$filename -->"

  # Build replacement: marker, fenced code block, content, closing fence.
  # Some bundled dist files have no trailing newline, which would glue the
  # closing fence to the last source line (e.g. `//# sourceMappingURL=…```)
  # and prevent the fence from closing — so force a newline before it.
  local cleaned="$REPO_ROOT/.sync-cleaned.tmp.$lang"
  grep -v -E '^//#(region|endregion)|^//# sourceMappingURL=' "$src" > "$cleaned"

  if [[ "$lang" == "js" || "$lang" == "ts" ]]; then
    vp fmt "$cleaned" --write 2>/dev/null
  fi

  {
    echo "$begin"
    echo "\`\`\`$lang"
    cat "$cleaned"
    echo "\`\`\`"
  } > "$REPO_ROOT/.sync-block.tmp"

  rm -f "$cleaned"

  # Use awk to skip lines between begin/end markers, inserting replacement block
  awk -v begin="$begin" -v end="$end" -v blockfile="$REPO_ROOT/.sync-block.tmp" '
    $0 == begin {
      while ((getline line < blockfile) > 0) print line
      close(blockfile)
      skip = 1
      next
    }
    $0 == end { print; skip = 0; next }
    skip { next }
    { print }
  ' "$readme" > "$tmp"

  mv "$tmp" "$readme"
  rm -f "$REPO_ROOT/.sync-block.tmp"
}

sync_toc() {
  local readme="$REPO_ROOT/README.md"
  local tmp="$REPO_ROOT/README.md.tmp"
  local tocfile="$REPO_ROOT/.sync-toc.tmp"
  local begin="<!-- BEGIN:toc -->"
  local end="<!-- END:toc -->"

  # Generate a bulleted TOC from top-level (##) headings, skipping the
  # "Contents" heading itself. Anchor rules match GitHub's slugger:
  # lowercase, strip non-alphanumeric (except spaces and hyphens), spaces → hyphens.
  awk '
    /^## / {
      heading = substr($0, 4)
      if (heading == "Contents") next
      anchor = tolower(heading)
      gsub(/[^a-z0-9 -]/, "", anchor)
      gsub(/ /, "-", anchor)
      print "- [" heading "](#" anchor ")"
    }
  ' "$readme" > "$tocfile"

  awk -v begin="$begin" -v end="$end" -v blockfile="$tocfile" '
    $0 == begin {
      print
      while ((getline line < blockfile) > 0) print line
      close(blockfile)
      skip = 1
      next
    }
    $0 == end { print; skip = 0; next }
    skip { next }
    { print }
  ' "$readme" > "$tmp"

  mv "$tmp" "$readme"
  rm -f "$tocfile"
}

sync_file "dist/tailwind/utils.css" "css" "package/dist/tailwind/utils.css"
sync_file "dist/radius-function.css" "css" "package/dist/radius-function.css"
# tailwind/index.mjs — only the tailwind-merge config is shown (hand-written)
# Panda preset — bundled output imports internal chunks, not copy/paste-able (#32)
sync_file "dist/stylex/index.mjs" "js" "package/dist/stylex/index.mjs"
sync_toc

echo "README synced."
