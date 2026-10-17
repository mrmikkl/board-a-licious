import { AppProvider, SIGN_IN_URL, useServices, useSignedOut } from './context.tsx'
import { Celebrate } from './components/Celebrate.tsx'
import { Header } from './components/Header.tsx'
import { HexBoard } from './components/HexBoard.tsx'
import { TabBar } from './components/TabBar.tsx'
import { TapPulse } from './components/TapPulse.tsx'
import { ToastProvider } from './components/Toast.tsx'
import { useIntroOpen } from './intro.ts'
import { type Route, useRoute } from './router.ts'
import { Add } from './screens/Add.tsx'
import { AddByLink } from './screens/AddByLink.tsx'
import { Collection } from './screens/Collection.tsx'
import { Collections } from './screens/Collections.tsx'
import { Intro } from './screens/Intro.tsx'
import { List } from './screens/List.tsx'
import { Lists } from './screens/Lists.tsx'
import { Search } from './screens/Search.tsx'
import { Share } from './screens/Share.tsx'
import { Swipe } from './screens/Swipe.tsx'

function Screen({ route }: { route: Route }) {
  switch (route.name) {
    case 'collections':
      return <Collections />
    case 'collection':
      return <Collection key={route.id} id={route.id} />
    case 'swipe':
      return <Swipe key={route.id} id={route.id} />
    case 'add-link':
      return <AddByLink key={route.id} id={route.id} />
    case 'lists':
      return <Lists />
    case 'list':
      return <List key={`${route.kind}:${route.listId}`} kind={route.kind} listId={route.listId} />
    case 'add':
      return <Add what={route.what} />
    case 'search':
      return <Search />
    case 'config':
      return <Share />
    default:
      return <Placeholder route={route} />
  }
}

function Placeholder({ route }: { route: Route }) {
  // The other screens arrive with later user stories; until then each route shows its title.
  const titles: Record<Route['name'], string> = {
    collections: 'Collections',
    collection: 'Collection',
    swipe: 'Swipe',
    'add-link': 'Add by link',
    lists: 'BGG lists',
    list: 'BGG list',
    add: 'Add',
    search: 'Search',
    config: 'Config',
  }
  return (
    <>
      <Header title={titles[route.name]} />
      <main className="screen" />
    </>
  )
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
      <Screen route={route} />
      <TabBar route={route} />
    </div>
  )
}

function Boot({ message, signIn = false }: { message?: string; signIn?: boolean }) {
  return (
    <div className="app">
      <Header title="Board-a-licious" />
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
