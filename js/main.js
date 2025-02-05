import { handleLogin, showRegistration, showPasswordRecovery, backToLogin, handleRegistration } from './auth.js';
import { showQuizContent, selectSubject, submitAnswer, returnToSubjects } from './quiz.js';
import { showStudyContent, showSubjectMaterial, returnToStudySubjects } from './study.js';
import { initializeStudentDashboard } from './utils.js';
import { viewAllResults } from './results.js';
import { searchUser, filterResults } from './auth.js';

// Make sure to expose all needed functions to window object
window.handleLogin = handleLogin;
window.showRegistration = showRegistration;
window.showPasswordRecovery = showPasswordRecovery;
window.backToLogin = backToLogin;
window.handleRegistration = handleRegistration;
window.showQuizContent = showQuizContent;
window.selectSubject = selectSubject;
window.submitAnswer = submitAnswer;
window.returnToSubjects = returnToSubjects;
window.showStudyContent = showStudyContent;
window.showSubjectMaterial = showSubjectMaterial;
window.returnToStudySubjects = returnToStudySubjects;
window.viewAllResults = viewAllResults;
window.searchUser = searchUser;
window.filterResults = filterResults;
window.returnToMainMenu = returnToMainMenu;

function returnToMainMenu() {
  const mainMenu = document.getElementById('mainMenu');
  const footer = document.querySelector('.footer');
  const subjectSelection = document.getElementById('subjectSelection');
  const studyContent = document.getElementById('studyContent');
  const questionContainer = document.getElementById('questionContainer');

  if (mainMenu) mainMenu.style.display = 'flex';
  if (footer) footer.style.display = 'block';
  if (subjectSelection) subjectSelection.style.display = 'none';
  if (studyContent) studyContent.style.display = 'none';
  if (questionContainer) questionContainer.style.display = 'none';
}