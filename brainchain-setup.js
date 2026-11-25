/* The Home Screen app can have its own storage. Keep the invite available
   through the install handoff, with the original link as a manual fallback. */
const brainChainSetup = (() => {
 const key = 'bc_pending_setup';
 const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
 const iphone = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
 const online = new URL('./online.html', location.href);
 const path = new URL('./', location.href).pathname;
 const valid = value => typeof value === 'string' && /^[a-z0-9-]{1,64}$/i.test(value);
 function remember(code, tester = false) {
  const value = code === null ? 'profile' : valid(code) ? (tester ? 'tester.' : 'game.') + code : '';
  if (value) localStorage.setItem(key, value);
  else localStorage.removeItem(key);
  document.cookie = key + '=' + value + '; Path=' + path +
   '; SameSite=Lax; Secure; Max-Age=' + (value ? 86400 : 0);
 }
 function pending() {
  const saved = localStorage.getItem(key) ||
   document.cookie.split('; ').find(item => item.startsWith(key + '='))?.slice(key.length + 1);
  if (saved === 'profile') return {profile: true};
  const [kind, code] = (saved || '').split('.');
  return valid(code) ? {code, tester: kind === 'tester'} : null;
 }
 function link(code, tester) {
  const url = new URL(online);
  url.searchParams.set('invite', code);
  url.searchParams.set('setup', tester ? 'tester' : '1');
  return url;
 }
 if (standalone && !location.pathname.endsWith('/online.html')) {
  const invite = pending();
  if (invite?.profile) location.replace(new URL('./online.html#setup-resume', location.href));
  else if (invite) {
   const url = link(invite.code, invite.tester);
   url.searchParams.set('resume', '1');
   location.replace(url);
  }
 }
 let installPrompt;
 window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
 });
 function open({code, tester = false, resume = false, alerts, enable, test, play, signIn} = {}) {
  const dialog = document.getElementById('setupGuide');
  const find = id => document.getElementById(id);
  if (dialog.open) return;
  const title = find('setupTitle'), copy = find('setupCopy'), visual = find('setupVisual');
  const next = find('setupNext'), skip = find('setupSkip'), help = find('setupHelp');
  const detail = find('setupDetail'), sendTest = find('setupTest');
  const status = find('setupStatus'), signInButton = find('setupSignIn');
  const gameLabel = tester ? 'Play Jeremy’s Challenge' : 'Play My Challenge';
  let step = resume && standalone ? 4 : 0;
  let alertState;
  let loadingAlerts = false;
  function render(focus = true) {
   const cards = [
    [tester ? 'Jeremy invited you to play BrainChain' : code ? 'You’re invited to play BrainChain' : 'Set Up BrainChain',
     'Add BrainChain to your Home Screen for a better playing experience. Open it with one tap and get alerts for new messages and when it’s your turn.', '', 'Start Setup'],
    ['1. Find Share', 'Look beside the web address at the bottom of this screen for one of the icons below. If your web address is at the top, look there instead. Tap the three lines, then tap Share. If you see the square with the up arrow, tap that to open Share.', 'share-options', 'I Found Share'],
    ['2. Add BrainChain', 'Tap Share. Scroll down and tap Add to Home Screen. If you see Open as Web App, make sure it’s on. Tap Add.', 'share', 'Done — Next Step'],
    ['3. Open BrainChain', 'Go to the screen where you open your other apps. Find the BrainChain icon and tap it.', 'logo', 'Done — Next Step'],
    ['4. Turn on alerts', 'Tap Enable Alerts. When your phone asks, tap Allow.', '', 'Enable Alerts'],
    [code ? '5. Play your first game' : '5. You’re ready', code ? 'Your challenge is ready to open.' : 'You can change your alerts anytime in Profile.', '', code ? gameLabel : 'Done']
   ];
   if (!iphone && step === 1) cards[1] = ['1. Install BrainChain',
    installPrompt ? 'Tap Install BrainChain, then follow the message on your screen.' :
     'Open your browser menu. Look for Install app or Add to Home screen.', '', installPrompt ? 'Install BrainChain' : 'Done — Next Step'];
   if (step === 4 && alertState?.enabled) {
    cards[4][1] = 'Alerts are on. Send a test alert or continue.';
    cards[4][3] = 'Done — Next Step';
   }
   const [heading, instructions, icon, label] = cards[step];
   title.textContent = heading;
   copy.textContent = instructions;
   visual.dataset.icon = icon;
   next.textContent = label;
   next.disabled = step === 4 && !alertState?.enabled && !alertState?.available;
   sendTest.hidden = step !== 4 || !alertState?.enabled;
   skip.textContent = code ? 'Play Now' : 'Close Setup';
   signInButton.hidden = step !== 4 || !signIn;
   help.hidden = ![1, 2, 3, 4].includes(step);
   detail.hidden = true;
   if (focus) title.focus();
  }
  function go(value) {
   step = value;
   status.textContent = '';
   render();
   if (step !== 4 || loadingAlerts) return;
   loadingAlerts = true;
   status.textContent = 'Checking your alerts…';
   Promise.resolve().then(alerts).then(state => {
    alertState = state;
    if (dialog.open && step === 4) {
     status.textContent = state.message || '';
     render(false);
    }
   }).catch(() => {
    status.textContent = 'Alerts couldn’t load. You can play now and try again in Profile.';
   }).finally(() => { loadingAlerts = false; });
  }
  async function finish() {
   if (!code) { remember(''); dialog.close(); return; }
   next.disabled = skip.disabled = true;
   status.textContent = 'Opening your challenge…';
   try {
    await play();
    remember('');
    localStorage.setItem('bc_setup_seen', '1');
    dialog.close();
   } catch {
    status.textContent = 'This challenge couldn’t open. Check your connection and try again, or ask your friend for a new invite.';
   } finally {
    skip.disabled = false;
    next.disabled = step === 4 && !alertState?.enabled && !alertState?.available;
   }
  }
  skip.onclick = finish;
  signInButton.onclick = () => { dialog.close(); signIn(); };
  dialog.oncancel = event => { if (code) { event.preventDefault(); if (!skip.disabled) finish(); } };
  next.onclick = async () => {
   if (step === 0) {
    if (!standalone) remember(code || null, tester);
    go(standalone ? 4 : 1);
   } else if (step === 1 && !iphone) {
    if (installPrompt) {
     const prompt = installPrompt;
     installPrompt = null;
     await prompt.prompt().catch(() => {});
    }
    go(3);
   } else if (step === 3 && iphone && !standalone) {
    status.textContent = 'Look for the BrainChain icon where you open your other apps. Tap that icon to continue.';
   } else if (step === 4 && !alertState?.enabled) {
    next.disabled = true;
    alertState = await enable();
    status.textContent = alertState.message || '';
    if (dialog.open) render(false);
   } else if (step === 5) {
    await finish();
   } else go(step + 1);
  };
  sendTest.onclick = async () => {
   sendTest.disabled = true;
   try { status.textContent = await test(); }
   finally { sendTest.disabled = false; }
  };
  help.onclick = () => {
   detail.hidden = !detail.hidden;
   find('setupCopyLink').hidden = !iphone || step !== 1;
   find('setupCompass').hidden = !iphone || step !== 1;
   find('setupHelpText').textContent = step === 4 ?
    'If you already tapped Don’t Allow, open Settings on your phone. Tap Notifications, then BrainChain, and turn on Allow Notifications.' :
    step === 2 && iphone ? 'In the Share list, scroll to the bottom and tap Edit Actions. Add Add to Home Screen if it’s listed there.' :
    step === 3 ? 'On an iPhone, swipe down on the screen where your apps are and type BrainChain. Tap the BrainChain icon when it appears.' : iphone ?
   'Still can’t find Share? Tap Copy Link below. Open the blue compass app called Safari. Touch and hold the web address box, then tap Paste and Go.' :
   'If your phone doesn’t offer an install button, tap Play Now. You can return to this guide from Profile.';
  };
  const copyLink = find('setupCopyLink');
  const recovery = find('setupRecovery');
  recovery.hidden = true;
  copyLink.onclick = async () => {
   const url = code ? link(code, tester) : new URL('./online.html#setup', location.href);
   try {
    await navigator.clipboard.writeText(url.href);
    status.textContent = 'Link copied. You can paste it in Safari or use it to open your invite in BrainChain.';
   } catch {
    recovery.hidden = false;
    recovery.value = url.href;
    recovery.select();
   }
  };
  status.textContent = '';
  sendTest.disabled = false;
  skip.disabled = false;
  dialog.showModal();
  go(step);
 }
 return {standalone, pending, link, open};
})();
