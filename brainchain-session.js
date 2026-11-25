const brainChainSession = (() => {
 const storageKey = 'bc_auth';
 const base = 'https://hsdvkdvimzyyyjdhbtzb.supabase.co';
 const key = 'sb_publishable_r5S0XJMRaDBOXIhiXzslFA_tUYSHuAR';
 let pending = Promise.resolve();

 function read() {
  try {
   return JSON.parse(localStorage.getItem(storageKey));
  } catch {
   return null;
  }
 }

 function save(data) {
  if (!data?.access_token || !data.refresh_token || !data.user?.id) {
   throw Error('BrainChain could not complete sign-in.');
  }
  const session = {...data, expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 3600)};
  localStorage.setItem(storageKey, JSON.stringify(session));
  return session;
 }

 async function request(path, method, body, token) {
  const headers = {apikey: key, 'Content-Type': 'application/json'};
  if (token) headers.Authorization = 'Bearer ' + token;
  const response = await fetch(base + '/auth/v1' + path, {
   method, headers, body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
   throw Error(data?.msg || data?.message || data?.error_description || 'Could not reach the sign-in service.');
  }
  return data;
 }

 function get({createGuest = false} = {}) {
  // Supabase rotates refresh tokens. Read the latest session once this tab holds the lock.
  const restore = async () => {
   const saved = read();
   if (saved?.access_token && saved.user?.id && saved.expires_at * 1000 > Date.now() + 60000) return saved;
   if (!saved?.refresh_token && !createGuest) return null;
   const renewed = saved?.refresh_token
    ? await request('/token?grant_type=refresh_token', 'POST', {refresh_token: saved.refresh_token})
    : await request('/signup', 'POST', {data: {}});
   // An explicit sign-in can replace the session while the request is in flight.
   const current = read();
   if (current?.refresh_token !== saved?.refresh_token) return current;
   return save(renewed);
  };

  const result = pending.then(() => navigator.locks
   ? navigator.locks.request('brainchain-session', restore)
   : restore());
  pending = result.catch(() => {});
  return result;
 }

 return {base, key, read, save, request, get};
})();
