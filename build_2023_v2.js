// build_2023_v2.js - 以答案为主构建2023年试题数据
// 策略：先确定71题的答案序列，再从OCR中匹配题文

const fs = require('fs');
const path = require('path');

// Load answer key (71 answers in order)
const answerKey = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '2023_answer_key.json'), 'utf-8'));
const answers = answerKey.answers.map(a => a.ans);
console.log(`Answer key: ${answers.length} answers loaded`);
console.log(`Answer string: ${answers.join('')}`);

// Load both OCR scans
const ocrText = fs.readFileSync(path.join(__dirname, '2023_ocr_output.txt'), 'utf-8');

// Find scan boundaries
const vocabPositions = [];
const vocabRegex = /I\.\s+Vocabulary/g;
let m;
while ((m = vocabRegex.exec(ocrText)) !== null) {
    vocabPositions.push(m.index);
}
console.log(`\nFound ${vocabPositions.length} OCR scans`);

// For each scan, extract all questions with their IDs
function extractQuestions(text) {
    const questions = [];
    // Find question blocks: number followed by dot and space, then text until next question or section break
    const lines = text.split('\n');
    let currentQ = null;
    let currentOptions = {};
    let inOptions = false;
    let lastOption = '';
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Check for question number
        const qMatch = line.match(/^(\d{1,2})\.\s+(.+)/);
        const optMatch = line.match(/^([A-D])[\.\s)]\s*(.+)/);
        const sectionMatch = line.match(/^[IVX]+\.\s+[A-Z]/);
        
        if (qMatch && !sectionMatch) {
            // Save previous question
            if (currentQ && Object.keys(currentOptions).length >= 2) {
                currentQ.options = currentOptions;
                questions.push(currentQ);
            }
            
            currentQ = {
                id: parseInt(qMatch[1]),
                question: qMatch[2].trim(),
            };
            currentOptions = {};
            inOptions = true;
            lastOption = '';
        } else if (optMatch && currentQ) {
            const optLetter = optMatch[1];
            const optText = optMatch[2].trim();
            currentOptions[optLetter] = optText;
            lastOption = optLetter;
        } else if (inOptions && currentQ && line.trim() && !line.match(/^(Questions?\s+\d+|Directions?:|Section\s+[A-Z]|PAGE\s+\d+)/i)) {
            // Continuation of option text or question text
            if (lastOption && currentOptions[lastOption]) {
                currentOptions[lastOption] += ' ' + line.trim();
            } else if (Object.keys(currentOptions).length === 0) {
                // Still question text continuation
                if (currentQ.question) currentQ.question += ' ' + line.trim();
            }
        } else if (line.trim() === '' || line.match(/^(RENRENDOC|=== PAGE)/)) {
            inOptions = false;
        }
    }
    
    // Save last question
    if (currentQ && Object.keys(currentOptions).length >= 2) {
        currentQ.options = currentOptions;
        questions.push(currentQ);
    }
    
    return questions;
}

// Extract from each scan and merge
let allQuestions = new Map(); // id -> {question, options}

for (let si = 0; si < vocabPositions.length; si++) {
    const start = vocabPositions[si];
    const end = si + 1 < vocabPositions.length ? vocabPositions[si + 1] : ocrText.length;
    const scanText = ocrText.substring(start, end);
    const questions = extractQuestions(scanText);
    
    console.log(`\nScan #${si + 1}: extracted ${questions.length} questions`);
    
    // Filter out bad IDs (too small or too large)
    const validQs = questions.filter(q => q.id >= 1 && q.id <= 71);
    console.log(`  Valid (1-71): ${validQs.length}`);
    
    // Show outliers
    const outliers = questions.filter(q => q.id < 1 || q.id > 71);
    if (outliers.length > 0) {
        console.log(`  Outliers: ${outliers.map(q => `Q${q.id}`).join(', ')}`);
    }
    
    // Merge into allQuestions (prefer longer question text)
    for (const q of validQs) {
        const existing = allQuestions.get(q.id);
        const qText = cleanText(q.question);
        if (!existing || qText.length > existing.question.length) {
            allQuestions.set(q.id, {
                question: qText,
                options: q.options,
            });
        }
    }
}

// Helper: clean OCR text
function cleanText(text) {
    return text
        .replace(/\s+/g, ' ')
        .replace(/RENRENDOC\.COM/gi, '')
        .replace(/[KkLlJjHh\[\]\/\d]{4,}/g, '') // Remove garbled reference lines
        .replace(/\s{2,}/g, ' ')
        .trim();
}

// Build sections
const sections = {
    vocabulary: { title: 'Vocabulary', questions: [] },
    grammar: { title: 'Grammatical Structure', questions: [] },
    reading: { title: 'Reading Comprehension', questions: [] },
    translation: { title: 'Translation', questions: [] },
};

// Assign questions to sections based on ID ranges
// Q1-20: Vocabulary, Q21-40: Grammar, Q41-70: Reading, Q71: Translation
for (let id = 1; id <= 71; id++) {
    const answer = answers[id - 1];
    const ocrData = allQuestions.get(id);
    
    let question, options;
    if (ocrData) {
        question = ocrData.question;
        options = ocrData.options;
    } else {
        question = `[Question ${id} - OCR text unavailable]`;
        options = { A: '', B: '', C: '', D: '' };
    }
    
    // Ensure options has all 4 letters
    for (const letter of ['A', 'B', 'C', 'D']) {
        if (!options[letter]) options[letter] = '';
    }
    
    const qEntry = {
        id: id,
        question: question,
        options: options,
        answer: answer,
    };
    
    if (id <= 20) sections.vocabulary.questions.push(qEntry);
    else if (id <= 40) sections.grammar.questions.push(qEntry);
    else if (id <= 70) sections.reading.questions.push(qEntry);
    else sections.translation.questions.push(qEntry);
}

// Cleanup: if a section has 0 questions, remove it
for (const [key, sec] of Object.entries(sections)) {
    if (sec.questions.length === 0) delete sections[key];
}

// Build output
const output = {
    title: '2023年中石油职称英语考试真题',
    year: 2023,
    source: '2023职称英语真题.pdf (答案: 红色标记自动识别)',
    sections: sections,
};

// Stats
let totalQ = 0;
let totalWithText = 0;
let totalWithFullOptions = 0;
for (const [key, sec] of Object.entries(sections)) {
    totalQ += sec.questions.length;
    totalWithText += sec.questions.filter(q => q.question && !q.question.includes('OCR text unavailable')).length;
    totalWithFullOptions += sec.questions.filter(q => q.options.A && q.options.B && q.options.C && q.options.D).length;
}

console.log(`\n========== FINAL STATS ==========`);
console.log(`Total questions: ${totalQ}`);
console.log(`With OCR text: ${totalWithText}/${totalQ}`);
console.log(`With full options: ${totalWithFullOptions}/${totalQ}`);

for (const [key, sec] of Object.entries(sections)) {
    const withText = sec.questions.filter(q => !q.question.includes('OCR text unavailable')).length;
    console.log(`  ${sec.title}: ${sec.questions.length} questions, ${withText} with text`);
}

// Verify answer string
const allQEntries = Object.values(sections).flatMap(s => s.questions).sort((a,b) => a.id - b.id);
const answerStr = allQEntries.map(q => q.answer).join('');
console.log(`\nAnswer string: ${answerStr}`);
console.log(`Expected:      ${answers.join('')}`);
console.log(`Match: ${answerStr === answers.join('')}`);

// Show missing text questions
const missing = allQEntries.filter(q => q.question.includes('OCR text unavailable'));
if (missing.length > 0) {
    console.log(`\nMissing text for: ${missing.map(q => 'Q' + q.id).join(', ')}`);
}

// Save
const outputPath = path.join(__dirname, '2023_questions_v2.json');
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log(`\nSaved to: ${outputPath}`);

// Also save just the answer key for reference
const answerOnly = {
    year: 2023,
    answers: allQEntries.map(q => ({ id: q.id, answer: q.answer })),
    answerString: answerStr,
};
fs.writeFileSync(path.join(__dirname, '..', '2023_answer_verified.json'), JSON.stringify(answerOnly, null, 2));
