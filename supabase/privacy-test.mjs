// Checks against the LOCAL test backend that each account's data is private.
import { createClient } from '@supabase/supabase-js'
const URL = 'http://127.0.0.1:54321', KEY = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'
const client = () => createClient(URL, KEY, { auth: { persistSession: false } })
let failures = 0
const check = (name, ok, extra = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? ' :: ' + extra : '')); if (!ok) failures++ }
const stamp = Date.now()
const a = client(), b = client(), anon = client()
const ua = (await a.auth.signUp({ email: `a${stamp}@example.test`, password: 'test-password-1' })).data
const ub = (await b.auth.signUp({ email: `b${stamp}@example.test`, password: 'test-password-2' })).data
check('both test accounts created with a session', ua.session && ub.session)
const secret = { version: 1, projects: [{ id: 'x', name: 'A secret', color: '#112233', todos: [] }], blocks: [] }
const ins = await a.from('user_data').insert({ user_id: ua.user.id, data: secret, revision: 1 })
check('A can save own data', !ins.error, ins.error?.message)
const readOwn = await a.from('user_data').select('data').eq('user_id', ua.user.id).maybeSingle()
check('A can read own data', readOwn.data?.data?.projects?.[0]?.name === 'A secret')
const bRead = await b.from('user_data').select('*')
check('B sees no rows of A', !bRead.error && bRead.data.length === 0, JSON.stringify(bRead.data))
const bUpd = await b.from('user_data').update({ data: { hacked: true } }).eq('user_id', ua.user.id).select()
check('B cannot change A', (bUpd.data ?? []).length === 0, bUpd.error?.message)
const bIns = await b.from('user_data').insert({ user_id: ua.user.id, data: { hacked: true }, revision: 9 })
check('B cannot create a row as A', !!bIns.error, bIns.error?.message)
const bDel = await b.from('user_data').delete().eq('user_id', ua.user.id).select()
check('B cannot delete A', (bDel.data ?? []).length === 0, bDel.error?.message)
const aDel = await a.from('user_data').delete().eq('user_id', ua.user.id).select()
check('Nobody can delete through the app API, even own row', (aDel.data ?? []).length === 0, aDel.error?.message)
const anonRead = await anon.from('user_data').select('*')
check('Signed-out visitor reads nothing', !!anonRead.error || anonRead.data.length === 0, anonRead.error?.message)
const stale = await a.from('user_data').update({ data: secret, revision: 8 }).eq('user_id', ua.user.id).eq('revision', 7).select('user_id')
check('Stale save is refused (0 rows)', stale.data?.length === 0)
const move = await a.from('user_data').update({ user_id: ub.user.id }).eq('user_id', ua.user.id).select()
check('A cannot hand a row to B', !!move.error || (move.data ?? []).length === 0, move.error?.message)
const after = await a.from('user_data').select('data, revision').eq('user_id', ua.user.id).maybeSingle()
check("A's data is intact after all of that", after.data?.data?.projects?.[0]?.name === 'A secret' && after.data.revision === 1)
console.log(failures ? `${failures} FAILED` : 'ALL PASSED')
process.exit(failures ? 1 : 0)
