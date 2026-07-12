const fs = require('fs');
const files = ['dashboard.html', 'schedule.html', 'members.html', 'programs.html', 'settings.html', 'coach.html'];

files.forEach(f => {
  let cnt = fs.readFileSync(f, 'utf8');
  
  // Desktop Nav
  cnt = cnt.replace(/<a href=\"dashboard\.html\" class=\"nav-link( active)?\">/g, '<a href=\"dashboard.html\" id=\"navDashboard\" class=\"nav-link$1\">');
  cnt = cnt.replace(/<a href=\"schedule\.html\" class=\"nav-link( active)?\">/g, '<a href=\"schedule.html\" id=\"navSchedule\" class=\"nav-link$1\">');
  cnt = cnt.replace(/<a href=\"members\.html\" class=\"nav-link( active)?\">/g, '<a href=\"members.html\" id=\"navMembers\" class=\"nav-link$1\">');
  cnt = cnt.replace(/<a href=\"programs\.html\" class=\"nav-link( active)?\">/g, '<a href=\"programs.html\" id=\"navPrograms\" class=\"nav-link$1\">');

  // Bottom Nav
  cnt = cnt.replace(/<a href=\"dashboard\.html\" class=\"bottom-nav-item( active)?\">(.*?)<\/a>/g, '<a href=\"dashboard.html\" id=\"bottomNavDashboard\" class=\"bottom-nav-item$1\">$2</a>');
  cnt = cnt.replace(/<a href=\"schedule\.html\" class=\"bottom-nav-item( active)?\">(.*?)<\/a>/g, '<a href=\"schedule.html\" id=\"bottomNavSchedule\" class=\"bottom-nav-item$1\">$2</a>');
  cnt = cnt.replace(/<a href=\"members\.html\" class=\"bottom-nav-item( active)?\">(.*?)<\/a>/g, '<a href=\"members.html\" id=\"bottomNavMembers\" class=\"bottom-nav-item$1\">$2</a>');
  cnt = cnt.replace(/<a href=\"programs\.html\" class=\"bottom-nav-item( active)?\">(.*?)<\/a>/g, '<a href=\"programs.html\" id=\"bottomNavPrograms\" class=\"bottom-nav-item$1\">$2</a>');

  fs.writeFileSync(f, cnt);
  console.log('Updated ' + f);
});
