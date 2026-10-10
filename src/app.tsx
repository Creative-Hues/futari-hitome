import { useEffect } from 'preact/hooks';
import { useHash } from './lib/router';
import { Album } from './screens/Album';
import { AlbumDetail } from './screens/AlbumDetail';
import { Home } from './screens/Home';
import { Knit } from './screens/Knit';
import { NewWork } from './screens/NewWork';
import { Record } from './screens/Record';

export function App() {
  const hash = useHash();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [hash]);

  if (hash === '#/new') return <NewWork />;
  if (hash === '#/album') return <Album />;
  const m = hash.match(/^#\/(knit|record|album)\/(.+)$/);
  if (m) {
    const id = decodeURIComponent(m[2]);
    if (m[1] === 'knit') return <Knit key={id} id={id} />;
    if (m[1] === 'record') return <Record key={id} id={id} />;
    return <AlbumDetail key={id} id={id} />;
  }
  return <Home />;
}
