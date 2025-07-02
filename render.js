const { ipcRenderer } = require('electron')
const translations = require('./translations')

let programs = []
let projects = []

let currentLang = localStorage.getItem('lang') || 'en'
function t(key) {
  return translations[currentLang][key] || key
}

function getAvatarColor(str) {
  // Цвета в стиле JetBrains Toolbox
  const palette = [
    '#3b82f6', '#22c55e', '#f59e42', '#e11d48', '#a855f7', '#facc15', '#14b8a6', '#ef4444', '#6366f1', '#f472b6'
  ]
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return palette[Math.abs(hash) % palette.length]
}

function getInitials(name) {
  return name
    .split(/\s|_|-/)
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function showModal(html, onOk, isDelete = false) {
  const modalBg = document.getElementById('modalBg')
  const modal = document.getElementById('modal')
  modal.innerHTML = html
  modalBg.style.display = 'flex'
  setTimeout(() => {
    const okBtn = modal.querySelector('.okBtn')
    const cancelBtn = modal.querySelector('.cancelBtn')
    if (okBtn) okBtn.onclick = async () => {
      modalBg.style.display = 'none'
      if (onOk) await onOk()
    }
    if (cancelBtn) cancelBtn.onclick = () => {
      modalBg.style.display = 'none'
    }
    const firstInput = modal.querySelector('input')
    if (firstInput) firstInput.focus()
    updateTexts()
  }, 0)
}

async function loadPrograms() {
  programs = await ipcRenderer.invoke('get-programs')
  const select = document.getElementById('programs')
  select.innerHTML = ''
  programs.forEach(p => {
    const opt = document.createElement('option')
    opt.value = p.id
    opt.textContent = p.name
    select.appendChild(opt)
  })
}

async function loadProjects() {
  projects = await ipcRenderer.invoke('get-projects')
  const list = document.getElementById('projectsList')
  list.innerHTML = ''
  projects.forEach(p => {
    const card = document.createElement('div')
    card.className = 'project-card'
    const avatar = document.createElement('div')
    avatar.className = 'project-avatar'
    avatar.style.background = getAvatarColor(p.name)
    avatar.textContent = getInitials(p.name)
    const info = document.createElement('div')
    info.className = 'project-info'
    const title = document.createElement('div')
    title.className = 'project-title'
    title.textContent = p.name
    const path = document.createElement('div')
    path.className = 'project-path'
    path.textContent = p.folder_path
    info.appendChild(title)
    info.appendChild(path)
    const actions = document.createElement('div')
    actions.className = 'project-actions'
    const editBtn = document.createElement('button')
    editBtn.className = 'editBtn actionBtn'
    editBtn.title = t('editProject')
    editBtn.innerHTML = ` <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M4 13.5V16h2.5l7.06-7.06a1 1 0 0 0 0-1.41l-2.09-2.09a1 1 0 0 0-1.41 0L4 13.5zm9.71-6.29a2 2 0 0 1 0 2.83l-1.09 1.09-2.09-2.09 1.09-1.09a2 2 0 0 1 2.83 0z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    editBtn.onclick = (e) => {
      e.stopPropagation();
      showModal(`
        <h3>${t('editProjectTitle')}</h3>
        <input id="projName" type="text" placeholder="${t('name')}" value="${p.name}">
        <input id="projFolder" type="text" placeholder="${t('folderPath')}" value="${p.folder_path}">
        <button class="okBtn">${t('ok')}</button>
        <button class="cancelBtn">${t('cancel')}</button>
      `, async () => {
        const name = document.getElementById('projName').value.trim()
        const folder = document.getElementById('projFolder').value.trim()
        if (!name || !folder) {
          alert(t('fillAll'))
          return
        }
        await ipcRenderer.invoke('edit-project', p.id, name, folder)
        await loadProjects()
      })
    }
    const deleteBtn = document.createElement('button')
    deleteBtn.className = 'deleteBtn actionBtn'
    deleteBtn.title = t('deleteProject')
    deleteBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M6 8v6a2 2 0 002 2h4a2 2 0 002-2V8M9 11v2m2-2v2M4 6h12M9 4h2a2 2 0 012 2v0a2 2 0 01-2 2H9a2 2 0 01-2-2v0a2 2 0 012-2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    deleteBtn.onclick = async (e) => {
      e.stopPropagation();
      showModal(`
        <h3>${t('deleteProject')}</h3>
        <div class="delete-modal-content">${t('deleteProjectConfirm')}</div>
        <div class="modal-actions">
          <button class="okBtn deleteModalBtn">${t('ok')}</button>
          <button class="cancelBtn">${t('cancel')}</button>
        </div>
      `, async () => {
        await ipcRenderer.invoke('delete-project', p.id)
        await loadProjects()
      }, true)
    }
    actions.appendChild(editBtn)
    actions.appendChild(deleteBtn)
    card.appendChild(avatar)
    card.appendChild(info)
    card.appendChild(actions)
    card.onclick = async () => {
      const progSel = document.getElementById('programs')
      if (!progSel.value) return alert(t('selectProgram'))
      const prog = programs.find(x => x.id == progSel.value)
      try {
        await ipcRenderer.invoke('open-folder', prog.exe_path, p.folder_path)
      } catch (e) {
        alert(t('openError') + e)
      }
    }
    list.appendChild(card)
  })
}

// --- Window size persistence ---
function getSavedWindowSize() {
  try {
    const w = parseInt(localStorage.getItem('windowWidth'))
    const h = parseInt(localStorage.getItem('windowHeight'))
    if (w && h) return { width: w, height: h }
  } catch {}
  return null
}
function setSavedWindowSize(width, height) {
  localStorage.setItem('windowWidth', width)
  localStorage.setItem('windowHeight', height)
}

window.addEventListener('DOMContentLoaded', () => {
  loadPrograms()
  loadProjects()

  document.getElementById('addProgramBtn').onclick = showAddProgramModal

  document.getElementById('editProgramBtn').onclick = () => {
    const progSel = document.getElementById('programs')
    if (!progSel.value) return alert(t('selectProgram'))
    const prog = programs.find(x => x.id == progSel.value)
    showModal(`
      <h3>${t('editProgramTitle')}</h3>
      <input id=\"progName\" type=\"text\" placeholder=\"${t('name')}\" value=\"${prog.name}\">
      <input id=\"progExe\" type=\"text\" placeholder=\"${t('exePath')}\" value=\"${prog.exe_path}\">
      <button class=\"okBtn\">${t('ok')}</button>
      <button class=\"cancelBtn\">${t('cancel')}</button>
    `, async () => {
      const name = document.getElementById('progName').value.trim()
      const exe = document.getElementById('progExe').value.trim()
      if (!name || !exe) {
        alert(t('fillAll'))
        return
      }
      await ipcRenderer.invoke('edit-program', prog.id, name, exe)
      await loadPrograms()
    })
  }

  document.getElementById('addProjectBtn').onclick = () => {
    showAddProjectModal()
  }

  document.getElementById('deleteProgramBtn').onclick = async () => {
    const progSel = document.getElementById('programs')
    if (!progSel.value) return alert(t('selectProgram'))
    showModal(`
      <h3>${t('deleteProgram')}</h3>
      <div class="delete-modal-content">${t('deleteProgramConfirm')}</div>
      <div class="modal-actions">
        <button class="okBtn deleteModalBtn">${t('ok')}</button>
        <button class="cancelBtn">${t('cancel')}</button>
      </div>
    `, async () => {
      await ipcRenderer.invoke('delete-program', progSel.value)
      await loadPrograms()
      await loadProjects()
    }, true)
  }

  const langSelect = document.getElementById('langSelect')
  langSelect.value = currentLang
  langSelect.onchange = () => {
    currentLang = langSelect.value
    localStorage.setItem('lang', currentLang)
    updateTexts()
    loadProjects()
    loadPrograms()
  }
  updateTexts()
})

function updateTexts() {
  // Header
  document.querySelector('.title').textContent = t('title')
  // Program select label (aria)
  document.getElementById('programs').setAttribute('aria-label', t('programList'))
  document.getElementById('addProgramBtn').setAttribute('title', t('addProgram'))
  document.getElementById('editProgramBtn').setAttribute('title', t('editProgram'))
  document.getElementById('deleteProgramBtn').setAttribute('title', t('deleteProgram'))
  document.getElementById('openWithLabel').textContent = t('openWith')
  // Projects bar
  document.querySelector('.projects-title').textContent = t('projectsTitle')
  document.getElementById('addProjectBtn').setAttribute('title', t('addProject'))
  // Modal (if open)
  const modal = document.getElementById('modal')
  if (modal && modal.childElementCount) {
    const h3 = modal.querySelector('h3')
    if (h3) {
      if (h3.textContent.includes('Добавить проект') || h3.textContent.includes('Add Project') || h3.textContent.includes('Додати проєкт')) h3.textContent = t('addProjectTitle')
      if (h3.textContent.includes('Редактировать проект') || h3.textContent.includes('Edit Project') || h3.textContent.includes('Редагувати проєкт')) h3.textContent = t('editProjectTitle')
      if (h3.textContent.includes('Добавить программу') || h3.textContent.includes('Add Program') || h3.textContent.includes('Додати програму')) h3.textContent = t('addProgramTitle')
      if (h3.textContent.includes('Редактировать программу') || h3.textContent.includes('Edit Program') || h3.textContent.includes('Редагувати програму')) h3.textContent = t('editProgramTitle')
      if (h3.textContent.includes('Удалить проект') || h3.textContent.includes('Delete project') || h3.textContent.includes('Видалити проєкт')) h3.textContent = t('deleteProject')
      if (h3.textContent.includes('Удалить программу') || h3.textContent.includes('Delete program') || h3.textContent.includes('Видалити програму')) h3.textContent = t('deleteProgram')
    }
    const inputs = modal.querySelectorAll('input')
    if (inputs.length) {
      if (inputs[0]) inputs[0].setAttribute('placeholder', t('name'))
      if (inputs[1]) {
        if (inputs[1].id === 'progExe') inputs[1].setAttribute('placeholder', t('exePath'))
        if (inputs[1].id === 'projFolder') inputs[1].setAttribute('placeholder', t('folderPath'))
      }
    }
    const okBtn = modal.querySelector('.okBtn')
    if (okBtn) okBtn.textContent = t('ok')
    const cancelBtn = modal.querySelector('.cancelBtn')
    if (cancelBtn) cancelBtn.textContent = t('cancel')
  }
}

function showAddProjectModal() {
  showModal(`
    <h3>${t('addProjectTitle')}</h3>
    <input id="projName" type="text" placeholder="${t('name')}">
    <div class="input-folder-row">
      <input id="projFolder" type="text" placeholder="${t('folderPath')}">
      <button id="selectFolderBtn" title="${t('folderPath')}" class="outline-blue-btn">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h3.17a2 2 0 0 1 1.41.59l1.83 1.83H19a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M8 21h8"/></svg>
      </button>
    </div>
    <button class="okBtn">${t('ok')}</button>
    <button class="cancelBtn">${t('cancel')}</button>
  `, async () => {
    const name = document.getElementById('projName').value.trim()
    const folder = document.getElementById('projFolder').value.trim()
    if (!name || !folder) {
      alert(t('fillAll'))
      return
    }
    await ipcRenderer.invoke('add-project', name, folder)
    await loadProjects()
  })
  document.getElementById('selectFolderBtn').onclick = async (e) => {
    e.preventDefault();
    const folder = await ipcRenderer.invoke('select-folder');
    if (folder) document.getElementById('projFolder').value = folder;
  }
}

async function showInstalledProgramsDialog() {
  const installed = await ipcRenderer.invoke('get-installed-programs');
  const added = await ipcRenderer.invoke('get-programs');
  // Список путей уже добавленных программ (нормализуем для сравнения)
  const addedExe = added.map(p => (p.exe_path || '').replace(/\\/g, '/').toLowerCase().trim());
  // Оставляем только те, которых нет в базе
  const programs = installed.filter(p => !addedExe.includes((p.exe || '').replace(/\\/g, '/').toLowerCase().trim()));
  if (!programs.length) {
    alert('Нет новых программ для добавления');
    return;
  }
  let html = `<h3>Выберите программу</h3><input id='programSearch' type='text' placeholder='Поиск...' style='width:100%;margin-bottom:10px;'>`;
  html += `<div id='programList' style='max-height:320px;min-height:120px;overflow:auto;'>`;
  html += programs.map((p) => `<div class='program-list-item' data-exe="${p.exe.replace(/"/g, '&quot;')}" data-name="${p.name.replace(/"/g, '&quot;')}">${p.name}</div>`).join('');
  html += '</div><button class="cancelBtn">Отмена</button>';
  showModal(html, null);
  const list = document.getElementById('programList');
  const search = document.getElementById('programSearch');
  function renderList(filter = '') {
    const items = programs.filter(p => p.name.toLowerCase().includes(filter));
    list.innerHTML = items.map((p) => `<div class='program-list-item' data-exe="${p.exe.replace(/"/g, '&quot;')}" data-name="${p.name.replace(/"/g, '&quot;')}">${p.name}</div>`).join('');
    list.querySelectorAll('.program-list-item').forEach(el => {
      el.onclick = async () => {
        // Добавляем выбранную программу сразу
        await ipcRenderer.invoke('add-program', el.getAttribute('data-name'), el.getAttribute('data-exe'));
        await loadPrograms();
        document.getElementById('modalBg').style.display = 'none';
      };
    });
  }
  renderList();
  search.oninput = () => {
    renderList(search.value.toLowerCase());
  };
}

function showAddProgramModal() {
  showModal(`
    <h3>${t('addProgramTitle')}</h3>
    <input id="progName" type="text" placeholder="${t('name')}">
    <div class="input-exe-row">
      <input id="progExe" type="text" placeholder="${t('exePath')}">
      <button id="selectExeBtn" class="outline-blue-btn" title="Выбрать программу">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17v-7a2 2 0 0 1 2-2h3.17a2 2 0 0 1 1.41.59l1.83 1.83H19a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><path d="M8 21h8"/></svg>
      </button>
    </div>
    <button class="okBtn">${t('ok')}</button>
    <button class="cancelBtn">${t('cancel')}</button>
  `, async () => {
    const name = document.getElementById('progName').value.trim()
    const exe = document.getElementById('progExe').value.trim()
    if (!name || !exe) {
      alert(t('fillAll'))
      return
    }
    await ipcRenderer.invoke('add-program', name, exe)
    await loadPrograms()
  })
  document.getElementById('selectExeBtn').onclick = async (e) => {
    e.preventDefault();
    showInstalledProgramsDialog();
  }
}
