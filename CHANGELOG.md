# CHANGELOG

## [2.1.2] - 2025-10-16

### Fixed

- The extension was not working in mac os when the browser was in background mode. Fixed by adding "interrupted" state support for AudioContext object.

## [2.1.1] - 2025-10-06

### Added

- Default state initialization on first installation (extension now enabled by default on install)
- Centralized DEFAULT_STATE constant in background service worker

### Fixed

- Pitch mode now correctly preserves user-set playback speeds (1.25x, 1.5x, etc.) when switching modes
- Improved playback rate detection to distinguish between extension-set rates (432Hz, 528Hz) and user-set speeds
- Refactored frequency handling for better scalability when adding new healing frequencies

### Changed

- Optimized state management with better separation of concerns

## [2.1.0] - 2025-09-05

### Added

- Better error control

### Fixed

- Problems with syncronization between UI and storage
- Chrome was showing an error in pages with no video or audio elements
- Eliminated the flash (flash) of the theme when opening the popup through a preload script.

## [2.0.0] - 2025-07-24

### Added

- Add i18n support
- Make the extension compatible with more platforms (Suno, youtube music, etc)

### Changed

- Redesign the popup completely, new styles and modern look

## [1.0.2] - 2025-07-08

### Changed

- Soundtouch is only connected when pitch mode is selected. When rate mode is selected, it should not be connected. This saves resources.

## [1.0.1] - 2025-07-08

### Fixed

- When entering a youtube video with the extension disabled, and then enabling it, the video wasn't tuned properly in pitch mode.

## [1.0.0] - 2025-07-08

- Initial release
