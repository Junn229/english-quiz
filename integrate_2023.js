// integrate_2023.js - 将2023数据整合到historical_questions.json
const fs = require('fs');
const path = require('path');

// Load existing data
const historicalPath = path.join(__dirname, 'historical_questions.json');
const historical = JSON.parse(fs.readFileSync(historicalPath, 'utf-8'));

// Load 2023 data
const data2023 = JSON.parse(fs.readFileSync(path.join(__dirname, '2023_questions_v2.json'), 'utf-8'));

// Check if 2023 already exists
const existingIdx = historical.findIndex(h => h.year === 2023);
if (existingIdx >= 0) {
    console.log(`Replacing existing 2023 entry at index ${existingIdx}`);
    historical[existingIdx] = data2023;
} else {
    console.log('Adding new 2023 entry');
    historical.push(data2023);
}

// Sort by year
historical.sort((a, b) => a.year - b.year);

// Save
fs.writeFileSync(historicalPath, JSON.stringify(historical, null, 2));
console.log(`Saved historical_questions.json with ${historical.length} years`);

// Stats
let totalQ = 0;
for (const entry of historical) {
    for (const sec of Object.values(entry.sections)) {
        if (sec.questions) totalQ += sec.questions.length;
        if (sec.passages) {
            for (const p of sec.passages) {
                if (p.questions) totalQ += p.questions.length;
                if (p.blanks) totalQ += p.blanks.length;
            }
        }
    }
}
console.log(`Total questions across all years: ${totalQ}`);
console.log(`Years: ${historical.map(h => h.year).join(', ')}`);
