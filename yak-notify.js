const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DATA_FILE = path.join(__dirname, 'yak-data.json');

function dateStr(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

try {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const today = dateStr(new Date());
  const alerts = [];

  (data.cards || []).forEach(card => {
    const project = card.project || 'Untitled';

    // Check tasks
    (card.tasks || []).forEach(task => {
      if (task.done) return;
      if (task.dueDate && task.dueDate <= today) {
        const label = task.dueDate < today ? 'OVERDUE' : 'Due today';
        alerts.push(`${label}: "${task.text}" (${project})`);
      }
    });

    // Check follow-ups
    if (card.followup && card.followup <= today) {
      const label = card.followup < today ? 'OVERDUE follow-up' : 'Follow-up today';
      alerts.push(`${label}: ${project}`);
    }
  });

  if (alerts.length > 0) {
    const title = `Yak: ${alerts.length} item${alerts.length > 1 ? 's' : ''} need attention`;
    const body = alerts.slice(0, 5).join('\\n') + (alerts.length > 5 ? `\\n...and ${alerts.length - 5} more` : '');
    execSync(`osascript -e 'display notification "${body}" with title "${title}"'`);
  }
} catch (err) {
  console.error('Yak notify error:', err.message);
}
