(() => {
 const form = document.getElementById('guessForm');
 const field = form.querySelector('input');
 const entry = document.createElement('div');
 entry.className = 'guessEntry';
 field.before(entry);
 entry.append(field);
 const caret = document.createElement('span');
 caret.className = 'guessCaret';
 caret.setAttribute('aria-hidden', 'true');
 entry.append(caret);
 const measure = document.createElement('canvas').getContext('2d');

 function textWidth(text) {
  const style = getComputedStyle(field);
  measure.font = [style.fontWeight, style.fontSize, style.fontFamily].join(' ');
  return measure.measureText(text).width;
 }
 function drawCaret() {
  const style = getComputedStyle(field);
  const inset = parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft);
  const position = field.selectionStart;
  const offset = inset + textWidth(field.value.slice(0, position)) - field.scrollLeft;
  caret.style.left = Math.max(inset, Math.min(offset, field.clientWidth - inset)) + 'px';
 }
 field.addEventListener('click', event => {
  field.focus({preventScroll:true});
  const style = getComputedStyle(field);
  const x = event.clientX - field.getBoundingClientRect().left
   - parseFloat(style.borderLeftWidth) - parseFloat(style.paddingLeft) + field.scrollLeft;
  let position = 0;
  while (position < field.value.length &&
    x > (textWidth(field.value.slice(0, position)) + textWidth(field.value.slice(0, position + 1))) / 2) {
   position++;
  }
  field.setSelectionRange(position, position);
  drawCaret();
 });
 for (const event of ['focus', 'keyup', 'select', 'scroll']) field.addEventListener(event, drawCaret);
 const keyboard = document.createElement('fieldset');
 keyboard.className = 'guessKeyboard';
 keyboard.setAttribute('aria-label', 'BrainChain letter keyboard');

 function edit(key) {
  if (field.disabled) return;
  const start = field.selectionStart;
  const end = field.selectionEnd;
  if (key === 'Backspace') {
   field.setRangeText('', start === end ? Math.max(0, start - 1) : start, end, 'end');
  } else {
   field.setRangeText(key.toUpperCase(), start, end, 'end');
  }
  drawCaret();
 }
 for (const letters of ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM']) {
  const row = document.createElement('div');
  row.className = 'guessKeyRow';
  for (const key of [...letters, ...(letters === 'ZXCVBNM' ? ['Backspace'] : [])]) {
   const button = document.createElement('button');
   button.type = 'button';
   button.textContent = key === 'Backspace' ? '⌫' : key;
   if (key === 'Backspace') button.setAttribute('aria-label', 'Delete letter');
   button.addEventListener('pointerdown', event => {
    if (document.activeElement === field) event.preventDefault();
   });
   button.addEventListener('click', () => {
    // Letter buttons append to the guess, even when the field has never been focused.
    if (document.activeElement !== field) field.setSelectionRange(field.value.length, field.value.length);
    edit(key);
   });
   row.append(button);
  }
  keyboard.append(row);
 }
 form.after(keyboard);
 form.addEventListener('submit', () => requestAnimationFrame(drawCaret));
 const syncDisabled = () => { keyboard.disabled = field.disabled; };
 new MutationObserver(syncDisabled).observe(field, {attributes:true, attributeFilter:['disabled']});
 syncDisabled();
 field.addEventListener('keydown', event => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
  if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
   event.preventDefault();
   const position = {
    ArrowLeft: Math.max(0, field.selectionStart - 1),
    ArrowRight: Math.min(field.value.length, field.selectionEnd + 1),
    Home: 0,
    End: field.value.length
   }[event.key];
   field.setSelectionRange(position, position);
   drawCaret();
  } else if (event.key === 'Enter') {
   event.preventDefault();
   if (!event.repeat) {
    form.requestSubmit();
    drawCaret();
   }
  } else if (event.key === 'Backspace' || /^[a-z]$/i.test(event.key)) {
   event.preventDefault();
   edit(event.key);
  }
 });
})();
