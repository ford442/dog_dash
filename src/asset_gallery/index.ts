/**
 * Asset gallery entry point (`?gallery`). Loaded lazily from `main.ts`, so
 * none of this — or the entry modules it imports — ships in the game's boot
 * path. See `gallery.ts` for the URL parameters and docs/HAZARD_ART.md.
 */
export { startAssetGallery } from './gallery';
export { registerGalleryEntries, getGalleryEntries } from './registry';
export type { GalleryEntry, GalleryInstance, GalleryContext, GalleryCategory, GalleryHitbox } from './registry';
