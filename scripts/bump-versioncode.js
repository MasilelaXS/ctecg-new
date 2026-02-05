const fs = require('fs');
const path = require('path');

const appJsonPath = path.join(__dirname, '..', 'app.json');

const raw = fs.readFileSync(appJsonPath, 'utf8');
const data = JSON.parse(raw);

if (!data.expo || !data.expo.android) {
  throw new Error('Invalid app.json: missing expo.android');
}

const current = Number(data.expo.android.versionCode || 0);
const next = current + 1;
data.expo.android.versionCode = next;

fs.writeFileSync(appJsonPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log(`versionCode bumped: ${current} -> ${next}`);