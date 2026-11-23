function renderBrainEmoji(host, text) {
  const parts = text.split('🧠');
  host.replaceChildren(parts[0]);
  for (const part of parts.slice(1)) {
    const emoji = document.createElement('span');
    emoji.className = 'brainEmoji';
    emoji.textContent = '🧠';
    host.append(emoji, part);
  }
}
