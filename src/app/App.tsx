import { AppProvider, useServices } from './context.tsx'
import { Header } from './components/Header.tsx'
import { TabBar } from './components/TabBar.tsx'
import { TapPulse } from './components/TapPulse.tsx'
import { ToastProvider } from './components/Toast.tsx'
import { type Route, useRoute } from './router.ts'

function Screen({ route }: { route: Route }) {
  // Screens arrive with the user stories (tasks T032–T074); until then each route shows its title.
  const titles: Record<Route['name'], string> = {
    collections: 'Collections',
    collection: 'Collection',
    swipe: 'Swipe',
    'add-link': 'Add by link',
    lists: 'BGG lists',
    list: 'BGG list',
    add: 'Add',
    search: 'Search',
    share: 'Share & backup',
  }
  return (
    <>
      <Header title={titles[route.name]} />
      <main className="screen" />
    </>
  )
}

function Shell() {
  const route = useRoute()
  const { bggSearch } = useServices()
  return (
    <div className="app">
      <Screen route={route} />
      <TabBar route={route} searchSoon={!bggSearch} />
    </div>
  )
}

function Boot({ message }: { message?: string }) {
  return (
    <div className="app">
      <Header title="Board-a-licious" />
      <main className="screen">
        <div className="empty">
          <div className="hex" />
          {message ? <p>{message}</p> : <p>Loading your collections…</p>}
        </div>
      </main>
    </div>
  )
}

export function App() {
  return (
    <ToastProvider>
      <TapPulse />
      <AppProvider
        fallback={boot =>
          boot.state === 'loading' ? (
            <Boot />
          ) : boot.state === 'signed-out' ? (
            <Boot message="Your sign-in has expired. Reload the page to sign in again." />
          ) : (
            <Boot message={boot.message} />
          )
        }
      >
        <Shell />
      </AppProvider>
    </ToastProvider>
  )
}
