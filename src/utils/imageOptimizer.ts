/**
 * Image Optimizer Utility
 * Ensures backdrop and poster images are high-resolution and optimized for the UI.
 */

/**
 * Optimizes an image URL for the hero background.
 * Specifically handles Unsplash URLs to provide high-resolution, high-quality versions.
 */
export function getOptimizedBackdrop(url: string | undefined): string {
  const fallback = 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?q=80&w=1600&auto=format&fit=crop';
  if (!url) return fallback;

  // Handle Unsplash optimization
  if (url.includes('images.unsplash.com')) {
    try {
      const urlObj = new URL(url);
      
      // Remove existing quality/width params to override them
      urlObj.searchParams.delete('w');
      urlObj.searchParams.delete('q');
      urlObj.searchParams.delete('auto');
      
      // Set high-quality hero parameters
      // w=2560 for 2K/4K displays, q=90 for high detail, auto=format for modern formats
      urlObj.searchParams.set('w', '2560');
      urlObj.searchParams.set('q', '90');
      urlObj.searchParams.set('auto', 'format,compress');
      urlObj.searchParams.set('fit', 'crop');
      
      return urlObj.toString();
    } catch (e) {
      return url;
    }
  }

  return url;
}

/**
 * Optimizes an image URL for card posters.
 */
export function getOptimizedPoster(url: string | undefined): string {
  const fallback = 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=600&auto=format&fit=crop';
  if (!url) return fallback;

  if (url.includes('images.unsplash.com')) {
    try {
      const urlObj = new URL(url);
      urlObj.searchParams.set('w', '800');
      urlObj.searchParams.set('q', '80');
      urlObj.searchParams.set('auto', 'format,compress');
      urlObj.searchParams.set('fit', 'crop');
      return urlObj.toString();
    } catch (e) {
      return url;
    }
  }

  return url;
}
