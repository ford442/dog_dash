// scene_setup.ts — GUTTED
// ----------------------------------------------------------------------------
// Previously this file created its own THREE.Scene + renderer + camera + lights
// at module load time. That produced a SECOND invisible scene. Objects added
// via environment.ts / create_game_systems.ts / player_loader.ts were never rendered.
//
// All scene, camera, renderer, and light objects now come from the single
// source of truth in scene_context.ts (created once, used by main.ts render loop).
//
// New code MUST import from './scene_context' (or the re-exports here).
// This file is kept only for transitional imports and re-exports the canonical objects.
// No new Scene, Camera, or Renderer is instantiated here.

export {
  canvas,
  scene,
  camera,
  mainLight,
  rimLight,
  accentLight1,
  accentLight2,
  ambientLight,
  renderer,
  rendererBackend,
  requestedRendererBackend,
  rendererFallbackReason,
  touchControls,
  touchSettingsBtn,
  // helpers if used by legacy
  initializeSceneAndRenderer,
  attachLightsAndEnv,
} from './scene_context';

// Legacy materials export removed (was unused). Main defines its own when needed.
// Resize handler lives in main.ts (single registration).
