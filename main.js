const { app, BrowserWindow, ipcMain, Tray, Menu, screen, dialog } = require('electron')
const path = require('path')
const { execFile, exec } = require('child_process')
const db = require('./db')
const translations = require('./translations')

let mainWindow
let tray = null

function createWindow () {
  // Получаем размеры экрана
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workArea;
  const winWidth = 450;
  const winHeight = 700;
  const x = screenWidth - winWidth;
  const y = screenHeight - winHeight;

  mainWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: x,
    y: y,
    resizable: false,
    movable: false, // Запрещаем перемещение
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'render.js'),
      nodeIntegration: true,
      contextIsolation: false
    }
  })
  mainWindow.removeMenu()
  mainWindow.loadFile('index.html')

  // При попытке закрыть окно — просто скрываем его
  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });
}

function getAppLang() {
  // Пробуем определить язык системы (ru, uk, en)
  const locale = app.getLocale ? app.getLocale() : 'en';
  if (locale.startsWith('ru')) return 'ru';
  if (locale.startsWith('uk')) return 'uk';
  return 'en';
}

app.whenReady().then(() => {
  createWindow();

  // Локализация для трея
  const lang = getAppLang();
  const t = translations[lang];

  // Создаём Tray
  tray = new Tray(path.join(__dirname, 'icon.ico'));
  const contextMenu = Menu.buildFromTemplate([
    {
      label: t.trayShowHide,
      click: () => {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: t.trayExit,
      click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);
  tray.setToolTip(t.title || 'IDE Toolbox');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

app.on('window-all-closed', (e) => {
  // Не закрываем приложение при закрытии всех окон
  e.preventDefault();
});

db.initDB()

ipcMain.handle('get-programs', (event) => {
  return new Promise((resolve, reject) => {
    db.getPrograms((err, rows) => {
      if (err) reject(err)
      else resolve(rows)
    })
  })
})

ipcMain.handle('add-program', (event, name, exe_path) => {
  return new Promise((resolve, reject) => {
    db.addProgram(name, exe_path, function(err) {
      if (err) reject(err)
      else resolve(this.lastID)
    })
  })
})

ipcMain.handle('get-projects', (event) => {
  return new Promise((resolve, reject) => {
    db.getProjects((err, rows) => {
      if (err) reject(err)
      else resolve(rows)
    })
  })
})

ipcMain.handle('add-project', (event, name, folder_path) => {
  return new Promise((resolve, reject) => {
    db.addProject(name, folder_path, function(err) {
      if (err) reject(err)
      else resolve(this.lastID)
    })
  })
})

ipcMain.handle('edit-program', (event, id, name, exe_path) => {
  return new Promise((resolve, reject) => {
    db.db.run('UPDATE programs SET name = ?, exe_path = ? WHERE id = ?', [name, exe_path, id], function(err) {
      if (err) reject(err); else resolve(true)
    })
  })
})

ipcMain.handle('edit-project', (event, id, name, folder_path) => {
  return new Promise((resolve, reject) => {
    db.db.run('UPDATE projects SET name = ?, folder_path = ? WHERE id = ?', [name, folder_path, id], function(err) {
      if (err) reject(err); else resolve(true)
    })
  })
})

ipcMain.handle('delete-program', (event, id) => {
  return new Promise((resolve, reject) => {
    db.db.run('DELETE FROM programs WHERE id = ?', [id], function(err) {
      if (err) reject(err); else resolve(true)
    })
  })
})

ipcMain.handle('delete-project', (event, id) => {
  return new Promise((resolve, reject) => {
    db.db.run('DELETE FROM projects WHERE id = ?', [id], function(err) {
      if (err) reject(err); else resolve(true)
    })
  })
})

ipcMain.handle('open-folder', async (event, programPath, folderPath) => {
  try {
    execFile(programPath, [folderPath], (error) => {
      if (error) throw error;
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

ipcMain.handle('get-installed-programs', async () => {
  return new Promise((resolve) => {
    // Запросим оба раздела реестра (x64 и x86)
    const regPaths = [
      'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
      'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
      'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall'
    ];
    let results = [];
    let pending = regPaths.length;
    regPaths.forEach((regPath) => {
      exec(`reg query "${regPath}" /s`, { encoding: 'utf8' }, (err, stdout) => {
        if (!err && stdout) {
          const blocks = stdout.split(/\r?\n\r?\n/);
          blocks.forEach(block => {
            const displayName = /DisplayName\s+REG_SZ\s+(.+)/.exec(block);
            const exePath = /DisplayIcon\s+REG_SZ\s+(.+\.exe)/.exec(block);
            if (displayName && exePath) {
              results.push({ name: displayName[1], exe: exePath[1] });
            }
          });
        }
        if (--pending === 0) resolve(results);
      });
    });
  });
});