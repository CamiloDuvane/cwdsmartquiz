import { getUserPermissions } from './permissions.js';
import { db } from '../firebase-config.js';
import { collection, addDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";

// Add state management variables at the top
let currentQuestion = 0;
let score = 0;
let selectedOptionIndex = -1;
let startTime;
let selectedAnswers = [];
let currentQuestions = [];

export function showQuizContent() {
  const mainMenu = document.getElementById('mainMenu');
  const footer = document.querySelector('.footer');
  const subjectSelection = document.getElementById('subjectSelection');
  const studentHeader = document.querySelector('.student-header');

  // Make sure all elements exist before trying to access them
  if (mainMenu) mainMenu.style.display = 'none';
  if (footer) footer.style.display = 'none';
  if (subjectSelection) {
    subjectSelection.style.display = 'grid';
    subjectSelection.innerHTML = `
      <div style="grid-column: 1 / -1">
        <h2>Questionários</h2>
        <button class="button back-button" onclick="window.returnToMainMenu()">Voltar</button>
      </div>
    `;
    
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (currentUser) {
      const userPermissions = getUserPermissions(currentUser.name);
      const subjects = ['matematica', 'fisica', 'quimica', 'biologia'];
      
      subjects.forEach(subject => {
        if (userPermissions.quiz.includes(subject)) {
          const card = document.createElement('div');
          card.className = `subject-card ${subject}`;
          card.onclick = () => selectSubject(subject);
          card.textContent = getSubjectDisplayName(subject);
          subjectSelection.appendChild(card);
        }
      });
    }
  }
  if (studentHeader) studentHeader.style.display = 'none';
}

export function selectSubject(subject) {
  localStorage.setItem('currentSubject', subject);
  const currentUser = JSON.parse(localStorage.getItem('currentUser'));
  const userPermissions = getUserPermissions(currentUser.name);
  
  if (!userPermissions.quiz.includes(subject)) {
    alert('Você não tem permissão para acessar esta disciplina');
    return;
  }
  
  const subjectSelection = document.getElementById('subjectSelection');
  const questionContainer = document.getElementById('questionContainer');
  
  if (subjectSelection) subjectSelection.style.display = 'none';
  if (questionContainer) questionContainer.style.display = 'block';
  
  // Reset quiz state
  currentQuestion = 0;
  score = 0;
  selectedOptionIndex = -1;
  startTime = new Date();
  selectedAnswers = [];
  
  // Get questions for the selected subject
  currentQuestions = getQuestionsBySubject(subject);
  
  showQuestion(0);
}

function showQuestion(index) {
  if (!currentQuestions || currentQuestions.length === 0) {
    alert('Não há questões disponíveis para esta disciplina no momento.');
    returnToSubjects();
    return;
  }

  const questionContainer = document.getElementById('questionContainer');
  const questionText = document.getElementById('questionText');
  const optionsContainer = document.getElementById('options');
  const progressFill = document.getElementById('progressFill');
  
  if (questionContainer) questionContainer.style.display = 'block';
  if (questionText) questionText.textContent = currentQuestions[index].question;
  if (optionsContainer) {
    optionsContainer.innerHTML = '';
    currentQuestions[index].options.forEach((option, i) => {
      const button = document.createElement('button');
      button.className = 'option';
      button.textContent = option;
      button.onclick = () => {
        const options = optionsContainer.getElementsByClassName('option');
        Array.from(options).forEach(opt => opt.classList.remove('selected'));
        button.classList.add('selected');
        selectedOptionIndex = i;
      };
      optionsContainer.appendChild(button);
    });
  }
  
  if (progressFill) {
    progressFill.style.width = `${(index / currentQuestions.length) * 100}%`;
  }
}

export function submitAnswer() {
  if (selectedOptionIndex === -1) {
    alert('Por favor selecione uma opção');
    return;
  }
  
  if (!currentQuestions || currentQuestion >= currentQuestions.length) {
    console.error('Invalid question state');
    return;
  }
  
  // Store the selected answer
  selectedAnswers[currentQuestion] = selectedOptionIndex;
  
  if (selectedOptionIndex === currentQuestions[currentQuestion].correct) {
    score++;
  }
  
  currentQuestion++;
  selectedOptionIndex = -1;
  
  if (currentQuestion < currentQuestions.length) {
    showQuestion(currentQuestion);
  } else {
    finishQuiz();
  }
}

async function finishQuiz() {
  const currentSubject = localStorage.getItem('currentSubject');
  const finalScore = Math.round((score / currentQuestions.length) * 100);
  const endTime = new Date();
  const timeSpent = Math.floor((endTime - startTime) / 1000);
  
  // Create result object with answers history
  const result = {
    subject: currentSubject,
    score: finalScore,
    date: new Date().toISOString(),
    timeSpent: formatTimeDuration(timeSpent),
    questionsAnswered: currentQuestions.length,
    answers: currentQuestions.map((q, index) => ({
      question: q.question,
      given: q.options[selectedAnswers[index] || 0], 
      correct_answer: q.options[q.correct],
      correct: selectedAnswers[index] === q.correct
    }))
  };

  const currentUser = JSON.parse(localStorage.getItem('currentUser'));
  
  if (currentUser) {
    try {
      // Save to Firestore
      const quizResultsRef = collection(db, 'quizResults');
      const docRef = await addDoc(quizResultsRef, {
        userId: currentUser.name,
        timestamp: new Date(),
        ...result
      });
      
      console.log("Quiz result saved to Firebase with ID: ", docRef.id);
      
      // Also update local storage for immediate access
      const approvedUsers = JSON.parse(localStorage.getItem('approvedUsers')) || [];
      const userIndex = approvedUsers.findIndex(u => u.name === currentUser.name);
      
      if (userIndex >= 0) {
        approvedUsers[userIndex].activityHistory = approvedUsers[userIndex].activityHistory || [];
        approvedUsers[userIndex].activityHistory.push(result);
        localStorage.setItem('approvedUsers', JSON.stringify(approvedUsers));
      }
      
      currentUser.activityHistory = currentUser.activityHistory || [];
      currentUser.activityHistory.push(result);
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
      
      alert(`Quiz finalizado!\nPontuação: ${finalScore}%\nTempo gasto: ${formatTimeDuration(timeSpent)}\nResultados salvos com sucesso!`);
    } catch (error) {
      console.error("Error saving quiz results: ", error);
      alert('Erro ao salvar os resultados. Por favor, tente novamente.');
    }
  }

  // Reset quiz state and return to subjects
  currentQuestion = 0;
  score = 0;
  selectedOptionIndex = -1;
  selectedAnswers = [];
  currentQuestions = [];
  
  showQuizContent();
}

export async function getQuizResults(username) {
  try {
    // Get results from Firestore
    const quizResultsRef = collection(db, 'quizResults');
    const q = query(quizResultsRef, where("userId", "==", username));
    const querySnapshot = await getDocs(q);
    
    const results = [];
    querySnapshot.forEach((doc) => {
      results.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return results;
  } catch (error) {
    console.error("Error getting quiz results: ", error);
    return [];
  }
}

export function returnToSubjects() {
  const questionContainer = document.getElementById('questionContainer');
  const subjectSelection = document.getElementById('subjectSelection');
  
  if (questionContainer) questionContainer.style.display = 'none';
  if (subjectSelection) subjectSelection.style.display = 'grid';
  
  showQuizContent();
}

function getQuestionsBySubject(subject) {
  const questionsBySubject = {
    matematica: [
      {
        question: "Quanto é 2 + 2?",
        options: ["3", "4", "5", "6"],
        correct: 1
      },
      {
        question: "Qual é a raiz quadrada de 16?",
        options: ["2", "4", "6", "8"],
        correct: 1
      },
      {
        question: "Qual é o resultado de 3 × 4?",
        options: ["10", "11", "12", "13"],
        correct: 2
      }
    ],
    fisica: [
      {
        question: "Qual é a unidade de medida da força?",
        options: ["Newton", "Watt", "Joule", "Pascal"],
        correct: 0
      },
      {
        question: "Qual é a fórmula da velocidade média?",
        options: ["v = d/t", "v = t/d", "v = d×t", "v = d+t"],
        correct: 0
      }
    ],
    quimica: [
      {
        question: "Qual é o símbolo químico do ouro?",
        options: ["Au", "Ag", "Fe", "Cu"],
        correct: 0
      },
      {
        question: "Qual é o número atômico do hidrogênio?",
        options: ["1", "2", "3", "4"],
        correct: 0
      }
    ],
    biologia: [
      {
        question: "Qual é a menor unidade funcional dos seres vivos?",
        options: ["Célula", "Átomo", "Molécula", "Tecido"],
        correct: 0
      },
      {
        question: "Qual é o principal processo de obtenção de energia das plantas?",
        options: ["Fotossíntese", "Respiração", "Digestão", "Fermentação"],
        correct: 0
      }
    ]
  };
  return questionsBySubject[subject] || [];
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

function formatTimeDuration(timeInSeconds) {
  const hours = Math.floor(timeInSeconds / 3600);
  const minutes = Math.floor(timeInSeconds % 3600 / 60);
  const seconds = timeInSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}