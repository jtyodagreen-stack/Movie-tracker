// Curated cinema posters and backdrops for popular shows & genres
export const GENRE_BACKDROPS: Record<string, string> = {
  Drama: 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?q=80&w=1600&auto=format&fit=crop',
  Action: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=1600&auto=format&fit=crop',
  Documentary: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?q=80&w=1600&auto=format&fit=crop',
  Comedy: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?q=80&w=1600&auto=format&fit=crop',
  'Sci-Fi': 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1600&auto=format&fit=crop',
  Thriller: 'https://images.unsplash.com/photo-1509281373149-e957c6296406?q=80&w=1600&auto=format&fit=crop',
  Animation: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=1600&auto=format&fit=crop',
  Crime: 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=1600&auto=format&fit=crop',
  Default: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?q=80&w=1600&auto=format&fit=crop',
};

export const GENRE_POSTERS: Record<string, string> = {
  Drama: 'https://images.unsplash.com/photo-1518676590629-3dcbd9c5a5c9?q=80&w=600&auto=format&fit=crop',
  Action: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=600&auto=format&fit=crop',
  Documentary: 'https://images.unsplash.com/photo-1527842891421-42eec6e703ea?q=80&w=600&auto=format&fit=crop',
  Comedy: 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=600&auto=format&fit=crop',
  'Sci-Fi': 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?q=80&w=600&auto=format&fit=crop',
  Thriller: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=600&auto=format&fit=crop',
  Animation: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=600&auto=format&fit=crop',
  Crime: 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=600&auto=format&fit=crop',
  Default: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=600&auto=format&fit=crop',
};

export function getBackdropForShow(title: string, genre: string, existing?: string): string {
  if (existing) return existing;
  const matchGenre = Object.keys(GENRE_BACKDROPS).find((g) =>
    genre.toLowerCase().includes(g.toLowerCase())
  );
  return matchGenre ? GENRE_BACKDROPS[matchGenre] : GENRE_BACKDROPS.Default;
}

export function getPosterForShow(title: string, genre: string, existing?: string): string {
  if (existing) return existing;
  const matchGenre = Object.keys(GENRE_POSTERS).find((g) =>
    genre.toLowerCase().includes(g.toLowerCase())
  );
  return matchGenre ? GENRE_POSTERS[matchGenre] : GENRE_POSTERS.Default;
}
