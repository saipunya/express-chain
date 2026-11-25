const editor = document.querySelector('.learning-course-editor');
const maxItems = Number(editor.dataset.maxItems);
const submitButtons = editor.querySelectorAll('button[type="submit"]');
let pendingImports = 0;

function updatePendingImports(change) {
  pendingImports += change;
  for (const button of submitButtons) button.disabled = pendingImports > 0;
}

for (const section of editor.querySelectorAll('[data-editor-section]')) {
  const entries = section.querySelector('[data-editor-items]');
  const add = section.querySelector('[data-editor-add]');
  const template = section.querySelector('template');
  let nextIndex = entries.children.length;

  function updateOrder() {
    add.disabled = entries.children.length >= maxItems;
    for (const [index, item] of Array.from(entries.children).entries()) {
      const label = item.querySelector('[data-editor-label]');
      label.dataset.baseLabel ||= label.textContent;
      label.textContent = `${label.dataset.baseLabel} ${index + 1}`;
    }
  }

  function createItem() {
    const item = template.content.cloneNode(true);
    for (const field of item.querySelectorAll('[name]')) {
      field.name = field.name.replace('__INDEX__', String(nextIndex));
    }
    nextIndex += 1;
    return item;
  }

  add.addEventListener('click', () => {
    entries.append(createItem());
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

  const importer = section.querySelector('[data-excel-import]');
  if (!importer) continue;
  const fileInput = importer.querySelector('[data-excel-file]');
  const importButton = importer.querySelector('[data-excel-button]');
  const importStatus = importer.querySelector('[data-excel-status]');

  function showStatus(message, className) {
    importStatus.className = className;
    importStatus.textContent = message;
    importStatus.hidden = false;
  }

  function appendQuestions(questions) {
    const emptyRows = Array.from(entries.children).filter((row) =>
      Array.from(row.querySelectorAll('input, select')).every((field) => !field.value.trim()));
    if (entries.children.length - emptyRows.length + questions.length > maxItems) {
      throw new Error(`แบบทดสอบมีได้สูงสุด ${maxItems} ข้อ กรุณาลดจำนวนคำถามในไฟล์หรือในรายการก่อนนำเข้า`);
    }
    const rows = document.createDocumentFragment();
    for (const question of questions) {
      const item = createItem();
      item.querySelector('[name$="[prompt]"]').value = question.prompt;
      item.querySelector('[name$="[correct]"]').value = question.correct;
      question.choices.forEach((choice, index) => {
        item.querySelector(`[name$="[choices][${index}]"]`).value = choice;
      });
      rows.append(item);
    }
    for (const row of emptyRows) row.remove();
    entries.append(rows);
    updateOrder();
  }

  importButton.addEventListener('click', async () => {
    const [file] = fileInput.files;
    if (!file || !/\.xlsx$/i.test(file.name)) {
      showStatus('กรุณาเลือกไฟล์ Excel นามสกุล .xlsx', 'learning-feedback');
      return;
    }
    importButton.disabled = true;
    fileInput.disabled = true;
    updatePendingImports(1);
    showStatus('กำลังอ่านไฟล์ Excel', 'learning-muted');
    try {
      const response = await fetch('/learning/admin/quizzes/import', {
        method: 'POST',
        headers: {
          'Content-Type': editor.dataset.excelType,
          'X-Learning-CSRF-Token': editor.elements.token.value,
          Accept: 'application/json'
        },
        body: file,
        signal: AbortSignal.timeout(20000)
      });
      if (response.redirected || response.status === 401) throw new Error('กรุณาเข้าสู่ระบบผู้ดูแลอีกครั้ง');
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(result.questions)) throw new Error(result.message || 'อ่านไฟล์ Excel ไม่สำเร็จ');
      appendQuestions(result.questions);
      fileInput.value = '';
      showStatus(`เพิ่มคำถาม ${result.questions.length} ข้อแล้ว ตรวจทานก่อนบันทึกหรือเผยแพร่`, 'learning-success');
    } catch (error) {
      showStatus(error.name === 'TimeoutError' ? 'อ่านไฟล์นานเกินไป กรุณาลองอีกครั้ง' : error.message, 'learning-feedback');
    } finally {
      updatePendingImports(-1);
      importButton.disabled = false;
      fileInput.disabled = false;
    }
  });
}
