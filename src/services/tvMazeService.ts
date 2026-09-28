export interface TvMazeEpisode {
  id: number;
  url: string;
  name: string;
  season: number;
  number: number;
  airdate: string;
  airtime: string;
  airstamp: string;
  runtime: number;
  summary?: string;
}

export interface TvMazeShowInfo {
  id: number;
  name: string;
  status: string; // "Running", "Ended", "To Be Determined", "In Development"
  premiered?: string;
  officialSite?: string;
  nextEpisode?: TvMazeEpisode;
  previousEpisode?: TvMazeEpisode;
}

/**
 * Searches TVMaze for a given show title and returns embedded next/previous episode details
 */
export async function fetchLiveTvMazeInfo(title: string): Promise<TvMazeShowInfo | null> {
  if (!title || title.trim().length < 2) return null;

  try {
    // TVMaze single search with nextepisode and previousepisode embedded
    const url = `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(title.trim())}&embed[]=nextepisode&embed[]=previousepisode`;
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`TVMaze API responded with status ${res.status}`);
    }

    const data = await res.json();
    if (!data) return null;

    const showInfo: TvMazeShowInfo = {
      id: data.id,
      name: data.name,
      status: data.status,
      premiered: data.premiered,
      officialSite: data.officialSite,
    };

    if (data._embedded) {
      if (data._embedded.nextepisode) {
        showInfo.nextEpisode = data._embedded.nextepisode;
      }
      if (data._embedded.previousepisode) {
        showInfo.previousEpisode = data._embedded.previousepisode;
      }
    }

    return showInfo;
  } catch (err) {
    console.warn('TVMaze fetch error:', err);
    return null;
  }
}
