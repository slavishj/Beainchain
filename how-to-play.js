(() => {
 const completedChain = {
  title: 'Completed word chain',
  visual: '<figure><figcaption>Every word is filled in</figcaption><ol class="bcGuideChain"><li><b>FIRE</b></li><li><span>Fire truck</span><b>TRUCK</b></li><li><span>Truck stop</span><b>STOP</b></li><li><span>Stop sign</span><b>SIGN</b></li><li><span>Sign post</span><b>POST</b></li></ol></figure>',
  text: 'Read from top to bottom. Each word makes a familiar pair with the word right above it.'
 };
 const firstGuess = {
  title: 'Guess the next word',
  text: 'Look at <b>FIRE</b>. What word starts with <b>T</b>, fills all five spaces, and goes after FIRE?',
  visual: '<div class="bcGuideClue"><b>FIRE</b><span aria-hidden="true">↓</span><b aria-label="T followed by four blanks">T _ _ _ _</b></div><details><summary>Show answer</summary><p>Type <b>TRUCK</b> and tap <b>GUESS</b>. FIRE + TRUCK makes <b>fire truck</b>.</p></details>'
 };
 const guides = {
  solo: {
   name: 'Solo Play',
   slides: [
    {title:'Start your chain', text:'Tap <b>START CHAIN</b> to see the first word and clue. Take your time. There’s no timer in Solo Play.'},
    firstGuess,
    completedChain,
    {title:'Need another letter?', text:'Tap <b>Hint</b> or try a guess. A hint or a wrong guess shows one more letter. If the whole word is shown, the game moves on for you.'},
    {title:'See your score', text:'A finished chain is worth <b>100 points</b> with no misses or hints. Each miss or hint takes off 10 points, down to 10 points for the chain. Tap <b>NEXT CHAIN</b> to keep playing.'}
   ]
  },
  party: {
   name: 'Pass & Play',
   slides: [
    {title:'Set up your teams', text:'Choose your teams. Pick <b>Seconds per guess</b> or choose <b>No timer</b>. Set <b>First to Win</b>, then tap <b>START GAME</b>.'},
    {title:'Hand over the phone', text:'Give the phone to the team named on screen. That team taps <b>START TURN</b> to see its clue. Each team works on the same chain and picks up where it left off.'},
    firstGuess,
    completedChain,
    {title:'Keep guessing or pass the phone', text:'Get it right and your team keeps playing. A wrong guess, running out of time, or tapping <b>PASS TURN</b> counts as one miss and shows another letter. Tap <b>NEXT TEAM</b> and hand over the phone.'},
    {title:'See who won the round', text:'Everyone finishes their chain. The team with the fewest misses wins the round. If teams tie for fewest misses, they each get a round win. Reach your <b>First to Win</b> goal to finish the match.'}
   ]
  },
  online: {
   name: 'Online Play',
   slides: [
    {title:'Invite a friend', text:'In <b>My Games</b>, tap <b>Create a challenge</b>. Tap <b>Text invitation</b> or <b>Copy invitation link</b> and send the link to your friend. They open the link to join.'},
    {title:'Check whose turn it is', text:'In <b>My Games</b>, open your friend’s group and look for <b>Your turn</b>. Tap <b>Open game</b>, then <b>GO!</b> to see your clue.'},
    firstGuess,
    completedChain,
    {title:'Try again or ask for a hint', text:'Each word starts at <b>100 points</b>. A wrong guess or <b>Hint</b> shows one more letter and takes off 20 points, down to zero. If the last letter is shown, your turn on that word ends at zero.', visual:'<div class="bcGuideClue"><b>T _ _ _ _ · 100 points</b><span>After one hint or miss</span><b>T R _ _ _ · 80 points</b></div>'},
    {title:'Take turns and check the score', text:'You both get a turn on each missing word. After four words each, the higher total wins. Matching scores mean a tie. Check <b>My Games</b> later to see if it’s your turn again.'}
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
  slide.innerHTML = `<h3 tabindex="-1">${card.title}</h3><p>${card.text}</p>${card.visual || ''}`;
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
