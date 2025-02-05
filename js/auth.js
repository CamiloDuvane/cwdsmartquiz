export function handleLogin() {
  const username = document.getElementById('username').value;
  const accessCode = document.getElementById('accessCode').value;
  const errorMessage = document.getElementById('errorMessage');

  // Clear previous error message
  if (errorMessage) {
    errorMessage.style.display = 'none';
  }

  // Check for empty fields
  if (!username || !accessCode) {
    if (errorMessage) {
      errorMessage.style.display = 'block';
      errorMessage.textContent = 'Por favor preencha todos os campos';
    }
    return;
  }

  // Admin access checks
  if (isAdminLogin(username, accessCode)) {
    handleAdminAccess(username);
    return;
  }

  // Regular user authentication
  const validUsers = getValidUsers();
  const foundUser = validUsers.find(u => u.name === username && u.password === accessCode);

  if (!foundUser) {
    if (errorMessage) {
      errorMessage.style.display = 'block';
      errorMessage.textContent = 'Usuário não aprovado ou credenciais inválidas';
    }
    return;
  }

  // Handle successful login
  handleSuccessfulLogin(foundUser);
}

function isAdminLogin(username, accessCode) {
  const adminCredentials = {
    'ABC': '123',
    'CWD': '6363',
    'Encarregado': '1234',
    'Admin': 'admin123',
    'Master': 'master456'
  };

  return adminCredentials[username] === accessCode;
}

function handleAdminAccess(username) {
  switch(username) {
    case 'ABC':
    case 'Master':
      showAdminSearchPanel();
      break;
    case 'CWD':
    case 'Encarregado':
    case 'Admin':
      showAdminPanel();
      break;
    default:
      // Should never reach here due to isAdminLogin check
      console.error('Unexpected admin username');
  }
}

function handleSuccessfulLogin(user) {
  // Update local storage
  const approvedUsers = JSON.parse(localStorage.getItem('approvedUsers')) || [];
  const storedUser = approvedUsers.find(u => u.name === user.name);
  
  if (storedUser) {
    user = {
      ...user,
      activityHistory: storedUser.activityHistory || []
    };
  }
  
  localStorage.setItem('currentUser', JSON.stringify(user));
  localStorage.setItem('studentName', user.name);

  // Update UI
  const loginForm = document.getElementById('loginForm');
  const mainMenu = document.getElementById('mainMenu');
  const footer = document.querySelector('.footer');
  const studentHeader = document.querySelector('.student-header');

  if (loginForm) loginForm.style.display = 'none';
  if (mainMenu) mainMenu.style.display = 'flex';
  if (footer) footer.style.display = 'block';
  if (studentHeader) studentHeader.style.display = 'none';

  // Initialize dashboard
  initializeStudentDashboard();
}

function getValidUsers() {
  return [
    { name: 'Camilo Duvane', password: '1234' },
    { name: 'Cíntia Mucumbi', password: '4321' },
    { name: 'Camilo Wiliamo', password: '6363' },
    { name: 'Milo', password: '6363' }
  ];
}

function showAdminSearchPanel() {
  const adminSearchPanel = document.createElement('div');
  adminSearchPanel.id = 'adminSearchPanel';
  adminSearchPanel.innerHTML = `
    <div class="login-form">
      <h2>Painel de Administrador - Pesquisa</h2>
      <div class="search-controls">
        <div class="search-bar">
          <input type="text" id="searchInput" placeholder="Pesquisar usuário...">
          <button class="button search-button" onclick="window.searchUser()">
            <i class="fas fa-search"></i> Buscar
          </button>
        </div>
        <select id="subjectFilter" onchange="window.filterResults()">
          <option value="">Todas as Disciplinas</option>
          <option value="matematica">Matemática</option>
          <option value="fisica">Física</option>
          <option value="quimica">Química</option>
          <option value="biologia">Biologia</option>
        </select>
      </div>
      <div id="searchResults"></div>
      <button class="button back-button" onclick="window.location.reload()">Sair</button>
    </div>
  `;
  
  document.getElementById('loginForm').style.display = 'none';
  document.body.appendChild(adminSearchPanel);
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

function displayUserHistory(username) {
  const allUsers = JSON.parse(localStorage.getItem('approvedUsers')) || [];
  const user = allUsers.find(u => u.name === username);
  
  if (!user || !user.activityHistory) {
    document.getElementById('searchResults').innerHTML = 'Nenhum histórico encontrado para este usuário.';
    return;
  }

  // Sort history by date, most recent first
  const sortedHistory = [...user.activityHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
  
  const resultsHtml = `
    <div class="user-history">
      <h3>Histórico de ${username}</h3>
      <div class="history-summary">
        <p>Total de Atividades: ${sortedHistory.length}</p>
        <p>Média de Pontuação: ${calculateAverageScore(sortedHistory)}%</p>
        <p>Disciplinas: ${getUniqueSubjects(sortedHistory).map(s => getSubjectDisplayName(s)).join(', ')}</p>
      </div>
      <div class="history-details">
        ${sortedHistory.map((entry, index) => `
          <div class="history-entry">
            <div class="entry-header">
              <h4>${getSubjectDisplayName(entry.subject)}</h4>
              <span class="entry-date">${new Date(entry.date).toLocaleDateString()} ${new Date(entry.date).toLocaleTimeString()}</span>
            </div>
            <div class="entry-details">
              <p>Pontuação: ${entry.score}%</p>
              <p>Tempo: ${entry.timeSpent}</p>
              <button class="button view-details-button" onclick="window.showAdminResultDetails(${index})">
                Ver Detalhes
              </button>
              ${entry.answers ? `
                <div class="answers-section" style="display: none;" id="answers-${index}">
                  <h5>Respostas:</h5>
                  ${entry.answers.map((answer, i) => `
                    <div class="answer-item ${answer.correct ? 'correct' : 'incorrect'}">
                      <p>Questão ${i + 1}: ${answer.question}</p>
                      <p>Resposta dada: ${answer.given}</p>
                      <p>Resposta correta: ${answer.correct_answer}</p>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  
  document.getElementById('searchResults').innerHTML = resultsHtml;

  // Add global function to show details
  window.showAdminResultDetails = (index) => {
    const answersSection = document.getElementById(`answers-${index}`);
    const allAnswersSections = document.querySelectorAll('.answers-section');
    
    // Hide all other sections first
    allAnswersSections.forEach(section => {
      if (section !== answersSection) {
        section.style.display = 'none';
      }
    });
    
    // Toggle current section
    if (answersSection) {
      answersSection.style.display = answersSection.style.display === 'none' ? 'block' : 'none';
      
      // Add download button if showing section
      if (answersSection.style.display === 'block') {
        const downloadButton = document.createElement('button');
        downloadButton.className = 'button download-pdf';
        downloadButton.innerHTML = '<i class="fas fa-download"></i> Baixar PDF';
        downloadButton.onclick = () => downloadAdminResultsPDF(index);
        answersSection.insertBefore(downloadButton, answersSection.firstChild);
      }
    }
  };

  // Add PDF download functionality
  window.downloadAdminResultsPDF = (index) => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const answersSection = document.getElementById(`answers-${index}`);
    const historyEntry = document.querySelector(`.history-entry:nth-child(${index + 1})`);
    
    // Add title and header info
    const subject = historyEntry.querySelector('h4').textContent;
    const date = historyEntry.querySelector('.entry-date').textContent;
    const score = historyEntry.querySelector('.entry-details p:first-child').textContent;
    const time = historyEntry.querySelector('.entry-details p:nth-child(2)').textContent;
    
    doc.setFontSize(16);
    doc.text(`Relatório de Resultados - ${subject}`, 20, 20);
    
    doc.setFontSize(12);
    doc.text(`Data: ${date}`, 20, 35);
    doc.text(score, 20, 45);
    doc.text(time, 20, 55);
    
    // Add answers
    let yPos = 70;
    const answers = answersSection.querySelectorAll('.answer-item');
    answers.forEach((answer, i) => {
      // Add new page if needed
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      
      const isCorrect = answer.classList.contains('correct');
      const questionText = answer.querySelector('p:nth-child(1)').textContent;
      const givenAnswer = answer.querySelector('p:nth-child(2)').textContent;
      const correctAnswer = answer.querySelector('p:nth-child(3)').textContent;
      
      doc.setFontSize(11);
      doc.text(questionText, 20, yPos);
      yPos += 10;
      doc.text(givenAnswer, 25, yPos);
      yPos += 10;
      doc.text(correctAnswer, 25, yPos);
      yPos += 15;
    });
    
    // Save the PDF
    doc.save(`resultados_${subject}_${date.split(' ')[0]}.pdf`);
  };
}

function calculateAverageScore(history) {
  if (!history.length) return 0;
  const total = history.reduce((sum, entry) => sum + entry.score, 0);
  return Math.round(total / history.length);
}

function getUniqueSubjects(history) {
  return [...new Set(history.map(entry => entry.subject))];
}

export function searchUser() {
  const searchInput = document.getElementById('searchInput');
  const username = searchInput.value.trim();
  
  if (!username) {
    alert('Por favor digite um nome de usuário');
    return;
  }
  
  displayUserHistory(username);
}

export function filterResults() {
  const subjectFilter = document.getElementById('subjectFilter').value;
  const searchInput = document.getElementById('searchInput');
  const username = searchInput.value.trim();
  
  if (!username) return;
  
  const allUsers = JSON.parse(localStorage.getItem('approvedUsers')) || [];
  const user = allUsers.find(u => u.name === username);
  
  if (!user || !user.activityHistory) return;
  
  let filteredHistory = user.activityHistory;
  if (subjectFilter) {
    filteredHistory = filteredHistory.filter(entry => entry.subject === subjectFilter);
  }
  
  displayUserHistory(username);
}

function showAdminPanel() {
  const adminPanel = document.createElement('div');
  adminPanel.className = 'admin-panel';
  adminPanel.innerHTML = `
    <div class="admin-header">
      <h2>Painel de Administrador</h2>
    </div>
    <div class="admin-content">
      <div class="admin-nav">
        <button class="admin-button" onclick="window.showUserManagement()">Gerenciar Usuários</button>
        <button class="admin-button" onclick="window.showContentManagement()">Gerenciar Conteúdo</button>
        <button class="admin-button" onclick="window.showReports()">Ver Relatórios</button>
      </div>
      <div id="adminContentArea"></div>
    </div>
    <button class="button back-button" onclick="window.location.reload()">Sair</button>
  `;
  
  document.getElementById('loginForm').style.display = 'none';
  document.body.appendChild(adminPanel);

  // Add window functions for admin actions
  window.showUserManagement = () => {
    const contentArea = document.getElementById('adminContentArea');
    contentArea.innerHTML = `
      <div class="admin-section">
        <h3>Gerenciamento de Usuários</h3>
        <div class="pending-users">
          <h4>Usuários Pendentes</h4>
          ${getPendingUsersHTML()}
        </div>
        <div class="active-users">
          <h4>Usuários Ativos</h4>
          ${getActiveUsersHTML()}
        </div>
      </div>
    `;
    initializeUserManagementHandlers();
  };

  window.showContentManagement = () => {
    const contentArea = document.getElementById('adminContentArea');
    contentArea.innerHTML = `
      <div class="admin-section">
        <h3>Gerenciamento de Conteúdo</h3>
        <div class="content-management">
          <div class="subject-management">
            <h4>Disciplinas</h4>
            <select id="subjectSelect">
              <option value="matematica">Matemática</option>
              <option value="fisica">Física</option>
              <option value="quimica">Química</option>
              <option value="biologia">Biologia</option>
            </select>
            <button class="admin-button" onclick="window.addQuestion()">Adicionar Questão</button>
          </div>
          <div id="questionsList">
            ${getQuestionsListHTML()}
          </div>
        </div>
      </div>
    `;
  };

  window.showReports = () => {
    const contentArea = document.getElementById('adminContentArea');
    contentArea.innerHTML = `
      <div class="admin-section">
        <h3>Relatórios</h3>
        <div class="reports-filters">
          <select id="reportType">
            <option value="performance">Desempenho por Aluno</option>
            <option value="subject">Desempenho por Disciplina</option>
            <option value="activity">Atividade do Sistema</option>
          </select>
          <button class="admin-button" onclick="window.generateReport()">Gerar Relatório</button>
        </div>
        <div id="reportResults"></div>
      </div>
    `;
  };

  // Add handler functions
  window.addQuestion = () => {
    const subject = document.getElementById('subjectSelect').value;
    const questionModal = document.createElement('div');
    questionModal.className = 'modal';
    questionModal.innerHTML = `
      <div class="modal-content">
        <h4>Adicionar Nova Questão</h4>
        <form id="newQuestionForm">
          <textarea placeholder="Pergunta" required></textarea>
          <input type="text" placeholder="Opção 1" required>
          <input type="text" placeholder="Opção 2" required>
          <input type="text" placeholder="Opção 3" required>
          <input type="text" placeholder="Opção 4" required>
          <select required>
            <option value="">Selecione a resposta correta</option>
            <option value="0">Opção 1</option>
            <option value="1">Opção 2</option>
            <option value="2">Opção 3</option>
            <option value="3">Opção 4</option>
          </select>
          <button type="submit" class="admin-button">Salvar</button>
          <button type="button" class="admin-button" onclick="this.closest('.modal').remove()">Cancelar</button>
        </form>
      </div>
    `;
    document.body.appendChild(questionModal);
  };

  window.generateReport = () => {
    const reportType = document.getElementById('reportType').value;
    const reportResults = document.getElementById('reportResults');
    const approvedUsers = JSON.parse(localStorage.getItem('approvedUsers')) || [];
    
    switch(reportType) {
      case 'performance':
        reportResults.innerHTML = generatePerformanceReport(approvedUsers);
        break;
      case 'subject':
        reportResults.innerHTML = generateSubjectReport(approvedUsers);
        break;
      case 'activity':
        reportResults.innerHTML = generateActivityReport(approvedUsers);
        break;
    }
  };
}

function getPendingUsersHTML() {
  const pendingUsers = JSON.parse(localStorage.getItem('pendingUsers')) || [];
  return pendingUsers.length ? pendingUsers.map(user => `
    <div class="pending-item">
      <p><strong>Nome:</strong> ${user.name}</p>
      <p><strong>Email:</strong> ${user.email}</p>
      <p><strong>Nível:</strong> ${user.academicLevel}</p>
      <div class="approval-buttons">
        <button onclick="window.approveUser('${user.name}')" class="approve-button">Aprovar</button>
        <button onclick="window.rejectUser('${user.name}')" class="reject-button">Rejeitar</button>
      </div>
    </div>
  `).join('') : '<p>Nenhum usuário pendente</p>';
}

function getActiveUsersHTML() {
  const approvedUsers = JSON.parse(localStorage.getItem('approvedUsers')) || [];
  return approvedUsers.length ? approvedUsers.map(user => `
    <div class="user-item">
      <p><strong>Nome:</strong> ${user.name}</p>
      <button onclick="window.viewUserDetails('${user.name}')" class="view-details-button">Ver Detalhes</button>
    </div>
  `).join('') : '<p>Nenhum usuário ativo</p>';
}

function getQuestionsListHTML() {
  const questions = JSON.parse(localStorage.getItem('questions')) || {};
  let html = '';
  for (const subject in questions) {
    html += `
      <div class="subject-questions">
        <h4>${getSubjectDisplayName(subject)}</h4>
        ${questions[subject].map((q, i) => `
          <div class="question-item">
            <p><strong>Pergunta ${i + 1}:</strong> ${q.question}</p>
            <button onclick="window.editQuestion('${subject}', ${i})" class="admin-button">Editar</button>
            <button onclick="window.deleteQuestion('${subject}', ${i})" class="admin-button">Excluir</button>
          </div>
        `).join('')}
      </div>
    `;
  }
  return html || '<p>Nenhuma questão cadastrada</p>';
}

function generatePerformanceReport(users) {
  let html = '<h4>Desempenho por Aluno</h4>';
  users.forEach(user => {
    if (user.activityHistory?.length) {
      const avgScore = user.activityHistory.reduce((sum, activity) => sum + activity.score, 0) / user.activityHistory.length;
      html += `
        <div class="report-item">
          <p><strong>${user.name}</strong></p>
          <p>Média: ${avgScore.toFixed(2)}%</p>
          <p>Total de atividades: ${user.activityHistory.length}</p>
        </div>
      `;
    }
  });
  return html || '<p>Nenhum dado disponível</p>';
}

function generateSubjectReport(users) {
  const subjects = {};
  users.forEach(user => {
    user.activityHistory?.forEach(activity => {
      if (!subjects[activity.subject]) {
        subjects[activity.subject] = {
          totalScore: 0,
          count: 0
        };
      }
      subjects[activity.subject].totalScore += activity.score;
      subjects[activity.subject].count++;
    });
  });

  let html = '<h4>Desempenho por Disciplina</h4>';
  for (const subject in subjects) {
    const avgScore = subjects[subject].totalScore / subjects[subject].count;
    html += `
      <div class="report-item">
        <p><strong>${getSubjectDisplayName(subject)}</strong></p>
        <p>Média: ${avgScore.toFixed(2)}%</p>
        <p>Total de tentativas: ${subjects[subject].count}</p>
      </div>
    `;
  }
  return html || '<p>Nenhum dado disponível</p>';
}

function generateActivityReport(users) {
  const activities = users.reduce((acc, user) => acc.concat(
    (user.activityHistory || []).map(activity => ({
      ...activity,
      user: user.name
    }))
  ), []).sort((a, b) => new Date(b.date) - new Date(a.date));

  let html = '<h4>Atividade do Sistema</h4>';
  activities.forEach(activity => {
    html += `
      <div class="report-item">
        <p><strong>${activity.user}</strong> - ${new Date(activity.date).toLocaleString()}</p>
        <p>Disciplina: ${getSubjectDisplayName(activity.subject)}</p>
        <p>Pontuação: ${activity.score}%</p>
      </div>
    `;
  });
  return html || '<p>Nenhuma atividade registrada</p>';
}

function initializeUserManagementHandlers() {
  window.approveUser = (username) => {
    const pendingUsers = JSON.parse(localStorage.getItem('pendingUsers')) || [];
    const approvedUsers = JSON.parse(localStorage.getItem('approvedUsers')) || [];
    const userIndex = pendingUsers.findIndex(u => u.name === username);
    
    if (userIndex >= 0) {
      const user = pendingUsers[userIndex];
      approvedUsers.push(user);
      pendingUsers.splice(userIndex, 1);
      localStorage.setItem('pendingUsers', JSON.stringify(pendingUsers));
      localStorage.setItem('approvedUsers', JSON.stringify(approvedUsers));
      window.showUserManagement();
    }
  };

  window.rejectUser = (username) => {
    const pendingUsers = JSON.parse(localStorage.getItem('pendingUsers')) || [];
    const userIndex = pendingUsers.findIndex(u => u.name === username);
    if (userIndex >= 0) {
      pendingUsers.splice(userIndex, 1);
      localStorage.setItem('pendingUsers', JSON.stringify(pendingUsers));
      window.showUserManagement();
    }
  };

  window.viewUserDetails = (username) => {
    const approvedUsers = JSON.parse(localStorage.getItem('approvedUsers')) || [];
    const user = approvedUsers.find(u => u.name === username);
    if (user) {
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-content">
          <h4>Detalhes do Usuário: ${user.name}</h4>
          <div class="user-details">
            <p><strong>Email:</strong> ${user.email || 'N/A'}</p>
            <p><strong>Nível:</strong> ${user.academicLevel || 'N/A'}</p>
            <p><strong>Total de atividades:</strong> ${user.activityHistory?.length || 0}</p>
          </div>
          <button class="admin-button" onclick="this.closest('.modal').remove()">Fechar</button>
        </div>
      `;
      document.body.appendChild(modal);
    }
  };
}

export function handleRegistration() {
  const username = document.getElementById('regUsername').value;
  const email = document.getElementById('email').value;
  const phone = document.getElementById('phone').value;
  const academicLevel = document.getElementById('academicLevel').value;
  const password = document.getElementById('password').value;

  if (!username || !email || !phone || !academicLevel || !password) {
    alert('Por favor preencha todos os campos');
    return;
  }

  alert('Registro enviado com sucesso! Aguarde a aprovação do administrador.');
  backToLogin();
}

export function showRegistration() {
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('registrationForm').style.display = 'block';
}

export function showPasswordRecovery() {
  const username = prompt('Digite seu nome de usuário para recuperar a senha:');
  if (username) {
    alert('Se o usuário existir, você receberá um email com instruções para recuperar sua senha.');
  }
}

export function backToLogin() {
  document.getElementById('registrationForm').style.display = 'none';
  document.getElementById('loginForm').style.display = 'block';
}

function initializeStudentDashboard() {
  localStorage.setItem('startTime', Date.now().toString());
  updateAnalytics();
  setInterval(updateAnalytics, 1000);
}

function updateAnalytics() {
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

function formatTimeDuration(timeInSeconds) {
  const hours = Math.floor(timeInSeconds / 3600);
  const minutes = Math.floor(timeInSeconds % 3600 / 60);
  const seconds = timeInSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}