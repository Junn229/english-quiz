// build_quiz.js - 从 historical_questions.json 生成答题页面
// 排除2023年，输出 self-contained HTML

const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'historical_questions.json'), 'utf-8'));

// Normalize options: convert object {A: "...", B: "..."} to array [{label: "A", text: "..."}, ...]
function normalizeOptions(options) {
  if (!options) return [];
  if (Array.isArray(options)) return options;
  return Object.entries(options).map(([label, text]) => ({ label, text }));
}

// Normalize question
function normalizeQuestion(q) {
  return {
    id: q.id,
    question: q.question || '',
    options: normalizeOptions(q.options),
    answer: q.answer || null,
    analysis: q.analysis || ''
  };
}

// Normalize data: ensure consistent format
const normalized = data.map(entry => {
  const sections = {};
  for (const [key, sec] of Object.entries(entry.sections)) {
    const normalized = { title: sec.title || key };
    
    if (sec.questions && sec.questions.length > 0) {
      normalized.type = 'choice';
      normalized.questions = sec.questions.map(normalizeQuestion);
    }
    
    if (sec.passages && sec.passages.length > 0) {
      normalized.type = key === 'reading' ? 'reading' : key === 'cloze' ? 'cloze' : 'passage';
      normalized.passages = sec.passages.map(p => ({
        passage: p.passage || '',
        qStart: p.qStart,
        qEnd: p.qEnd,
        questions: (p.questions || []).map(normalizeQuestion),
        blanks: (p.blanks || []).map(b => ({
          id: b.id,
          options: normalizeOptions(b.options),
          answer: b.answer || null
        }))
      }));
    }
    
    sections[key] = normalized;
  }
  
  return {
    title: entry.title,
    year: entry.year,
    source: entry.source || '',
    sections
  };
});

// Stats
let totalQ = 0, totalA = 0;
for (const entry of normalized) {
  for (const sec of Object.values(entry.sections)) {
    if (sec.questions) { totalQ += sec.questions.length; totalA += sec.questions.filter(q => q.answer).length; }
    if (sec.passages) {
      for (const p of sec.passages) {
        if (p.questions) { totalQ += p.questions.length; totalA += p.questions.filter(q => q.answer).length; }
        if (p.blanks) { totalQ += p.blanks.length; totalA += p.blanks.filter(b => b.answer).length; }
      }
    }
  }
}
console.log(`Papers: ${normalized.length} | Questions: ${totalQ} | Answered: ${totalA} (${(totalA/totalQ*100).toFixed(1)}%)`);

// Generate HTML
const dataJSON = JSON.stringify(normalized);

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>中石油职称英语 - 历年真题题库</title>
<style>
:root {
  --bg: #f1f5f9;
  --card: #ffffff;
  --text: #0f172a;
  --text-secondary: #64748b;
  --border: #e2e8f0;
  --primary: #1d4ed8;
  --primary-light: #dbeafe;
  --primary-dark: #1e40af;
  --success: #059669;
  --success-light: #d1fae5;
  --error: #dc2626;
  --error-light: #fee2e2;
  --warning: #d97706;
  --warning-light: #fef3c7;
  --sidebar-bg: #0f172a;
  --sidebar-text: #94a3b8;
  --sidebar-hover: #1e293b;
  --sidebar-active: #1d4ed8;
  --radius: 10px;
  --shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.08);
  --transition: 0.15s ease;
}
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
html { font-size: 16px; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
  min-height: 100vh;
}
.app { display: flex; min-height: 100vh; }

/* Sidebar */
.sidebar {
  width: 250px;
  background: var(--sidebar-bg);
  color: var(--sidebar-text);
  padding: 16px 0;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
}
.sidebar::-webkit-scrollbar { width: 4px; }
.sidebar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
.sidebar-header {
  padding: 0 16px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  margin-bottom: 12px;
}
.sidebar-header h1 { font-size: 16px; font-weight: 700; color: #fff; margin-bottom: 2px; }
.sidebar-header p { font-size: 11px; color: #64748b; }
.year-selector {
  padding: 0 12px;
  margin-bottom: 12px;
}
.year-selector select {
  width: 100%;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.06);
  color: #e2e8f0;
  font-size: 13px;
  cursor: pointer;
  outline: none;
  font-family: inherit;
}
.year-selector select:focus { border-color: var(--sidebar-active); }
.year-selector select option { background: #1e293b; color: #e2e8f0; }

.section-tabs { padding: 0 8px; }
.section-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: var(--transition);
  font-size: 13px;
  margin-bottom: 1px;
  color: var(--sidebar-text);
  text-decoration: none;
  user-select: none;
}
.section-tab:hover { background: var(--sidebar-hover); color: #e2e8f0; }
.section-tab.active { background: var(--sidebar-active); color: #fff; }
.section-tab .icon { font-size: 15px; width: 20px; text-align: center; flex-shrink: 0; }
.section-tab .count {
  margin-left: auto;
  font-size: 11px;
  background: rgba(255,255,255,0.1);
  padding: 1px 7px;
  border-radius: 8px;
  font-weight: 500;
}
.section-tab.active .count { background: rgba(255,255,255,0.2); }

/* Main Content */
.main {
  flex: 1;
  padding: 28px 32px;
  max-width: 860px;
  margin: 0 auto;
  width: 100%;
}
.header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  gap: 12px;
}
.header-row h2 { font-size: 20px; font-weight: 700; color: var(--text); }
.year-badge {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 16px;
  background: var(--primary-light);
  color: var(--primary);
  font-weight: 600;
  white-space: nowrap;
}

/* Progress */
.progress-section { margin-bottom: 24px; }
.progress-bar {
  height: 4px;
  background: var(--border);
  border-radius: 2px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: var(--primary);
  border-radius: 2px;
  transition: width 0.3s ease;
}
.progress-info {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 6px;
  font-weight: 500;
}

/* Question Card */
.card {
  background: var(--card);
  border-radius: var(--radius);
  padding: 28px;
  box-shadow: var(--shadow);
  margin-bottom: 16px;
}
.q-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 7px;
  background: var(--primary-light);
  color: var(--primary);
  font-weight: 700;
  font-size: 13px;
  margin-bottom: 14px;
}
.q-text {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 20px;
  line-height: 1.7;
  color: var(--text);
}
.q-text .blank {
  display: inline-block;
  min-width: 80px;
  border-bottom: 2px dashed var(--primary);
  margin: 0 4px;
}

/* Options */
.options { display: flex; flex-direction: column; gap: 8px; }
.option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border: 1.5px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
  transition: var(--transition);
  font-size: 14px;
  user-select: none;
}
.option:hover:not(.disabled) { border-color: var(--primary); background: var(--primary-light); }
.option.selected { border-color: var(--primary); background: var(--primary-light); }
.option.correct { border-color: var(--success); background: var(--success-light); }
.option.wrong { border-color: var(--error); background: var(--error-light); }
.option.correct-answer { border-color: var(--success); background: var(--success-light); }
.option .opt-label {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: var(--bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 13px;
  flex-shrink: 0;
  color: var(--text-secondary);
  transition: var(--transition);
}
.option.selected .opt-label { background: var(--primary); color: #fff; }
.option.correct .opt-label { background: var(--success); color: #fff; }
.option.wrong .opt-label { background: var(--error); color: #fff; }
.option.correct-answer .opt-label { background: var(--success); color: #fff; }
.option.disabled { pointer-events: none; opacity: 0.85; }

/* Result Banner */
.result-banner {
  margin-top: 16px;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  display: none;
}
.result-banner.show { display: block; }
.result-banner.correct { background: var(--success-light); color: var(--success); }
.result-banner.wrong { background: var(--error-light); color: var(--error); }

/* Passage (reading / cloze) */
.reading-passage {
  background: var(--card);
  border-radius: var(--radius);
  padding: 20px 24px;
  box-shadow: var(--shadow);
  margin-bottom: 16px;
  font-size: 14px;
  line-height: 1.9;
  color: var(--text);
  border-left: 4px solid var(--primary);
  max-height: 300px;
  overflow-y: auto;
}
.cloze-passage {
  background: var(--card);
  border-radius: var(--radius);
  padding: 20px 24px;
  box-shadow: var(--shadow);
  margin-bottom: 16px;
  font-size: 14px;
  line-height: 1.9;
  color: var(--text);
}
.cloze-blank { color: var(--primary); font-weight: 700; }

/* Translation */
.translate-card {
  background: var(--card);
  border-radius: var(--radius);
  padding: 24px;
  box-shadow: var(--shadow);
  margin-bottom: 16px;
  font-size: 15px;
  line-height: 1.8;
  color: var(--text);
}
.translate-card .level-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 5px;
  font-size: 11px;
  font-weight: 600;
  margin-bottom: 12px;
}
.level-a { background: var(--primary-light); color: var(--primary); }
.level-b { background: var(--warning-light); color: var(--warning); }

/* Navigation */
.nav-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 20px;
  gap: 10px;
}
.btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 9px 18px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: var(--transition);
  font-family: inherit;
  white-space: nowrap;
}
.btn-primary { background: var(--primary); color: #fff; }
.btn-primary:hover { background: var(--primary-dark); }
.btn-outline { background: #fff; color: var(--text); border: 1px solid var(--border); }
.btn-outline:hover { background: var(--bg); }
.btn-success { background: var(--success); color: #fff; }
.btn-success:hover { opacity: 0.9; }
.btn:disabled { opacity: 0.35; cursor: not-allowed; }
.btn:disabled:hover { background: var(--primary); }

.kbd-hints {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-secondary);
}
.kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
  color: var(--text-secondary);
  font-family: monospace;
}

/* Score Modal */
.modal-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  z-index: 100;
  justify-content: center;
  align-items: center;
  backdrop-filter: blur(2px);
}
.modal-overlay.show { display: flex; }
.modal {
  background: #fff;
  border-radius: 16px;
  padding: 36px;
  text-align: center;
  max-width: 380px;
  width: 92%;
  box-shadow: var(--shadow-md);
}
.modal .circle {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  border: 5px solid var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 18px;
}
.modal .circle-text {
  font-size: 26px;
  font-weight: 800;
  color: var(--primary);
}
.modal .circle.great { border-color: var(--success); }
.modal .circle.great .circle-text { color: var(--success); }
.modal h3 { font-size: 18px; margin-bottom: 8px; }
.modal p { color: var(--text-secondary); font-size: 14px; margin-bottom: 18px; line-height: 1.6; }
.modal .stats { margin-bottom: 16px; font-size: 13px; color: var(--text-secondary); }

/* Empty State */
.empty-state {
  text-align: center;
  padding: 80px 20px;
  color: var(--text-secondary);
}
.empty-state .icon { font-size: 48px; margin-bottom: 14px; opacity: 0.5; }

/* Mobile */
@media (max-width: 768px) {
  .app { flex-direction: column; }
  .sidebar {
    width: 100%;
    height: auto;
    position: static;
    flex-direction: row;
    flex-wrap: wrap;
    padding: 10px;
    gap: 6px;
    overflow-x: auto;
    white-space: nowrap;
  }
  .sidebar-header, .section-tabs { display: none; }
  .year-selector { margin: 0; padding: 0; }
  .main { padding: 14px; }
  .card { padding: 18px; }
  .kbd-hints { display: none; }
}
</style>
</head>
<body>
<div class="app">
  <nav class="sidebar">
    <div class="sidebar-header">
      <h1>中石油职称英语</h1>
      <p>历年真题题库 · 2005-2016</p>
    </div>
    <div class="year-selector">
      <select id="yearSelect"></select>
    </div>
    <div class="section-tabs" id="sectionTabs"></div>
  </nav>
  <main class="main">
    <div class="header-row">
      <h2 id="sectionTitle">词汇与结构</h2>
      <span class="year-badge" id="yearBadge"></span>
    </div>
    <div class="progress-section">
      <div class="progress-bar"><div class="progress-fill" id="progressFill" style="width:0%"></div></div>
      <div class="progress-info">
        <span id="progressText">0 / 0</span>
        <span id="scoreText">正确: 0 | 已答: 0</span>
      </div>
    </div>
    <div id="questionArea"></div>
    <div class="nav-row">
      <button class="btn btn-outline" id="btnPrev" disabled>← 上一题</button>
      <div class="kbd-hints">
        <span class="kbd">A-D</span><span>选择</span>
        <span class="kbd">←→</span><span>导航</span>
        <span class="kbd">Enter</span><span>下一题</span>
      </div>
      <button class="btn btn-primary" id="btnNext">下一题 →</button>
    </div>
  </main>
</div>

<div class="modal-overlay" id="scoreModal">
  <div class="modal">
    <div class="circle" id="scoreCircle">
      <span class="circle-text" id="scorePercent">0</span>
    </div>
    <h3 id="scoreTitle">完成!</h3>
    <div class="stats" id="scoreStats"></div>
    <p id="scoreDetail"></p>
    <button class="btn btn-primary" onclick="closeScore()">重新开始</button>
  </div>
</div>

<script>
// ====== DATA ======
const PAPERS = ${dataJSON};

// ====== CONSTANTS ======
const SECTION_KEYS = ['vocabulary', 'grammar', 'reading', 'cloze', 'translation'];
const SECTION_NAMES = {
  vocabulary: '词汇与结构', grammar: '语法与结构',
  reading: '阅读理解', cloze: '完形填空', translation: '翻译'
};
const SECTION_ICONS = {
  vocabulary: '📝', grammar: '📐', reading: '📖', cloze: '✂️', translation: '🌐'
};

// ====== STATE ======
let paperIdx = 0;
let sectionKey = 'vocabulary';
let itemIdx = 0;      // index within current section
let answers = {};     // { "paperIdx-sectionKey-itemIdx": selectedOptionIndex }
let checked = {};     // { key: true } for answered (auto-checks on select)

// ====== HELPERS ======
function getPaper() { return PAPERS[paperIdx]; }
function getSection() { return getPaper().sections[sectionKey]; }

function getSectionItems() {
  const sec = getSection();
  if (!sec) return [];
  if (sec.type === 'passage') return sec.passages || [];
  return sec.questions || [];
}

function getTotalItems() {
  const sec = getSection();
  if (!sec) return 0;
  if (sec.questions) return sec.questions.length;
  if (sec.passages) {
    let n = 0;
    for (const p of sec.passages) {
      n += (p.questions || []).length + (p.blanks || []).length;
    }
    return n;
  }
  return 0;
}

function getPassageIdx() {
  const sec = getSection();
  if (!sec || !sec.passages) return 0;
  let count = 0;
  for (let i = 0; i < sec.passages.length; i++) {
    const p = sec.passages[i];
    const n = (p.questions || []).length + (p.blanks || []).length;
    if (count + n > itemIdx) return i;
    count += n;
  }
  return sec.passages.length - 1;
}

function getQuestionInPassage() {
  const sec = getSection();
  if (!sec || !sec.passages) return 0;
  let count = 0;
  for (const p of sec.passages) {
    const n = (p.questions || []).length + (p.blanks || []).length;
    if (count + n > itemIdx) return itemIdx - count;
    count += n;
  }
  return 0;
}

function getCurrentQuestionData() {
  const sec = getSection();
  if (!sec) return null;
  if (sec.questions) return sec.questions[itemIdx];
  if (sec.passages) {
    const pIdx = getPassageIdx();
    const qIdx = getQuestionInPassage();
    const passage = sec.passages[pIdx];
    if (passage.questions && qIdx < passage.questions.length) return passage.questions[qIdx];
    if (passage.blanks) {
      const bIdx = qIdx - (passage.questions || []).length;
      if (bIdx >= 0 && bIdx < passage.blanks.length) return passage.blanks[bIdx];
    }
  }
  return null;
}

function answerKey() { return paperIdx + '-' + sectionKey + '-' + itemIdx; }

function getLetterFromIndex(idx) {
  return String.fromCharCode(65 + idx);
}

function getIndexFromLetter(letter) {
  return letter.toUpperCase().charCodeAt(0) - 65;
}

// ====== INIT ======
function init() {
  const sel = document.getElementById('yearSelect');
  sel.innerHTML = PAPERS.map((p, i) =>
    '<option value="' + i + '">' + p.title + '</option>'
  ).join('');
  sel.value = '0';
  sel.addEventListener('change', () => {
    paperIdx = parseInt(sel.value);
    sectionKey = getAvailableSections()[0] || 'vocabulary';
    itemIdx = 0;
    renderAll();
  });
  sectionKey = getAvailableSections()[0] || 'vocabulary';
  renderAll();
}

function getAvailableSections() {
  return SECTION_KEYS.filter(k => {
    const sec = getPaper().sections[k];
    if (!sec) return false;
    const n = getSectionItems().length;
    if (sec.questions) return sec.questions.length > 0;
    if (sec.passages) {
      return sec.passages.reduce((s, p) => s + (p.questions||[]).length + (p.blanks||[]).length, 0) > 0;
    }
    return n > 0;
  });
}

function buildSectionTabs() {
  const container = document.getElementById('sectionTabs');
  const available = getAvailableSections();
  container.innerHTML = available.map(key => {
    const sec = getPaper().sections[key];
    let count = 0;
    if (sec.questions) count = sec.questions.length;
    else if (sec.passages) {
      count = sec.passages.reduce((s, p) => s + (p.questions||[]).length + (p.blanks||[]).length, 0);
    }
    const cls = key === sectionKey ? ' active' : '';
    return '<div class="section-tab' + cls + '" data-section="' + key + '" onclick="switchSection(\'' + key + '\')">'
      + '<span class="icon">' + (SECTION_ICONS[key] || '📋') + '</span>'
      + '<span>' + (SECTION_NAMES[key] || key) + '</span>'
      + '<span class="count">' + count + '</span>'
      + '</div>';
  }).join('');
}

function switchSection(key) {
  sectionKey = key;
  itemIdx = 0;
  renderAll();
}

// ====== RENDER ======
function renderAll() {
  buildSectionTabs();
  document.getElementById('sectionTitle').textContent = SECTION_NAMES[sectionKey] || sectionKey;
  document.getElementById('yearBadge').textContent = getPaper().title;
  updateProgress();
  renderQuestion();
  window.scrollTo(0, 0);
}

function updateProgress() {
  const total = getTotalItems();
  const prefix = paperIdx + '-' + sectionKey + '-';
  const done = Object.keys(checked).filter(k => k.startsWith(prefix)).length;
  const correct = Object.keys(checked).filter(k => k.startsWith(prefix) && checked[k] === 'correct').length;

  document.getElementById('progressFill').style.width = total > 0 ? (done / total * 100) + '%' : '0%';
  document.getElementById('progressText').textContent = (done + 1 > total ? total : done + 1) + ' / ' + total;

  // Global stats
  let globalCorrect = 0, globalDone = 0;
  for (const k of Object.keys(checked)) {
    globalDone++;
    if (checked[k] === 'correct') globalCorrect++;
  }
  document.getElementById('scoreText').textContent = '正确: ' + globalCorrect + ' | 已答: ' + globalDone;

  const btnPrev = document.getElementById('btnPrev');
  const btnNext = document.getElementById('btnNext');
  btnPrev.disabled = itemIdx === 0;
  if (total === 0) {
    btnNext.textContent = '无题目';
    btnNext.disabled = true;
    btnPrev.disabled = true;
  } else if (itemIdx >= total - 1) {
    btnNext.textContent = '完成 ✓';
  } else {
    btnNext.textContent = '下一题 →';
  }
}

function renderQuestion() {
  const area = document.getElementById('questionArea');
  const total = getTotalItems();

  if (total === 0) {
    area.innerHTML = '<div class="empty-state"><div class="icon">📭</div><p>该试卷暂无「' + (SECTION_NAMES[sectionKey] || sectionKey) + '」内容</p></div>';
    updateProgress();
    return;
  }

  const sec = getSection();
  if (!sec) { area.innerHTML = '<div class="empty-state"><p>暂无内容</p></div>'; return; }

  if (sec.questions) {
    renderSimpleQuestion(area);
  } else if (sec.passages) {
    if (sectionKey === 'reading') renderReading(area);
    else if (sectionKey === 'cloze') renderCloze(area);
    else renderSimpleQuestion(area);
  }
  updateProgress();
}

function renderSimpleQuestion(area) {
  const q = getCurrentQuestionData();
  if (!q) { area.innerHTML = '<div class="empty-state"><p>暂无题目</p></div>'; return; }
  const key = answerKey();
  const selected = answers[key];
  const isChecked = checked[key] !== undefined;
  const userCorrect = checked[key] === 'correct';
  const qText = (q.question || '').replace(/___/g, '<span class="blank"></span>');

  area.innerHTML = '<div class="card">'
    + '<div class="q-num">' + (q.id || '?') + '</div>'
    + '<div class="q-text">' + qText + '</div>'
    + '<div class="options" id="optionsList">'
    + (q.options || []).map((o, i) => {
        let cls = 'option';
        if (selected === i) cls += ' selected';
        if (isChecked) {
          const correctIdx = getIndexFromLetter(q.answer);
          if (i === correctIdx && selected === i) cls += ' correct';
          else if (i === correctIdx) cls += ' correct-answer';
          else if (selected === i) cls += ' wrong';
          cls += ' disabled';
        }
        return '<div class="' + cls + '" data-idx="' + i + '" onclick="selectOption(' + i + ')">'
          + '<span class="opt-label">' + (o.label || getLetterFromIndex(i)) + '</span>'
          + '<span>' + (o.text || '') + '</span>'
          + '</div>';
      }).join('')
    + '</div>'
    + (isChecked ? '<div class="result-banner show ' + (userCorrect ? 'correct' : 'wrong') + '">'
      + (userCorrect ? '✓ 正确！' : '✗ 错误，正确答案是 ' + q.answer) + '</div>' : '')
    + '</div>';
}

function renderReading(area) {
  const sec = getSection();
  const pIdx = getPassageIdx();
  const qIdx = getQuestionInPassage();
  const passage = sec.passages[pIdx];
  if (!passage) { area.innerHTML = '<div class="empty-state"><p>暂无题目</p></div>'; return; }
  const q = passage.questions[qIdx];
  if (!q) { area.innerHTML = '<div class="empty-state"><p>暂无题目</p></div>'; return; }
  const key = answerKey();
  const selected = answers[key];
  const isChecked = checked[key] !== undefined;
  const userCorrect = checked[key] === 'correct';
  const qText = (q.question || '').replace(/___/g, '<span class="blank"></span>');

  let passageHTML = '';
  if (passage.passage && passage.passage.length > 0) {
    passageHTML = '<div class="reading-passage">' + passage.passage + '</div>';
  }

  area.innerHTML = passageHTML
    + '<div class="card">'
    + '<div class="q-num">' + (q.id || '?') + '</div>'
    + '<div class="q-text">' + qText + '</div>'
    + '<div class="options" id="optionsList">'
    + (q.options || []).map((o, i) => {
        let cls = 'option';
        if (selected === i) cls += ' selected';
        if (isChecked) {
          const correctIdx = getIndexFromLetter(q.answer);
          if (i === correctIdx && selected === i) cls += ' correct';
          else if (i === correctIdx) cls += ' correct-answer';
          else if (selected === i) cls += ' wrong';
          cls += ' disabled';
        }
        return '<div class="' + cls + '" data-idx="' + i + '" onclick="selectOption(' + i + ')">'
          + '<span class="opt-label">' + (o.label || getLetterFromIndex(i)) + '</span>'
          + '<span>' + (o.text || '') + '</span>'
          + '</div>';
      }).join('')
    + '</div>'
    + (isChecked ? '<div class="result-banner show ' + (userCorrect ? 'correct' : 'wrong') + '">'
      + (userCorrect ? '✓ 正确！' : '✗ 错误，正确答案是 ' + q.answer) + '</div>' : '')
    + '</div>';
}

function renderCloze(area) {
  const sec = getSection();
  const pIdx = getPassageIdx();
  const qIdx = getQuestionInPassage();
  const passage = sec.passages[pIdx];
  if (!passage) { area.innerHTML = '<div class="empty-state"><p>暂无题目</p></div>'; return; }
  const q = passage.blanks ? passage.blanks[qIdx] : null;
  if (!q) { area.innerHTML = '<div class="empty-state"><p>暂无题目</p></div>'; return; }
  const key = answerKey();
  const selected = answers[key];
  const isChecked = checked[key] !== undefined;
  const userCorrect = checked[key] === 'correct';

  let passageHTML = '';
  if (passage.passage && passage.passage.length > 0) {
    let text = passage.passage;
    if (passage.blanks) {
      passage.blanks.forEach((b, i) => {
        text = text.replace(new RegExp('\\\\b' + b.id + '\\\\b', 'g'), '<span class="cloze-blank">(' + b.id + ')</span>');
      });
    }
    passageHTML = '<div class="cloze-passage">' + text + '</div>';
  }

  area.innerHTML = passageHTML
    + '<div class="card">'
    + '<div class="q-num">' + (q.id || '?') + '</div>'
    + '<div class="q-text">选择第 <span class="cloze-blank">(' + q.id + ')</span> 的正确答案：</div>'
    + '<div class="options" id="optionsList">'
    + (q.options || []).map((o, i) => {
        let cls = 'option';
        if (selected === i) cls += ' selected';
        if (isChecked) {
          const correctIdx = getIndexFromLetter(q.answer);
          if (i === correctIdx && selected === i) cls += ' correct';
          else if (i === correctIdx) cls += ' correct-answer';
          else if (selected === i) cls += ' wrong';
          cls += ' disabled';
        }
        return '<div class="' + cls + '" data-idx="' + i + '" onclick="selectOption(' + i + ')">'
          + '<span class="opt-label">' + (o.label || getLetterFromIndex(i)) + '</span>'
          + '<span>' + (o.text || '') + '</span>'
          + '</div>';
      }).join('')
    + '</div>'
    + (isChecked ? '<div class="result-banner show ' + (userCorrect ? 'correct' : 'wrong') + '">'
      + (userCorrect ? '✓ 正确！' : '✗ 错误，正确答案是 ' + q.answer) + '</div>' : '')
    + '</div>';
}

// ====== ACTIONS ======
function selectOption(idx) {
  const key = answerKey();
  if (checked[key] !== undefined) return; // already answered

  const q = getCurrentQuestionData();
  if (!q || !q.answer) return; // no answer to check against

  answers[key] = idx;
  const correctIdx = getIndexFromLetter(q.answer);
  const isCorrect = idx === correctIdx;
  checked[key] = isCorrect ? 'correct' : 'wrong';

  // Re-render to show result
  renderQuestion();
}

function nextItem() {
  const total = getTotalItems();
  if (total === 0) return;

  if (itemIdx < total - 1) {
    itemIdx++;
    renderAll();
  } else {
    // Move to next section or show score
    const available = getAvailableSections();
    const curIdx = available.indexOf(sectionKey);
    if (curIdx < available.length - 1) {
      switchSection(available[curIdx + 1]);
    } else {
      showScore();
    }
  }
}

function prevItem() {
  if (itemIdx > 0) {
    itemIdx--;
    renderAll();
  }
}

function showScore() {
  let globalCorrect = 0, globalDone = 0;
  for (const k of Object.keys(checked)) {
    globalDone++;
    if (checked[k] === 'correct') globalCorrect++;
  }

  const pct = globalDone > 0 ? Math.round(globalCorrect / globalDone * 100) : 0;
  const circle = document.getElementById('scoreCircle');
  document.getElementById('scorePercent').textContent = pct + '%';
  document.getElementById('scoreTitle').textContent = pct >= 80 ? '太棒了！' : pct >= 60 ? '继续加油！' : '需要多练习！';
  document.getElementById('scoreStats').textContent = '正确 ' + globalCorrect + ' / 已答 ' + globalDone + ' 题';
  document.getElementById('scoreDetail').textContent = '试卷：' + getPaper().title;

  circle.className = 'circle' + (pct >= 80 ? ' great' : '');
  document.getElementById('scoreModal').classList.add('show');
}

function closeScore() {
  document.getElementById('scoreModal').classList.remove('show');
  checked = {};
  answers = {};
  sectionKey = getAvailableSections()[0] || 'vocabulary';
  itemIdx = 0;
  renderAll();
}

// ====== KEYBOARD ======
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  const total = getTotalItems();
  if (total === 0) return;

  const key = answerKey();

  // A/B/C/D to select
  if (!checked[key]) {
    const optMap = { a: 0, b: 1, c: 2, d: 3, e: 4 };
    const letter = e.key.toLowerCase();
    if (letter in optMap) {
      e.preventDefault();
      selectOption(optMap[letter]);
    }
  }

  // Navigation
  if (e.key === 'ArrowRight' || e.key === 'Enter') {
    e.preventDefault();
    nextItem();
  }
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    prevItem();
  }
});

// ====== BUTTONS ======
document.getElementById('btnNext').addEventListener('click', nextItem);
document.getElementById('btnPrev').addEventListener('click', prevItem);

// ====== START ======
init();
</script>
</body>
</html>`;

const outPath = path.join(__dirname, 'index.html');
fs.writeFileSync(outPath, html, 'utf-8');
console.log('Generated: ' + outPath + ' (' + (Buffer.byteLength(html) / 1024).toFixed(0) + ' KB)');

// Also generate a compact version (minified data keys)
console.log('\n=== Year Summary ===');
for (const entry of normalized) {
  let total = 0;
  for (const sec of Object.values(entry.sections)) {
    if (sec.questions) total += sec.questions.length;
    if (sec.passages) {
      for (const p of sec.passages) {
        total += (p.questions || []).length + (p.blanks || []).length;
      }
    }
  }
  console.log('  ' + entry.year + ': ' + total + ' questions');
}
