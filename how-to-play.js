(() => {
 const completedChain = {
  title: 'Completed word chain',
  visual: '<figure><figcaption>Every word is filled in</figcaption><ol class="bcGuideChain"><li><b>FIRE</b></li><li><span>Fire truck</span><b>TRUCK</b></li><li><span>Truck stop</span><b>STOP</b></li><li><span>Stop sign</span><b>SIGN</b></li><li><span>Sign post</span><b>POST</b></li></ol></figure>',
  bullets: ["Read down from <b>FIRE</b> to <b>POST</b>.", "Each word makes a phrase with the word above it."]
 };
 const firstGuess = {
  title: 'Guess the next word',
  bullets: ["Start with <b>FIRE</b>.", "Find a five-letter word that starts with <b>T</b>.", "Put it after <b>FIRE</b> to make a familiar phrase."],
  visual: '<div class="bcGuideClue"><b>FIRE</b><span aria-hidden="true">↓</span><b aria-label="T followed by four blanks">T _ _ _ _</b></div><details><summary>Show answer</summary><ul class="bcGuideBullets"><li>Type <b>TRUCK</b> and tap <b>GUESS</b>.</li><li><b>FIRE + TRUCK</b> makes <b>fire truck</b>.</li></ul></details>'
 };
 const guides = {
  solo: {
   name: 'Solo Play',
   slides: [
    {title:'Start your chain', bullets: ["Tap <b>START CHAIN</b> to see your first clue.", "Take your time. Solo Play has no timer."]},
    firstGuess,
    completedChain,
    {title:'Need another letter?', bullets: ["Tap <b>Hint</b> or make a guess.", "A hint or a wrong guess shows one more letter.", "If the whole word is shown, the game moves to the next word."]},
    {title:'See your score', bullets: ["Earn <b>100 points</b> for finishing without hints or misses.", "Each hint or miss costs 10 points. You’ll earn at least 10 points per chain.", "Tap <b>NEXT CHAIN</b> to keep playing."]}
   ]
  },
  party: {
   name: 'Pass & Play',
   slides: [
    {title:'Set up your teams', bullets: ["Choose your teams.", "Pick <b>Seconds per guess</b> or choose <b>No timer</b>.", "Set <b>First to Win</b> to choose how many rounds a team needs to win.", "Tap <b>START GAME</b>."]},
    {title:'Hand over the phone', bullets: ["Give the phone to the team named on screen.", "Tap <b>START TURN</b> to see the clue.", "Every team gets the same chain and picks up where it left off."]},
    firstGuess,
    completedChain,
    {title:'Keep guessing or pass the phone', bullets: ["Guess right to keep playing.", "A wrong guess, a timeout, or <b>PASS TURN</b> counts as one miss and shows another letter.", "Tap <b>NEXT TEAM</b> and hand over the phone."]},
    {title:'See who won the round', bullets: ["Finish the chain with your team.", "The team with the fewest misses wins the round. Tied teams each get a win.", "Reach the <b>First to Win</b> goal to finish the match."]}
   ]
  },
  online: {
   name: 'Online Play',
   slides: [
    {title:'Invite a friend', bullets: ["In <b>My Games</b>, tap <b>Create a challenge</b>.", "Use <b>Text invitation</b> or <b>Copy invitation link</b> to share the link.", "Your friend opens the link to join."]},
    {title:'Check whose turn it is', bullets: ["In <b>My Games</b>, open your friend’s group.", "Find the match that says <b>Your turn</b> and tap <b>Open game</b>.", "Tap <b>GO!</b> to see your clue."]},
    firstGuess,
    completedChain,
    {title:'Try again or ask for a hint', bullets: ["Each word starts at <b>100 points</b>.", "A wrong guess or <b>Hint</b> shows one letter and costs 20 points.", "If the last letter is shown, your turn ends at 0 points."], visual:'<div class="bcGuideClue"><b>T _ _ _ _ · 100 points</b><span>After one hint or miss</span><b>T R _ _ _ · 80 points</b></div>'},
    {title:'Take turns and check the score', bullets: ["Take turns guessing each missing word.", "After four words each, the higher total wins. Equal scores are a tie.", "Check <b>My Games</b> later to see if it’s your turn."]}
   ]
  }
 };
 const dialog = document.createElement('dialog');
 dialog.className = 'bcGuide';
 dialog.setAttribute('aria-labelledby', 'bcGuideTitle');
 dialog.innerHTML = `
  <header><h2 id="bcGuideTitle">How to Play</h2><button class="secondary" type="button" data-close>Close</button></header>
  <p class="bcGuideStep" aria-live="polite"></p>
  <section class="bcGuideSlide"></section>
  <footer><button class="secondary" type="button" data-back>Back</button><button class="primary" type="button" data-next>Next</button></footer>`;
 document.body.append(dialog);
 const heading = dialog.querySelector('h2');
 const step = dialog.querySelector('.bcGuideStep');
 const slide = dialog.querySelector('.bcGuideSlide');
 const back = dialog.querySelector('[data-back]');
 const next = dialog.querySelector('[data-next]');
 let deck, index, opener, touchStart;

 function show(position) {
  if (position < 0 || position >= deck.slides.length) return;
  index = position;
  const card = deck.slides[index];
  step.textContent = `Step ${index + 1} of ${deck.slides.length}`;
  const items = card.bullets.map(bullet => `<li>${bullet}</li>`).join('');
  slide.innerHTML = `<h3 tabindex="-1">${card.title}</h3><ul class="bcGuideBullets">${items}</ul>${card.visual || ''}`;
  back.disabled = index === 0;
  next.textContent = index === deck.slides.length - 1 ? 'Done' : 'Next';
  dialog.scrollTop = 0;
  slide.querySelector('h3').focus({preventScroll:true});
 }
 dialog.querySelector('[data-close]').onclick = () => dialog.close();
 back.onclick = () => show(index - 1);
 next.onclick = () => index === deck.slides.length - 1 ? dialog.close() : show(index + 1);
 dialog.addEventListener('close', () => opener?.focus({preventScroll:true}));
 dialog.addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  show(index + (event.key === 'ArrowRight' ? 1 : -1));
 });
 slide.addEventListener('touchstart', event => { touchStart = event.touches.length === 1 ? event.touches[0] : null; }, {passive:true});
 slide.addEventListener('touchcancel', () => { touchStart = null; });
 slide.addEventListener('touchend', event => {
  if (!touchStart) return;
  const dx = event.changedTouches[0].clientX - touchStart.clientX;
  const dy = event.changedTouches[0].clientY - touchStart.clientY;
  touchStart = null;
  if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) show(index + (dx < 0 ? 1 : -1));
 }, {passive:true});
 window.brainChainGuide = {
  open(mode, returnFocus) {
   deck = guides[mode];
   opener = returnFocus;
   heading.textContent = 'How to Play · ' + deck.name;
   dialog.showModal();
   show(0);
  },
  onClose(handler, options) { dialog.addEventListener('close', handler, options); }
 };
})();
