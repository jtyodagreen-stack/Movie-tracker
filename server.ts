import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function createServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Helper to fetch metadata from open entertainment databases (free, instant, no credits needed)
  async function resolveMetadata(title: string, rawType?: string) {
    const cleanTitle = title.trim();
    const isMovie = rawType === 'Movie';

    // 1. If TV Show or format unspecified, query TVMaze first
    if (!isMovie) {
      try {
        const tvRes = await fetch(
          `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(cleanTitle)}&embed=episodes`
        );
        if (tvRes.ok) {
          const data: any = await tvRes.json();
          if (data && data.name) {
            const year = data.premiered ? parseInt(data.premiered.substring(0, 4)) : new Date().getFullYear();
            let genre = (data.genres && data.genres.length > 0) ? data.genres[0] : 'Drama';
            if (genre === 'Science-Fiction') genre = 'Sci-Fi';
            const episodes = data._embedded?.episodes || [];
            const maxEpisodes = episodes.length > 0 ? episodes.length : 8;
            const ratingNum = data.rating?.average
              ? Math.min(5, Math.max(1, Math.round(data.rating.average / 2)))
              : 4;
            const cleanSynopsis = data.summary ? data.summary.replace(/<[^>]*>?/gm, '').trim() : '';
            const posterUrl = data.image?.original || data.image?.medium || '';
            const backdropUrl = data.image?.original || posterUrl || '';

            return {
              title: data.name,
              year: isNaN(year) ? new Date().getFullYear() : year,
              genre,
              maxEpisodes,
              ratingNum,
              synopsis: cleanSynopsis,
              posterUrl,
              backdropUrl,
              type: 'Series',
            };
          }
        }
      } catch (e) {
        console.warn('TVMaze query notice:', e);
      }
    }

    // 2. Query Wikipedia API (ideal for Movies and films, but also covers any title)
    try {
      const searchTerms = isMovie ? `${cleanTitle} film` : cleanTitle;
      const wikiSearchRes = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchTerms)}&format=json&origin=*`
      );
      if (wikiSearchRes.ok) {
        const searchData: any = await wikiSearchRes.json();
        const firstHit = searchData.query?.search?.[0];
        if (firstHit && firstHit.title) {
          const summaryRes = await fetch(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(firstHit.title)}`
          );
          if (summaryRes.ok) {
            const summaryData: any = await summaryRes.json();
            const yearMatch = (summaryData.title + ' ' + (summaryData.extract || '')).match(/\b(19\d{2}|20\d{2})\b/);
            const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
            const poster = summaryData.originalimage?.source || summaryData.thumbnail?.source || '';
            const extract = summaryData.extract || '';

            let genre = 'Drama';
            if (/sci-fi|science fiction|space|futuristic/i.test(extract)) genre = 'Sci-Fi';
            else if (/comedy|humor|satire|sitcom/i.test(extract)) genre = 'Comedy';
            else if (/horror|scary|paranormal|monster/i.test(extract)) genre = 'Horror';
            else if (/action|superhero|heist|espionage/i.test(extract)) genre = 'Action';
            else if (/thriller|mystery|crime|detective/i.test(extract)) genre = 'Thriller';
            else if (/animation|animated|anime/i.test(extract)) genre = 'Animation';
            else if (/documentary|biographical|history/i.test(extract)) genre = 'Documentary';

            return {
              title: cleanTitle,
              year,
              genre,
              maxEpisodes: isMovie ? 1 : 8,
              ratingNum: 4,
              synopsis: extract.slice(0, 320) + (extract.length > 320 ? '...' : ''),
              posterUrl: poster,
              backdropUrl: poster,
              type: isMovie ? 'Movie' : (extract.toLowerCase().includes('television series') ? 'Series' : 'Movie'),
            };
          }
        }
      }
    } catch (e) {
      console.warn('Wikipedia query notice:', e);
    }

    // 3. Secondary TVMaze general fuzzy search if single search was not matched
    try {
      const searchRes = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(cleanTitle)}`);
      if (searchRes.ok) {
        const results: any = await searchRes.json();
        if (results && results.length > 0 && results[0].show) {
          const s = results[0].show;
          const year = s.premiered ? parseInt(s.premiered.substring(0, 4)) : new Date().getFullYear();
          let genre = (s.genres && s.genres.length > 0) ? s.genres[0] : 'Drama';
          if (genre === 'Science-Fiction') genre = 'Sci-Fi';
          const ratingNum = s.rating?.average
            ? Math.min(5, Math.max(1, Math.round(s.rating.average / 2)))
            : 4;
          const cleanSynopsis = s.summary ? s.summary.replace(/<[^>]*>?/gm, '').trim() : '';
          const posterUrl = s.image?.original || s.image?.medium || '';

          return {
            title: s.name || cleanTitle,
            year: isNaN(year) ? new Date().getFullYear() : year,
            genre,
            maxEpisodes: 8,
            ratingNum,
            synopsis: cleanSynopsis,
            posterUrl,
            backdropUrl: posterUrl,
            type: 'Series',
          };
        }
      }
    } catch (e) {
      console.warn('Secondary search notice:', e);
    }

    // 4. Safe fallback
    return {
      title: cleanTitle,
      year: new Date().getFullYear(),
      genre: 'Drama',
      maxEpisodes: isMovie ? 1 : 8,
      ratingNum: 4,
      synopsis: `Details for ${cleanTitle}`,
      posterUrl: '',
      backdropUrl: '',
      type: isMovie ? 'Movie' : 'Series',
    };
  }

  // API for fetching show/movie metadata
  app.post('/api/metadata/fetch', async (req, res) => {
    try {
      const { title, type } = req.body;
      if (!title) {
        return res.status(400).json({ error: 'Title is required' });
      }

      // Always try the open databases first (instant, free, accurate, zero credit cost)
      const openData = await resolveMetadata(title, type);
      if (openData && (openData.posterUrl || openData.synopsis)) {
        return res.json(openData);
      }

      // If open data is partial, optionally try Gemini only if API key exists
      if (process.env.GEMINI_API_KEY) {
        try {
          const ai = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY,
            httpOptions: {
              headers: {
                'User-Agent': 'aistudio-build',
              },
            },
          });

          const prompt = `Find metadata for the ${type || 'show/movie'} titled "${title}". Return valid JSON with title, year (number), genre (single string like Drama, Action, Sci-Fi), maxEpisodes (number), ratingNum (number 1-5), synopsis (string), posterUrl (string), backdropUrl (string), type ("Series" or "Movie").`;

          const response = await ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
            },
          });

          const geminiData = JSON.parse(response.text || '{}');
          if (geminiData && geminiData.title) {
            return res.json({
              ...openData,
              ...geminiData,
              posterUrl: geminiData.posterUrl || openData.posterUrl,
              backdropUrl: geminiData.backdropUrl || openData.backdropUrl,
            });
          }
        } catch (geminiError: any) {
          // If Gemini fails (e.g. 402 credits depleted or rate limit), safely log and use openData
          console.warn('Gemini fallback notice (using open metadata):', geminiError.message || geminiError);
        }
      }

      // Return open data without failing
      return res.json(openData);
    } catch (error: any) {
      console.warn('Metadata fetch fallback notice:', error);
      // Never throw a 500 or 402; return safe defaults
      return res.json({
        title: req.body?.title || 'Unknown Title',
        year: new Date().getFullYear(),
        genre: 'Drama',
        maxEpisodes: 8,
        ratingNum: 4,
        synopsis: '',
        posterUrl: '',
        backdropUrl: '',
        type: req.body?.type || 'Series',
      });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);
    app.get('*', async (req, res, next) => {
      try {
        const url = req.originalUrl;
        const indexPath = path.resolve(__dirname, 'index.html');
        let template = fs.readFileSync(indexPath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${port}`);
  });
}

createServer();
