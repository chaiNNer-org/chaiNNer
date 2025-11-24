# Linux Uninstall Cleanup Implementation

## Summary
This document describes the implementation of cleanup scripts for Linux package uninstallation to address issue #2347.

## Problem
When uninstalling chaiNNer on Linux, large directories were left behind in the user's home directory:
- `~/.config/chaiNNer/` (containing integrated Python environment, ~5GB)
- `~/.cache/chainner_pip/` (pip package download cache)

## Solution
Added pre-removal scripts for both .deb and .rpm packages that clean up these directories while preserving user settings and logs.

### Files Added
1. `scripts/linux/prerm` - Debian/Ubuntu pre-removal script
2. `scripts/linux/preun` - RPM (Fedora/RHEL) pre-uninstall script

### Files Modified
1. `forge.config.js` - Updated package maker configurations to use the cleanup scripts

### What Gets Removed
The scripts remove the following directories from `~/.config/chaiNNer/`:
- `ffmpeg/` - FFmpeg binaries
- `python/` - Integrated Python environment (~5GB)
- `settings/` - Old settings directory
- `settings_old/` - Legacy settings backup
- `backend-storage/` - Backend storage

The scripts also remove:
- `~/.cache/chainner_pip/` - Pip package download cache

### What Gets Preserved
The following are intentionally preserved for re-installation or diagnostics:
- `~/.config/chaiNNer/settings.json` - User settings
- `~/.config/chaiNNer/logs/` - Application logs

### Script Behavior
- **Debian (.deb)**: Only runs on `remove` or `purge`, not on upgrade
- **RPM (.rpm)**: Only runs when $1=0 (removal), not when $1=1 (upgrade)
- Uses `|| true` to prevent failures if directories don't exist
- Properly detects user home directory in both sudo and non-sudo contexts

## Testing
Both scripts have been tested to verify:
1. ✅ Large directories are removed during uninstall
2. ✅ Settings and logs are preserved
3. ✅ Cleanup doesn't run during package upgrades
4. ✅ Scripts handle missing directories gracefully

## Security
- CodeQL security analysis passed with 0 alerts
- Scripts use safe path handling with proper quoting
- No dangerous operations that could affect files outside the intended directories
