import { useEffect, useState } from 'react'
import { Session, SupabaseClient, User } from '@supabase/supabase-js'
import App from './App'
import SignIn, { NewPassword } from './components/SignIn'
import { supabase } from './lib/cloud'
import { useLocalStore } from './lib/store'
import { useCloudStore } from './lib/useCloudStore'

export default function Root() {
  return supabase ? <AccountApp client={supabase} /> : <LocalApp />
}

function LocalApp() {
  return <App store={useLocalStore()} />
}

function AccountApp({ client }: { client: SupabaseClient }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [recovering, setRecovering] = useState(false)

  useEffect(() => {
    const { data } = client.auth.onAuthStateChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      setSession(next)
    })
    return () => data.subscription.unsubscribe()
  }, [client])

  if (session === undefined) return <p className="tb-auth-page">Loading&hellip;</p>
  if (recovering && session) return <NewPassword client={client} onDone={() => setRecovering(false)} />
  if (!session) return <SignIn client={client} />
  return <CloudApp key={session.user.id} client={client} user={session.user} />
}

function CloudApp({ client, user }: { client: SupabaseClient; user: User }) {
  const cloud = useCloudStore(client, user)
  if (cloud.status === 'ready') return <App store={cloud.store} />
  if (cloud.status === 'loading') return <p className="tb-auth-page">Loading your calendar&hellip;</p>
  return (
    <div className="tb-auth-page">
      <div className="tb-auth">
        <h1>Couldn&rsquo;t load your calendar</h1>
        <p className="tb-auth-sub">Your saved data hasn&rsquo;t been changed. Check your connection and try again.</p>
        <button className="tb-auth-primary" onClick={cloud.retry}>
          Try again
        </button>
        <button className="tb-text-button" onClick={() => void client.auth.signOut()}>
          Sign out
        </button>
      </div>
    </div>
  )
}
