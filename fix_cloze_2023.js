/**
 * 构建2023年完形填空Q61-Q70 — 使用 passages + blanks 结构
 * 适配 build_quiz.js 的 renderCloze() 渲染逻辑
 */
const fs = require('fs');
const path = require('path');

// === 答案密钥 ===
const answerKey = {
  61: 'B', 62: 'B', 63: 'A', 64: 'B', 65: 'A',
  66: 'D', 67: 'A', 68: 'C', 69: 'B', 70: 'A'
};

// === 完形填空段落（使用(61)格式空白，方便regex匹配） ===
const passageText = "In every cultivated language there are two great classes of words which, taken together, comprise the whole vocabulary. First, there are those words (61) which we become acquainted in daily conversation, which we learn, that is to say, from the (62) of our own family and from our familiar associates, and which we should know and use (63) we could not read or write. They concern the common things of life, and are the stock-in-trade of all who (64) the language. Such words may be called \"popular,\" since they belong to the people (65) and are not the exclusive possession of a limited class.\n\nOn the other hand, our language includes a multitude of words which are comparatively (66) used in ordinary conversation. Their meanings are known to every educated person, but there is little (67) to use them at home or in the market-place. Our first acquaintance with them comes not from our mother's lips or from the talk of our school-mates, (68) from books that we read, lectures that we hear, or the more formal conversation of highly educated speakers who are discussing some particular (69) in a style appropriately elevated above the habitual level of everyday life. Such words are called \"learned,\" and the (70) between them and the \"popular\" words is of great importance to a right understanding of linguistic process.";

// === Q61-Q70 blanks ===
// helpers
const toOpts = obj => ['A','B','C','D'].map(l => ({ label: l, text: obj[l] || '' }));

const blanks = [
  { id: 61, options: toOpts({ A: 'at', B: 'through', C: 'with', D: 'by' }), answer: 'B' },
  { id: 62, options: toOpts({ A: 'relatives', B: 'members', C: 'mates', D: 'fellows' }), answer: 'B' },
  { id: 63, options: toOpts({ A: 'in spite of', B: 'even', C: 'despite', D: 'even if' }), answer: 'A' },
  { id: 64, options: toOpts({ A: 'say', B: 'practice', C: 'apply', D: 'speak' }), answer: 'B' },
  { id: 65, options: toOpts({ A: 'in public', B: 'at most', C: 'at best', D: 'at large' }), answer: 'A' },
  { id: 66, options: toOpts({ A: 'frequently', B: 'seldom', C: 'irregularly', D: 'much' }), answer: 'D' },
  { id: 67, options: toOpts({ A: 'occasion', B: 'prospect', C: 'way', D: 'reason' }), answer: 'A' },
  { id: 68, options: toOpts({ A: 'besides', B: 'but', C: 'and', D: 'or' }), answer: 'C' },
  { id: 69, options: toOpts({ A: 'theme', B: 'problem', C: 'topic', D: 'question' }), answer: 'B' },
  { id: 70, options: toOpts({ A: 'comparison', B: 'contrast', C: 'distinction', D: 'similarity' }), answer: 'A' }
];

// === 验证答案 ===
console.log('=== 答案验证 ===');
let allMatch = true;
for (const b of blanks) {
  const expected = answerKey[b.id];
  const match = b.answer === expected ? '✓' : '✗ MISMATCH';
  if (b.answer !== expected) allMatch = false;
  console.log(`Q${b.id}: answer=${b.answer} key=${expected} ${match}`);
}
if (allMatch) console.log('\n所有答案与密钥一致 ✓');

// === 读取现有2023数据 ===
const v2path = path.join(__dirname, '2023_questions_v2.json');
const data = JSON.parse(fs.readFileSync(v2path, 'utf-8'));

// 从所有section中移除Q61-Q70
for (const key of Object.keys(data.sections)) {
  const sec = data.sections[key];
  if (sec.questions) {
    sec.questions = sec.questions.filter(q => q.id < 61 || q.id > 70);
  }
  if (sec.passages) {
    for (const p of sec.passages) {
      if (p.blanks) p.blanks = p.blanks.filter(b => b.id < 61 || b.id > 70);
      if (p.questions) p.questions = p.questions.filter(q => q.id < 61 || q.id > 70);
    }
  }
}

// 移除旧的 cloze section
for (const key of Object.keys(data.sections)) {
  if (key === 'section_cloze' || key.includes('cloze') || key.includes('Cloze')) {
    delete data.sections[key];
  }
}

// 在reading之后插入新的cloze section
const keys = Object.keys(data.sections);
const readingIdx = keys.findIndex(k => k.includes('reading') || k.includes('Reading'));
const newSections = {};
for (let i = 0; i < keys.length; i++) {
  newSections[keys[i]] = data.sections[keys[i]];
  if (i === readingIdx) {
    newSections['cloze'] = {
      title: 'Section B: Cloze (完形填空)',
      passages: [{
        passage: passageText,
        blanks: blanks
      }]
    };
  }
}
data.sections = newSections;

// 保存
fs.writeFileSync(v2path, JSON.stringify(data, null, 2), 'utf-8');
console.log(`\n已更新 ${v2path}`);
console.log(`Cloze section: 1 passage, ${blanks.length} blanks`);

// === 统计 ===
let totalQ = 0;
for (const [key, sec] of Object.entries(data.sections)) {
  let count = 0;
  if (sec.questions) count += sec.questions.length;
  if (sec.passages) {
    for (const p of sec.passages) {
      if (p.questions) count += p.questions.length;
      if (p.blanks) count += p.blanks.length;
    }
  }
  totalQ += count;
  console.log(`  ${key}: ${count} questions`);
}
console.log(`\n总计: ${totalQ} questions`);
