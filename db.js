const sqlite3 = require('sqlite3').verbose();
const path = require('path');
let dbPath;

try {
  // Для Electron main process
  const { app } = require('electron');
  dbPath = path.join(app.getPath('userData'), 'appdata.sqlite');
} catch (e) {
  // Для обычного node запуска (dev)
  dbPath = path.resolve(__dirname, 'appdata.sqlite');
}

const db = new sqlite3.Database(dbPath);

// Создание таблиц, если их нет
function initDB() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS programs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      exe_path TEXT NOT NULL
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      folder_path TEXT NOT NULL
    )`);
  });
}

// Добавить программу
function addProgram(name, exe_path, cb) {
  db.run('INSERT INTO programs (name, exe_path) VALUES (?, ?)', [name, exe_path], cb);
}

// Получить все программы
function getPrograms(cb) {
  db.all('SELECT * FROM programs', cb);
}

// Добавить проект
function addProject(name, folder_path, cb) {
  db.run('INSERT INTO projects (name, folder_path) VALUES (?, ?)', [name, folder_path], cb);
}

// Получить все проекты
function getProjects(cb) {
  db.all('SELECT * FROM projects', cb);
}

module.exports = {
  initDB,
  addProgram,
  getPrograms,
  addProject,
  getProjects,
  db
};
