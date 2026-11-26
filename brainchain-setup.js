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
 if (new URL(location.href).searchParams.has('exit-setup')) {
  remember('');
  history.replaceState(null, '', location.pathname + location.hash);
 } else if (standalone && !location.pathname.endsWith('/online.html')) {
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
 function open({code, tester = false, resume = false, alerts, enable, test, play, signIn, exit} = {}) {
  const dialog = document.getElementById('setupGuide');
  const find = id => document.getElementById(id);
  if (dialog.open) return;
  const title = find('setupTitle'), copy = find('setupCopy'), visual = find('setupVisual');
  const next = find('setupNext'), skip = find('setupSkip'), help = find('setupHelp');
  const detail = find('setupDetail'), sendTest = find('setupTest');
  const status = find('setupStatus'), signInButton = find('setupSignIn');
  let opening = false;
  const exitButton = find('setupExit');
  const homeButton = find('setupHome');
  homeButton.onclick = () => {
   remember('');
   dialog.close();
   location.assign(new URL('./index.html?exit-setup=1#home', location.href));
  };
  exitButton.hidden = true;
  exitButton.onclick = () => { remember(''); dialog.close(); exit(); };
  let step = resume ? (standalone ? 4 : 5) : 0;
  let alertState;
  let loadingAlerts = false;
  function cloneShareIcon(selector) {
   const icon = visual.querySelector(selector).cloneNode(true);
   icon.classList.add('setupInlineIcon');
   icon.setAttribute('aria-hidden', 'true');
   return icon;
  }
  function renderInstructions(target, instructions, showShareIcons = false) {
   if (!Array.isArray(instructions)) {
    target.textContent = instructions;
    return;
   }
   const list = document.createElement('ul');
   for (const instruction of instructions) {
    const item = document.createElement('li');
    instruction.split('*').forEach((part, index) => {
     if (index % 2 === 0) {
      part.split('\n').forEach((line, lineIndex) => {
       if (lineIndex) item.append(document.createElement('br'));
       item.append(line);
      });
     }
     else {
      if (showShareIcons && (part === 'three lines' || part === 'square with an up arrow')) {
       const icon = cloneShareIcon(part === 'three lines' ? '.setupMenuIcon' : '.setupShareOption svg');
       icon.removeAttribute('aria-hidden');
       icon.setAttribute('role', 'img');
       icon.setAttribute('aria-label', part);
       item.append(icon);
       return;
      }
      const label = document.createElement('strong');
      label.textContent = part;
      if (part === 'OR') label.classList.add('setupChoiceDivider');
      else if (['Share', 'Add to Home Screen', 'Open as Web App', 'Add', 'Edit Actions',
       'Done', 'Copy Link', 'Paste and Go', 'Enable Alerts', 'Allow',
       'Notifications', 'Allow Notifications'].includes(part)) label.classList.add('setupActionLabel');
      item.append(label);
      if (showShareIcons && part === 'one of these icons') {
       const iconPair = document.createElement('span');
       iconPair.style.whiteSpace = 'nowrap';
       iconPair.append(cloneShareIcon('.setupMenuIcon'), cloneShareIcon('.setupShareOption svg'));
       item.append(' ', iconPair);
      }
     }
    });
    list.append(item);
   }
   target.replaceChildren(list);
  }
  function render(focus = true) {
   const cards = [
    [tester ? 'Jeremy invited you to play BrainChain' : code ? 'You’re invited to play BrainChain' : 'Set Up BrainChain',
     code ? 'Tap Play Now to open your challenge.' : 'Add BrainChain to your Home Screen to open it with one tap and get game alerts.', '', code ? 'Set Up Home Screen App' : 'Start Setup'],
    ['1. Add BrainChain to your iPhone', ['Look at the *bottom of this screen* for *one of these icons*. If the web address is at the top, look there.', 'If you see *three lines*, tap it, then tap *Share*.\n*OR*\nIf you see *square with an up arrow*, tap it.', 'Scroll down and tap *Add to Home Screen*.', 'If you see *Open as Web App*, make sure it’s on.', 'Tap *Add*.'], 'share-options', 'I Added BrainChain'],
    ['2. Add BrainChain', ['Tap *Share*.', 'Scroll down and tap *Add to Home Screen*.', 'If you see *Open as Web App*, make sure it’s on.', 'Tap *Add*.'], 'share', 'Done — Next Step'],
    ['3. Open BrainChain', ['Go to your phone’s *Home Screen*.','Tap the new *BrainChain* icon to continue setup.'], 'logo', 'Continue in This Browser'],
    ['FINAL STEP: Turn on alerts', ['Tap *Enable Alerts*.','When your phone asks, tap *Allow*.'], '', 'Enable Alerts'],
    [code ? '5. Play your first game' : '5. You’re ready', code ? 'Tap Play Now to open your challenge.' : 'You can change your alerts anytime in Profile.', '', 'Done']
   ];
   if (!iphone && step === 1) cards[1] = ['1. Install BrainChain',
    installPrompt ? 'Tap Install BrainChain, then follow the message on your screen.' :
     ['Open your *browser menu*.','Tap *Install app* or *Add to Home screen*.'], '', installPrompt ? 'Install BrainChain' : 'Done — Next Step'];
   if (step === 4 && alertState?.enabled) {
    cards[4][1] = 'Alerts are on. You can send a test alert or finish setup.';
    cards[4][3] = 'Finish Setup';
   }
   const [heading, instructions, icon, label] = cards[step];
   const openFromHome = iphone && !standalone && step === 3;
   if (openFromHome) {
    instructions[0] = 'Go to the screen where you open your other apps.';
    instructions[1] = 'Tap the *BrainChain* icon shown below. Setup continues there.';
   }
   title.textContent = iphone && step >= 3 ? heading.replace(/^\d/, String(step - 1)) : heading;
   const inlineShareIcons = icon === 'share-options';
   renderInstructions(copy, instructions, inlineShareIcons);
   visual.dataset.icon = inlineShareIcons ? '' : icon;
   const playFirst = Boolean(code) && step === 0;
   next.classList.toggle('primary', !playFirst);
   next.classList.toggle('secondary', playFirst);
   skip.classList.toggle('primary', playFirst);
   skip.classList.toggle('secondary', !playFirst);
   if (playFirst) next.before(skip);
   else help.after(skip);
   next.textContent = label;
   next.hidden = openFromHome || (step === 5 && Boolean(code));
   homeButton.hidden = openFromHome;
   help.textContent = openFromHome ? 'I Can’t Find the Icon' : 'I Don’t See It';
   next.disabled = step === 4 && !alertState?.enabled && !alertState?.available;
   sendTest.hidden = step !== 4 || !alertState?.enabled;
   skip.textContent = code ? 'Play Now' : 'Close Setup';
   skip.hidden = (!code && step === 5) || (code && step === 3 && !openFromHome);
   signInButton.hidden = (step !== 0 && step !== 5) || !signIn;
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
   if (opening) return;
   if (!code) { remember(''); dialog.close(); return; }
   opening = true;
   next.disabled = skip.disabled = signInButton.disabled = exitButton.disabled = true;
   status.textContent = 'Opening your challenge…';
   try {
    await play();
    remember('');
    localStorage.setItem('bc_setup_seen', '1');
    dialog.close();
   } catch (error) {
    go(5);
    exitButton.hidden = false;
    status.textContent = error.message || 'Couldn’t open your challenge. Tap Play Now to try again.';
   } finally {
    opening = false;
    skip.disabled = signInButton.disabled = exitButton.disabled = false;
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
   } else if (step === 1) {
    if (!iphone && installPrompt) {
     const prompt = installPrompt;
     installPrompt = null;
     await prompt.prompt().catch(() => {});
    }
    go(3);
   } else if (step === 4 && !alertState?.enabled) {
    next.disabled = true;
    try {
     alertState = await enable();
     status.textContent = alertState.message || '';
    } catch {
     status.textContent = 'Alerts couldn’t turn on. You can try again or play now.';
    } finally {
     if (dialog.open) render(false);
    }
   } else if (step === 5 || (step === 4 && !code)) {
    await finish();
   } else go(step + 1);
  };
  sendTest.onclick = async () => {
   sendTest.disabled = true;
   try { status.textContent = await test(); }
   finally { sendTest.disabled = false; }
  };
  const helpChoices = find('setupHelpChoices'), helpText = find('setupHelpText');
  const copyLink = find('setupCopyLink');
  function showHelp(instructions, showCopy = false) {
   renderInstructions(helpText, instructions);
   copyLink.hidden = !showCopy;
   recovery.hidden = true;
   helpText.focus();
  }
  find('setupFindShare').onclick = () => showHelp([
   'Look at the *bottom of your iPhone screen*, beside the web address.',
   'If you see *three lines*, tap it, then tap *Share*.',
   'Still stuck? Tap *Copy Link*. Then open *Safari* (the blue compass app).',
   'Touch and hold the web address box, then tap *Paste and Go*.'
  ], true);
  find('setupFindAdd').onclick = () => showHelp([
   'In the *Share* menu, scroll all the way down.',
   'Tap *Edit Actions*.',
   'If you see *Add to Home Screen*, tap the plus next to it, then tap *Done*.',
   'In the Share menu, tap *Add to Home Screen*.'
  ]);
  help.onclick = () => {
   detail.hidden = !detail.hidden;
   if (detail.hidden) return;
   helpChoices.hidden = !iphone || step !== 1;
   showHelp(step === 4 ?
    ['Open your phone’s *Settings*.','Tap *Notifications*, then *BrainChain*.','Turn on *Allow Notifications*.'] :
    step === 3 ? ['Swipe down on your iPhone’s *Home Screen*.','Type *BrainChain*.','Tap the *BrainChain* icon when it appears.'] :
    helpChoices.hidden ? 'If your phone doesn’t offer an install button, you can set it up later from Profile.' : '');
   if (!helpChoices.hidden) find('setupFindShare').focus();
  };
  const recovery = find('setupRecovery');
  recovery.hidden = true;
  copyLink.onclick = async () => {
   const url = code ? link(code, tester) : new URL('./online.html#setup', location.href);
   try {
    await navigator.clipboard.writeText(url.href);
    showHelp(['*Link copied.* Open *Safari* (the blue compass app).', 'Touch and hold the web address box.', 'Tap *Paste and Go*.']);
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
