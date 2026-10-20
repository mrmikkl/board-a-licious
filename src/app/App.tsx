import { AppProvider, SIGN_IN_URL, useServices, useSignedOut } from './context.tsx'
import { AppBar } from './components/AppBar.tsx'
import { Celebrate } from './components/Celebrate.tsx'
import { HexBoard } from './components/HexBoard.tsx'
import { TapPulse } from './components/TapPulse.tsx'
import { ToastProvider } from './components/Toast.tsx'
import { useIntroOpen } from './intro.ts'
import { type Route, href, useRoute } from './router.ts'
import { Collection } from './screens/Collection.tsx'
import { Collections } from './screens/Collections.tsx'
import { Intro } from './screens/Intro.tsx'
import { List } from './screens/List.tsx'
import { Lists } from './screens/Lists.tsx'
import { Search } from './screens/Search.tsx'
import { Config } from './screens/Config.tsx'
import { Share } from './screens/Share.tsx'
import { Shared } from './screens/Shared.tsx'
import { ShowOff } from './screens/ShowOff.tsx'
import { Swipe } from './screens/Swipe.tsx'

function Screen({ route }: { route: Route }) {
  switch (route.name) {
    case 'collections':
      return <Collections create={route.create} />
    case 'collection':
      return <Collection key={route.id} id={route.id} open={route.open} />
    case 'showoff':
      return <ShowOff key={route.id} id={route.id} groups={route.groups} />
    case 'swipe':
      return <Swipe key={`${route.id}:${route.list?.kind}:${route.list?.id}`} id={route.id} list={route.list} />
    case 'lists':
      return <Lists load={route.load} />
    case 'list':
      return <List key={`${route.kind}:${route.listId}`} kind={route.kind} listId={route.listId} />
    case 'search':
      return <Search />
    case 'share':
      return <Share />
    case 'config':
      return <Config />
    case 'shared':
      return <Shared key={href(route)} title={route.title} text={route.text} url={route.url} />
  }
}

/** Shown when the Access session expired: everything keeps working here, syncing needs a new sign-in. */
function SignInBanner() {
  if (!useSignedOut()) return null
  return (
    <div className="signin-banner" role="status">
      <p>Your sign-in has expired. Your changes stay on this phone and are sent once you sign in again.</p>
      <a className="btn btn-primary" href={SIGN_IN_URL}>
        Sign in again
      </a>
    </div>
  )
}

function Shell() {
  const route = useRoute()
  return (
    <div className="app">
      <SignInBanner />
      <AppBar route={route} />
      <Screen route={route} />
    </div>
  )
}

function Boot({ message, signIn = false }: { message?: string; signIn?: boolean }) {
  return (
    <div className="app">
      <AppBar />
      <main className="screen">
        <div className="empty">
          <div className="hex" />
          {message ? <p>{message}</p> : <p>Loading your collections…</p>}
          {signIn && (
            <div className="actions">
              <a className="btn btn-primary btn-block" href={SIGN_IN_URL}>
                Sign in
              </a>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export function App() {
  // the intro comes before the shell; the store boots behind it
  const intro = useIntroOpen()
  return (
    <ToastProvider>
      <HexBoard />
      <TapPulse />
      {intro && <Intro />}
      <Celebrate />
      <AppProvider
        fallback={boot =>
          intro ? null : boot.state === 'loading' ? (
            <Boot />
          ) : boot.state === 'signed-out' ? (
            <Boot message="Sign in with your email to use the app. You get a one-time PIN by email." signIn />
          ) : (
            <Boot message={boot.message} />
          )
        }
      >
        {!intro && <Shell />}
      </AppProvider>
    </ToastProvider>
  )
}
