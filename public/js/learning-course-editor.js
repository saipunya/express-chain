for (const section of document.querySelectorAll('[data-editor-section]')) {
  const entries = section.querySelector('[data-editor-items]');
  const add = section.querySelector('[data-editor-add]');
  const template = section.querySelector('template');
  let nextIndex = entries.children.length;

  function updateOrder() {
    add.disabled = entries.children.length >= 20;
    for (const [index, item] of Array.from(entries.children).entries()) {
      const label = item.querySelector('[data-editor-label]');
      label.dataset.baseLabel ||= label.textContent;
      label.textContent = `${label.dataset.baseLabel} ${index + 1}`;
    }
  }

  add.addEventListener('click', () => {
    const item = template.content.cloneNode(true);
    for (const field of item.querySelectorAll('[name]')) {
      field.name = field.name.replace('__INDEX__', String(nextIndex));
    }
    nextIndex += 1;
    entries.append(item);
    updateOrder();
    entries.lastElementChild.querySelector('input').focus();
  });

  entries.addEventListener('click', (event) => {
    const button = event.target.closest('[data-editor-remove]');
    if (!button) return;
    button.closest('[data-editor-item]').remove();
    updateOrder();
    add.focus();
  });
  updateOrder();
}
