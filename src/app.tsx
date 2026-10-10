import { useEffect } from 'preact/hooks';
import { useHash } from './lib/router';
import { Home } from './screens/Home';
import { NewWork } from './screens/NewWork';
import { Knit } from './screens/Knit';

export function App() {
  const hash = useHash();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [hash]);

  if (hash === '#/new') return <NewWork />;
  const knit = hash.match(/^#\/knit\/(.+)$/);
  if (knit) return <Knit key={knit[1]} id={decodeURIComponent(knit[1])} />;
  return <Home />;
}
