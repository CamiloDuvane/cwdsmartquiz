export function showStudyContent() {
  document.getElementById('mainMenu').style.display = 'none';
  document.querySelector('.footer').style.display = 'none';
  const subjectSelection = document.getElementById('subjectSelection');
  const studyContent = document.getElementById('studyContent'); 
  const studySubjectGrid = document.getElementById('studySubjectGrid');
  const footer = document.querySelector('.footer');
  const studentHeader = document.querySelector('.student-header');

  // Clear existing content
  if (studySubjectGrid) {
    studySubjectGrid.innerHTML = '';
  }

  const mainMenu = document.getElementById('mainMenu');
  if (mainMenu) mainMenu.style.display = 'none';
  if (subjectSelection) subjectSelection.style.display = 'none';
  if (studyContent) studyContent.style.display = 'block';
  if (footer) footer.style.display = 'none';
  if (studentHeader) studentHeader.style.display = 'none';

  populateStudySubjects();
}

export function getSubjectContent(subject) {
  const contentDatabase = {
    matematica: {
      author: "Maria Silva",
      year: "2023",
      sections: [{
        title: "Capítulo 1: Álgebra Básica",
        text: `
          <div class="section-header">
            <h3>Capítulo 1: Álgebra Básica</h3>
          </div>
          <p class="chapter-text">A álgebra é um ramo fundamental da matemática que lida com símbolos
          e as regras para manipulá-los. Este capítulo introduz os conceitos básicos necessários.</p>
          <p>Seção 1: Expressões Algébricas</p>
          <p>Uma expressão algébrica é uma combinação de números e letras unidos por operações matemáticas.</p>`
      }]
    }
  };
  return contentDatabase[subject] || {
    author: "Autor Padrão",
    year: "2023",
    sections: [{
      title: "Conteúdo em Desenvolvimento",
      text: `
        <div class="section-header">
          <h3>Conteúdo em Desenvolvimento</h3>
        </div>
        <p>O conteúdo desta disciplina está sendo desenvolvido.</p>`
    }]
  };
}

import { getUserPermissions } from './permissions.js';

export function showSubjectMaterial(subject) {
  const currentUser = JSON.parse(localStorage.getItem('currentUser'));
  const userPermissions = getUserPermissions(currentUser.name);
  if (!userPermissions.study.includes(subject)) {
    alert('Você não tem permissão para acessar esta disciplina');
    return;
  }
  const studyContent = document.getElementById('studyContent');
  const content = getSubjectContent(subject);
  
  studyContent.innerHTML = `
    <div class="subject-material">
      <div class="header">
        <h2>${getSubjectDisplayName(subject)}</h2>
      </div>
      
      <div class="book-info">
        <h3>Informação do Livro</h3>
        <p><strong>Autor:</strong> ${content.author}</p>
        <p><strong>Ano:</strong> ${content.year}</p>
      </div>

      <div class="content">
        ${content.sections.map((section, index) => `
          <div class="content-section" id="section-${index}" style="display: ${index === 0 ? 'grid' : 'none'}">
            <div class="content-text">
              ${section.text}
            </div>
          </div>
        `).join('')}
      </div>
      
      <div class="navigation-buttons">
        <button class="button back-button" onclick="window.returnToStudySubjects()">Voltar</button>
      </div>
    </div>
  `;
}

function getSubjectDisplayName(subject) {
  const displayNames = {
    matematica: 'Matemática',
    fisica: 'Física',
    quimica: 'Química',
    biologia: 'Biologia'
  };
  return displayNames[subject] || subject;
}

function populateStudySubjects() {
  const currentUser = JSON.parse(localStorage.getItem('currentUser'));
  const userPermissions = getUserPermissions(currentUser.name);
  const studyContent = document.getElementById('studyContent');

  studyContent.innerHTML = `
    <h2>Material de Estudo</h2>
    <div id="studySubjectGrid" class="subject-grid"></div>
    <button class="button back-button" onclick="window.returnToMainMenu()">Voltar ao Menu</button>
  `;

  const studySubjectGrid = document.getElementById('studySubjectGrid');
  const subjects = ['matematica', 'fisica', 'quimica', 'biologia'];

  subjects.forEach(subject => {
    if (userPermissions.study.includes(subject)) {
      const card = document.createElement('div');
      card.className = `subject-card ${subject}`;
      card.onclick = () => showSubjectMaterial(subject);
      card.textContent = getSubjectDisplayName(subject);
      studySubjectGrid.appendChild(card);
    }
  });
}

export function returnToStudySubjects() {
  showStudyContent();
}