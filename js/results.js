export function viewAllResults() {
  const currentUser = JSON.parse(localStorage.getItem('currentUser'));
  if (!currentUser || !currentUser.activityHistory || currentUser.activityHistory.length === 0) {
    alert('Nenhum resultado disponível');
    return;
  }

  const mainMenu = document.getElementById('mainMenu');
  mainMenu.style.display = 'none';

  const studyContent = document.getElementById('studyContent');
  studyContent.style.display = 'block';
  
  // Sort results by date, most recent first
  const sortedResults = [...currentUser.activityHistory].sort((a, b) => 
    new Date(b.date) - new Date(a.date)
  );
  
  studyContent.innerHTML = `
    <h2>Histórico de Resultados</h2>
    <div class="results-container">
      <div class="history-summary">
        <p>Total de Atividades: ${sortedResults.length}</p>
        <p>Média de Pontuação: ${calculateAverageScore(sortedResults)}%</p>
        <p>Disciplinas: ${getUniqueSubjects(sortedResults).map(s => getSubjectDisplayName(s)).join(', ')}</p>
      </div>
      ${sortedResults.map((result, index) => `
        <div class="result-card">
          <h3>${getSubjectDisplayName(result.subject)}</h3>
          <div class="result-details">
            <p>Data: ${new Date(result.date).toLocaleDateString()} ${new Date(result.date).toLocaleTimeString()}</p>
            <p>Pontuação: ${result.score}%</p>
            <p>Questões Respondidas: ${result.questionsAnswered}</p>
            <p>Tempo Gasto: ${result.timeSpent}</p>
            <button class="button view-details-button" onclick="window.showResultDetails(${index})">
              Ver Detalhes
            </button>
          </div>
        </div>
      `).join('')}
    </div>
    <button class="button back-button" onclick="window.returnToMainMenu()">Voltar ao Menu</button>
  `;

  initializeResultDetailsModal();

  window.showResultDetails = (index) => {
    const result = sortedResults[index];
    const modal = document.getElementById('resultDetailsModal');
    const modalContent = modal.querySelector('#modalContent');
    
    modalContent.innerHTML = `
      <h3 class="modal-title">${getSubjectDisplayName(result.subject)} - ${new Date(result.date).toLocaleDateString()}</h3>
      <div class="results-summary">
        <p><strong>Pontuação Final:</strong> ${result.score}%</p>
        <p><strong>Tempo Total:</strong> ${result.timeSpent}</p>
      </div>
      <div class="answers-details">
        <h4>Detalhes das Respostas</h4>
        ${result.answers ? result.answers.map((answer, i) => `
          <div class="question-section">
            <div class="question-header">
              <h5>Questão ${i + 1}</h5>
              <span class="result-badge ${answer.correct ? 'correct' : 'incorrect'}">
                ${answer.correct ? 'Correta' : 'Incorreta'}
              </span>
            </div>
            <div class="question-content">
              <p class="question-text"><strong>Pergunta:</strong> ${answer.question}</p>
              <div class="answers-grid">
                <div class="answer-box ${answer.given === answer.correct_answer ? 'correct-answer' : 'wrong-answer'}">
                  <strong>Sua Resposta:</strong>
                  <p>${answer.given}</p>
                </div>
                <div class="answer-box correct-answer">
                  <strong>Resposta Correta:</strong>
                  <p>${answer.correct_answer}</p>
                </div>
              </div>
            </div>
          </div>
        `).join('') : '<p>Nenhum detalhe disponível para esta sessão</p>'}
      </div>
    `;
    
    modal.style.display = 'block';
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

function initializeResultDetailsModal() {
  let modal = document.getElementById('resultDetailsModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'answer-modal';
    modal.id = 'resultDetailsModal';
    modal.innerHTML = `
      <div class="answer-content">
        <span class="close-modal">&times;</span>
        <div class="modal-actions">
          <button class="button download-pdf" onclick="window.downloadResultsPDF()">
            <i class="fas fa-download"></i> Baixar PDF
          </button>
        </div>
        <div id="modalContent"></div>
      </div>
    `;
    document.body.appendChild(modal);

    const closeBtn = modal.querySelector('.close-modal');
    closeBtn.onclick = () => modal.style.display = 'none';
    
    window.onclick = (event) => {
      if (event.target == modal) {
        modal.style.display = 'none';
      }
    };

    // Add PDF download functionality
    window.downloadResultsPDF = () => {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      const content = document.getElementById('modalContent');
      
      // Add title
      const title = content.querySelector('.modal-title').textContent;
      doc.setFontSize(16);
      doc.text(title, 20, 20);
      
      // Add summary
      const summary = content.querySelector('.results-summary');
      doc.setFontSize(12);
      let yPos = 40;
      summary.querySelectorAll('p').forEach(p => {
        doc.text(p.textContent, 20, yPos);
        yPos += 10;
      });
      
      // Add questions and answers
      yPos += 10;
      doc.setFontSize(14);
      doc.text('Detalhes das Respostas:', 20, yPos);
      
      const questions = content.querySelectorAll('.question-section');
      questions.forEach((q, index) => {
        yPos += 20;
        
        // Add new page if needed
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        
        // Question number and text
        const questionNum = q.querySelector('h5').textContent;
        const questionText = q.querySelector('.question-text').textContent;
        doc.setFontSize(12);
        doc.text(`${questionNum}`, 20, yPos);
        doc.text(questionText, 20, yPos + 7);
        
        // Answers
        const answers = q.querySelectorAll('.answer-box');
        answers.forEach(answer => {
          yPos += 15;
          const isCorrect = answer.classList.contains('correct-answer');
          const text = answer.textContent;
          doc.text(`${isCorrect ? '✓' : '✗'} ${text}`, 25, yPos);
        });
      });
      
      // Save the PDF
      doc.save(`resultados_${new Date().toISOString().split('T')[0]}.pdf`);
    };
  }
}

function getSubjectDisplayName(subject) {
  const displayNames = {
    matematica: 'Matemática',
    fisica: 'Física',
    quimica: 'Química',
    biologia: 'Biologia',
    geologia: 'Geologia',
    astronomia: 'Astronomia',
    estatistica: 'Estatística',
    informatica: 'Informática/Computação',
    engenharia: 'Engenharia',
    historia: 'História',
    geografia: 'Geografia',
    sociologia: 'Sociologia',
    filosofia: 'Filosofia',
    psicologia: 'Psicologia',
    antropologia: 'Antropologia',
    politica: 'Ciência Política',
    economia: 'Economia',
    direito: 'Direito',
    teologia: 'Teologia',
    portugues: 'Língua Portuguesa',
    ingles: 'Língua Inglesa',
    biblia: 'Estudo Bíblico',
    literatura: 'Literatura',
    comunicacao: 'Comunicação Social',
    linguistica: 'Linguística',
    redacao: 'Redação',
    artes: 'Artes Visuais',
    musica: 'Música',
    teatro: 'Teatro',
    cinema: 'Cinema',
    medicina: 'Medicina',
    enfermagem: 'Enfermagem',
    farmacia: 'Farmácia',
    odontologia: 'Odontologia',
    nutricao: 'Nutrição',
    fisioterapia: 'Fisioterapia',
    educacaoFisica: 'Educação Física',
    saude: 'Saúde Pública',
    administracao: 'Administração',
    contabilidade: 'Contabilidade',
    marketing: 'Marketing',
    rh: 'Gestão de RH',
    comercio: 'Comércio Internacional',
    turismo: 'Turismo e Hotelaria',
    agronomia: 'Agronomia',
    arquitetura: 'Arquitetura',
    logistica: 'Logística',
    pedagogia: 'Pedagogia',
    didatica: 'Didática',
    psicopedagogia: 'Psicopedagogia',
    educacaoEspecial: 'Educação Especial',
    metodologia: 'Metodologia de Ensino',
    programacao: 'Programação',
    ia: 'Inteligência Artificial',
    web: 'Desenvolvimento Web',
    bancoDados: 'Banco de Dados',
    redes: 'Redes de Computadores',
    robotica: 'Robótica',
    seguranca: 'Cibersegurança',
    etica: 'Ética',
    sustentabilidade: 'Sustentabilidade',
    ambiente: 'Estudos Ambientais',
    cultura: 'Cultura e Sociedade',
    financeira: 'Educação Financeira',
    design: 'Design Gráfico',
    moda: 'Moda e Estilo'
  };
  return displayNames[subject] || subject;
}