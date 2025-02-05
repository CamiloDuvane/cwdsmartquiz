import { getUserPermissions } from './permissions.js';

export function formatTimeDuration(timeInSeconds) {
  const hours = Math.floor(timeInSeconds / 3600);
  const minutes = Math.floor(timeInSeconds % 3600 / 60);
  const seconds = timeInSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function updateAnalytics() {
  const startTimeStr = localStorage.getItem('startTime');
  const currentUser = JSON.parse(localStorage.getItem('currentUser'));
  if (!startTimeStr || !currentUser) return;
  
  const startTime = new Date(parseInt(startTimeStr));
  const currentTime = new Date();
  const totalTimeSpent = Math.floor((currentTime - startTime) / 1000);
  
  const totalTimeSpentElem = document.getElementById('totalTimeSpent');
  if (totalTimeSpentElem) {
    totalTimeSpentElem.textContent = formatTimeDuration(totalTimeSpent);
  }

  const studentNameHeader = document.getElementById('studentNameHeader');
  if (studentNameHeader) {
    studentNameHeader.textContent = currentUser.name;
  }
}

export function initializeStudentDashboard() {
  localStorage.setItem('startTime', Date.now().toString());
  updateAnalytics();
  setInterval(updateAnalytics, 1000);
}