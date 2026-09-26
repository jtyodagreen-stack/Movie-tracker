export interface ShowMetadata {
  title: string;
  year: number;
  genre: string;
  maxEpisodes: number;
  ratingNum: number;
  synopsis: string;
  posterUrl: string;
  backdropUrl: string;
  type: 'Series' | 'Movie';
}

export async function fetchLiveMetadata(title: string, type?: string): Promise<ShowMetadata> {
  try {
    const response = await fetch('/api/metadata/fetch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, type }),
    });

    if (response.ok) {
      const data = await response.json();
      return data;
    }
  } catch (e) {
    console.warn('Metadata service client notice:', e);
  }

  // Graceful fallback if network is unreachable
  return {
    title,
    year: new Date().getFullYear(),
    genre: 'Drama',
    maxEpisodes: type === 'Movie' ? 1 : 8,
    ratingNum: 4,
    synopsis: '',
    posterUrl: '',
    backdropUrl: '',
    type: (type as 'Series' | 'Movie') || 'Series',
  };
}
