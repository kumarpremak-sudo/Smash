const fs = require('fs');
const files = ['dashboard.html', 'schedule.html', 'members.html', 'programs.html', 'settings.html', 'coach.html'];
let output = [];
files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const openDivs = (content.match(/<div(\s|>)/g) || []).length;
  const closeDivs = (content.match(/<\/div>/g) || []).length;
  if (openDivs !== closeDivs) {
    output.push(f + ': MISMATCH! Open: ' + openDivs + ', Close: ' + closeDivs);
  } else {
    output.push(f + ': OK');
  }
});
fs.writeFileSync('audit.txt', output.join('\n'));
