#!/usr/bin/env bash
###############################################################################
# HBL MRB – Fix common deployment script issues on Linux
# Run BEFORE install.sh if you get errors like:
#   - "bad interpreter" or "\r" errors (Windows line endings)
#   - "Permission denied"
#   - "syntax error near unexpected token"
#
# Usage: bash deploy/fix-scripts.sh
# Updated: 2026-04-08
###############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "============================================"
echo "  HBL MRB – Fix Deployment Scripts"
echo "============================================"

# 1. Fix Windows line endings (CRLF → LF)
echo "[1/3] Fixing line endings..."
if command -v dos2unix &>/dev/null; then
  dos2unix "$SCRIPT_DIR"/*.sh "$SCRIPT_DIR"/*.sql 2>/dev/null
  echo "  ✓ Line endings fixed (dos2unix)"
elif command -v sed &>/dev/null; then
  for f in "$SCRIPT_DIR"/*.sh "$SCRIPT_DIR"/*.sql; do
    [ -f "$f" ] || continue
    sed -i 's/\r$//' "$f"
  done
  echo "  ✓ Line endings fixed (sed)"
else
  echo "  ⚠ Neither dos2unix nor sed available"
fi

# 2. Set executable permissions
echo "[2/3] Setting permissions..."
chmod +x "$SCRIPT_DIR"/*.sh
echo "  ✓ All .sh files are executable"

# 3. Verify scripts parse correctly
echo "[3/3] Syntax checking scripts..."
ERRORS=0
for f in "$SCRIPT_DIR"/*.sh; do
  [ -f "$f" ] || continue
  FNAME=$(basename "$f")
  if bash -n "$f" 2>/dev/null; then
    echo "  ✓ $FNAME"
  else
    echo "  ✗ $FNAME has syntax errors:"
    bash -n "$f" 2>&1 | head -3
    ERRORS=$((ERRORS + 1))
  fi
done

echo ""
if [ "$ERRORS" -eq 0 ]; then
  echo "  All scripts passed validation!"
else
  echo "  ⚠ $ERRORS script(s) have errors — review above"
fi

echo ""
echo "  Now run: sudo bash deploy/install.sh"
echo ""
