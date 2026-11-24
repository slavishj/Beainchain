(() => {
 const form = document.getElementById('guessForm');
 const field = form.querySelector('input');
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
 }
 for (const letters of ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM']) {
  const row = document.createElement('div');
  row.className = 'guessKeyRow';
  for (const key of [...letters, ...(letters === 'ZXCVBNM' ? ['Backspace'] : [])]) {
   const button = document.createElement('button');
   button.type = 'button';
   button.textContent = key === 'Backspace' ? '⌫' : key;
   if (key === 'Backspace') button.setAttribute('aria-label', 'Delete letter');
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
 const syncDisabled = () => { keyboard.disabled = field.disabled; };
 new MutationObserver(syncDisabled).observe(field, {attributes:true, attributeFilter:['disabled']});
 syncDisabled();
 field.addEventListener('keydown', event => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
  if (event.key === 'Enter') {
   event.preventDefault();
   if (!event.repeat) form.requestSubmit();
  } else if (event.key === 'Backspace' || /^[a-z]$/i.test(event.key)) {
   event.preventDefault();
   edit(event.key);
  }
 });
})();
