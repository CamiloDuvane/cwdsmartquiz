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
    matematica: [{
      question: "Qual é a área de um triângulo com base de 8 cm e altura de 5 cm?",
      options: ["20 cm²", "30 cm²", "40 cm²", "25 cm²"],
      correct: 3
    }, {
      question: "Resolva: 3x + 2 = 11. Qual é o valor de x?",
      options: ["2", "3", "4", "5"],
      correct: 1
    }, {
      question: "Qual é o valor de 7²?",
      options: ["14", "49", "21", "42"],
      correct: 1
    }, {
      question: "Qual é o perímetro de um quadrado com lado de 6 cm?",
      options: ["24 cm", "36 cm", "12 cm", "18 cm"],
      correct: 0
    }, {
      question: "Resolva: 4x - 8 = 0. Qual é o valor de x?",
      options: ["1", "2", "3", "4"],
      correct: 1
    }, {
      question: "Qual é o valor de √64?",
      options: ["6", "7", "8", "9"],
      correct: 2
    }, {
      question: "Se um círculo tem um raio de 7 cm, qual é a sua área? (π ≈ 3,14)",
      options: ["153,86 cm²", "140 cm²", "160 cm²", "170 cm²"],
      correct: 0
    }, {
      question: "Resolva: 2(x - 3) = 8. Qual é o valor de x?",
      options: ["5", "6", "7", "8"],
      correct: 2
    }, {
      question: "Qual é a forma geométrica que possui 6 faces quadradas iguais?",
      options: ["Cubo", "Cilindro", "Esfera", "Cone"],
      correct: 0
    }, {
      question: "Quantos graus tem um ângulo reto?",
      options: ["45°", "90°", "120°", "180°"],
      correct: 1
    }, {
      question: "Qual é a soma dos ângulos internos de um triângulo?",
      options: ["90°", "180°", "270°", "360°"],
      correct: 1
    }, {
      question: "Quanto é 15% de 200?",
      options: ["15", "30", "20", "25"],
      correct: 1
    }, {
      question: "Qual é o valor de 3³?",
      options: ["6", "9", "27", "81"],
      correct: 2
    }, {
      question: "Quantos lados tem um hexágono?",
      options: ["4", "5", "6", "7"],
      correct: 2
    }, {
  question: "Resolva: 5x = 25. Qual é o valor de x?",
      options: ["3", "4", "5", "6"],
      correct: 2
    }, {
      question: "Qual é a fórmula da área de um círculo?",
      options: ["πr", "2πr", "πr²", "2πr²"],
      correct: 2
    }, {
      question: "Qual é a raiz quadrada de 81?",
      options: ["7", "8", "9", "10"],
      correct: 2
    }, {
      question: "Quanto é 100 ÷ 4?",
      options: ["20", "25", "30", "40"],
      correct: 1
    }, {
      question: "Um triângulo com dois lados iguais é chamado de:",
      options: ["Equilátero", "Isósceles", "Escaleno", "Retângulo"],
      correct: 1
    }, {
      question: "Quantos segundos há em uma hora?",
      options: ["3600", "2400", "1800", "1200"],
      correct: 0
    }, {
      question: "Qual é o menor número primo?",
      options: ["0", "1", "2", "3"],
      correct: 2
    }, {
      question: "Quanto é 7 x 8?",
      options: ["48", "54", "56", "64"],
      correct: 2
    }, {
      question: "Qual é o volume de um cubo com aresta de 5 cm?",
      options: ["25 cm³", "100 cm³", "125 cm³", "150 cm³"],
      correct: 2
    }, {
      question: "Qual é o valor de 2² + 3²?",
      options: ["9", "13", "14", "18"],
      correct: 1
    }, {
      question: "Quanto é 1/4 + 1/2?",
      options: ["1/2", "3/4", "1", "5/4"],
      correct: 1
    }, {
      question: "Se um retângulo tem 5 cm de largura e 10 cm de comprimento, qual é sua área?",
      options: ["15 cm²", "25 cm²", "50 cm²", "75 cm²"],
      correct: 2
    }, {
      question: "Quantos lados tem um dodecágono?",
      options: ["8", "10", "12", "14"],
      correct: 2
    }, {
      question: "Se x = 3, qual é o valor de 2x + 5?",
      options: ["8", "9", "10", "11"],
      correct: 3
    }, {
      question: "Qual é o nome da figura com 4 lados iguais e 4 ângulos retos?",
      options: ["Quadrado", "Retângulo", "Losango", "Trapézio"],
      correct: 0
    }, {
      question: "Quanto é 0,2 x 0,5?",
      options: ["0,01", "0,1", "0,2", "0,25"],
      correct: 3
    }, {
      question: "Qual é o maior divisor comum de 18 e 24?",
      options: ["2", "3", "6", "9"],
      correct: 2
    }, {
      question: "Quanto é 2⁵?",
      options: ["16", "25", "32", "64"],
      correct: 2
    }, {
      question: "Resolva: 10 - (2 + 3).",
      options: ["3", "4", "5", "6"],
      correct: 1
    }, {
      question: "Se 1 metro = 100 cm, quantos centímetros há em 2,5 metros?",
      options: ["200 cm", "250 cm", "300 cm", "350 cm"],
      correct: 1
    }, {
      question: "Quanto é 5! (fatorial de 5)?",
      options: ["20", "60", "100", "120"],
      correct: 3
}, {
      question: "Resolva: x/4 = 6. Qual é o valor de x?",
      options: ["12", "16", "20", "24"],
      correct: 3
    }, {
      question: "Quanto é a metade de 3/4?",
      options: ["1/8", "3/8", "1/2", "5/8"],
      correct: 1
    }, {
      question: "Qual é o nome do polígono com 8 lados?",
      options: ["Pentágono", "Heptágono", "Octógono", "Decágono"],
      correct: 2
    }, {
      question: "Qual é a área de um quadrado com lado de 9 cm?",
      options: ["18 cm²", "36 cm²", "45 cm²", "81 cm²"],
      correct: 3
    }, {
      question: "Resolva: 3² + 4².",
      options: ["12", "16", "25", "32"],
      correct: 2
    }, {
      question: "Quanto é 3/4 de 16?",
      options: ["8", "10", "12", "14"],
      correct: 2
    }, {
      question: "Qual é o valor de 100% de 50?",
      options: ["25", "50", "75", "100"],
      correct: 1
    }, {
      question: "Quanto é 1/3 + 1/6?",
      options: ["1/6", "1/3", "1/2", "2/3"],
      correct: 2
    }, {
      question: "Se um ângulo mede 45°, qual é o seu ângulo complementar?",
      options: ["45°", "90°", "135°", "180°"],
      correct: 0
    }, {
      question: "Qual é o valor de 8²?",
      options: ["48", "56", "64", "72"],
      correct: 2
    }, {
      question: "Quanto é 0,01 x 1000?",
      options: ["0,1", "1", "10", "100"],
      correct: 1
    }, {
      question: "Quantos minutos há em 1,5 horas?",
      options: ["60", "75", "90", "120"],
      correct: 2
    }, {
      question: "Resolva: 2x - 5 = 9. Qual é o valor de x?",
      options: ["5", "6", "7", "8"],
      correct: 2
    }, {
      question: "Quanto é 1² + 2² + 3²?",
      options: ["9", "12", "14", "16"],
      correct: 2
    }],

    portugues: [{
      question: "Identifique o substantivo abstrato na frase: 'A felicidade é uma conquista diária.'",
      options: ["Felicidade", "Conquista", "Diária", "Nenhuma das anteriores"],
      correct: 0
    }, {
      question: "Qual é a função da palavra 'rápido' em: 'Ele foi rápido para concluir a tarefa.'?",
      options: ["Substantivo", "Adjetivo", "Verbo", "Advérbio"],
      correct: 1
    }, {
      question: "Qual é o plural de 'pão'?",
      options: ["Pães", "Pãos", "Pões", "Paes"],
      correct: 0
    }, {
      question: "Complete a frase: 'Eu ________ estudar mais.'",
      options: ["devemos", "deveria", "dever", "deverei"],
      correct: 1
    }, {
      question: "Qual das frases contém uma metáfora?",
      options: ["Ele é forte como um leão", "A vida é um palco", "Estava tão feliz que parecia flutuar", "Estava tão quente quanto o deserto"],
      correct: 1
    }, {
      question: "Qual é o sujeito na frase: 'Os alunos estudam para o exame final'?",
      options: ["Os alunos", "Estudam", "Exame final", "Para o exame"],
      correct: 0
    }, {
      question: "Classifique a oração: 'Quando cheguei, ele já tinha saído.'",
      options: ["Coordenada", "Subordinada", "Simples", "Nominal"],
      correct: 1
    }, {
      question: "Identifique o verbo transitivo direto: 'Ela comprou um livro novo.'",
      options: ["Ela", "Comprou", "Livro", "Novo"],
      correct: 1
    }, {
      question: "Qual é o tempo verbal de 'Nós estudaremos juntos amanhã'?",
      options: ["Presente", "Passado", "Futuro do Presente", "Futuro do Pretérito"],
      correct: 2
    }, {
      question: "O que é uma interjeição?",
      options: ["Palavra que expressa emoção ou sentimento", "Palavra que liga orações", "Palavra que determina o verbo", "Palavra que indica lugar"],
      correct: 0
    }, {
      question: "Qual é o sujeito na frase: 'Os alunos estudam na biblioteca.'?",
      options: ["Os alunos", "Estudam", "Na biblioteca", "Os alunos estudam"],
      correct: 0
    }, {
      question: "Qual é o tipo de predicado na frase: 'A menina é inteligente.'?",
      options: ["Verbal", "Nominal", "Verbo-nominal", "Predicativo"],
      correct: 1
    }, {
      question: "Qual é o plural de 'cidadão'?",
      options: ["Cidadões", "Cidadãos", "Cidades", "Cidadãoses"],
      correct: 1
    }, {
      question: "Qual é o antônimo de 'feliz'?",
      options: ["Triste", "Contente", "Alegre", "Descontraído"],
      correct: 0
    }, {
      question: "O que é um texto dissertativo argumentativo?",
      options: ["Um texto que narra fatos", "Um texto que descreve pessoas", "Um texto que apresenta argumentos para defender uma tese", "Um texto que explica um processo"],
      correct: 2
    }, {
      question: "Qual é o significado da palavra 'procrastinar'?",
      options: ["Antecipar", "Adiar", "Resolver", "Confirmar"],
      correct: 1
    }, {
      question: "Qual é a figura de linguagem usada na frase: 'O vento sussurrava entre as árvores'?",
      options: ["Metáfora", "Personificação", "Ironia", "Eufemismo"],
      correct: 1
    }, {
      question: "Qual é o verbo da frase: 'Nós compramos um presente ontem'?",
      options: ["Compramos", "Um", "Presente", "Ontem"],
      correct: 0
    }, {
      question: "Qual é o significado da expressão 'ficar de molho'?",
      options: ["Tomar banho", "Estar em repouso", "Estar cozinhando", "Estar em apuros"],
      correct: 1
    }, {
      question: "O que indica o prefixo 're-' na palavra 'rever'?",
      options: ["Novidade", "Repetição", "Contrário", "Positividade"],
      correct: 1
    }, {
      question: "Qual é o tempo verbal na frase: 'Eles estavam brincando no parque.'?",
      options: ["Presente", "Pretérito perfeito", "Pretérito imperfeito", "Futuro do presente"],
      correct: 2
    }, {
      question: "Qual é o gênero do substantivo 'análise'?",
      options: ["Masculino", "Feminino", "Neutro", "Ambíguo"],
      correct: 1
    }, {
      question: "Qual é a função da vírgula na frase: 'João, venha aqui agora.'?",
      options: ["Separar termos iguais", "Indicar uma pausa", "Separar o vocativo", "Marcar uma enumeração"],
      correct: 2
    }, {
      question: "Qual é a classificação da palavra 'felizmente'?",
      options: ["Substantivo", "Adjetivo", "Advérbio", "Verbo"],
      correct: 2
    }, {
      question: "Qual é o termo que complementa o verbo na frase: 'Nós assistimos ao filme.'?",
      options: ["Objeto direto", "Objeto indireto", "Adjunto adverbial", "Sujeito"],
      correct: 1
    }, {
      question: "Qual é o tipo de discurso usado na frase: 'Maria disse: 'Eu não quero ir ao parque'.'?",
      options: ["Discurso direto", "Discurso indireto", "Discurso indireto livre", "Discurso narrativo"],
      correct: 0
    }, {
      question: "Qual é o significado da palavra 'altruísmo'?",
      options: ["Egoísmo", "Solidariedade", "Alegria", "Indiferença"],
      correct: 1
    }, {
      question: "Qual é a figura de linguagem em 'Ele era forte como um touro'?",
      options: ["Metáfora", "Comparação", "Ironia", "Personificação"],
      correct: 1
    }, {
      question: "Qual é o plural de 'caráter'?",
      options: ["Caráteres", "Caratares", "Carateis", "Caratazes"],
      correct: 0
    }, {
      question: "Qual é o sinônimo de 'cômico'?",
      options: ["Trágico", "Engraçado", "Sério", "Neutro"],
      correct: 1
    }],

    historia: [{
      question: "Quem foi o primeiro presidente de Moçambique independente?",
      options: ["Joaquim Chissano", "Samora Machel", "Eduardo Mondlane", "Filipe Nyusi"],
      correct: 1
    }, {
      question: "Em que ano Moçambique conquistou sua independência?",
      options: ["1974", "1975", "1977", "1980"],
      correct: 1
    }, {
      question: "Qual foi o principal movimento de libertação nacional em Moçambique?",
      options: ["RENAMO", "FRELIMO", "MPLA", "PAIGC"],
      correct: 1
    }, {
      question: "Quem foi o fundador da FRELIMO?",
      options: ["Filipe Nyusi", "Eduardo Mondlane", "Samora Machel", "Joaquim Chissano"],
      correct: 1
    }, {
      question: "Qual é a data da assinatura do Acordo Geral de Paz?",
      options: ["4 de outubro de 1992", "7 de setembro de 1974", "25 de junho de 1975", "1 de dezembro de 1990"],
      correct: 0
    }, {
      question: "Quando Moçambique se tornou independente de Portugal?",
      options: ["1975", "1964", "1980", "1992"],
      correct: 0
    }, {
      question: "Qual foi o principal movimento de libertação em Moçambique?",
      options: ["FRELIMO", "RENAMO", "ANC", "MPLA"],
      correct: 0
    }, {
      question: "Quem foi o primeiro presidente de Moçambique independente?",
      options: ["Samora Machel", "Eduardo Mondlane", "Joaquim Chissano", "Filipe Nyusi"],
      correct: 0
    }, {
      question: "Qual foi o principal motivo para a luta de libertação de Moçambique?",
      options: ["Independência política", "Fim da escravidão", "Unificação de territórios", "Abolição da monarquia"],
      correct: 0
    }, {
      question: "Em que ano a FRELIMO foi fundada?",
      options: ["1962", "1964", "1970", "1975"],
      correct: 0
    }, {
      question: "Quem foi Eduardo Mondlane?",
      options: ["Fundador da FRELIMO", "Primeiro presidente de Moçambique", "Líder da RENAMO", "Governador colonial"],
      correct: 0
    }, {
      question: "Qual foi o acordo que encerrou a Guerra Civil em Moçambique?",
      options: ["Acordo de Lusaka", "Acordo de Roma", "Acordo de Nkomati", "Acordo de Maputo"],
      correct: 1
    }, {
      question: "Quando foi assinada a paz entre o governo moçambicano e a RENAMO?",
      options: ["1992", "1985", "2000", "1975"],
      correct: 0
    }, {
      question: "Qual era o principal recurso explorado pelos colonizadores em Moçambique?",
      options: ["Ouro", "Algodão", "Madeira", "Marfim"],
      correct: 1
    }, {
      question: "Qual foi o impacto do sistema colonial português na agricultura moçambicana?",
      options: ["Promoveu a agricultura de subsistência", "Introduziu a monocultura forçada", "Favoreceu pequenos agricultores", "Erradicou a fome"],
      correct: 1
    }, {
      question: "O que era o sistema de trabalho forçado em Moçambique durante a colonização?",
      options: ["Sistema de escravidão", "Trabalho compulsório em plantações", "Contrato de trabalho justo", "Emprego para todos"],
      correct: 1
    }, {
      question: "Qual foi o papel da guerrilha na luta pela independência de Moçambique?",
      options: ["Conquistar áreas estratégicas", "Negociar com Portugal", "Unir os partidos políticos", "Difundir a cultura local"],
      correct: 0
    }, {
      question: "Quem assinou o Acordo de Lusaka em 1974?",
      options: ["FRELIMO e Portugal", "RENAMO e FRELIMO", "Portugal e ONU", "Moçambique e África do Sul"],
      correct: 0
    }, {
      question: "Qual foi a capital de Moçambique antes da independência?",
      options: ["Lourenço Marques", "Maputo", "Beira", "Nampula"],
      correct: 0
    }, {
      question: "Qual foi o efeito da Guerra Fria em Moçambique?",
      options: ["Intensificou a Guerra Civil", "Encerrou a luta de libertação", "Isolou o país", "Favoreceu o comércio"],
      correct: 0
    }, {
      question: "O que representou a proclamação da independência de Moçambique?",
      options: ["Fim do colonialismo português", "Início da escravidão", "Separação de regiões", "Unificação de países africanos"],
      correct: 0
    }, {
      question: "Em que ano Samora Machel faleceu?",
      options: ["1986", "1980", "1992", "1975"],
      correct: 0
    }, {
      question: "Em que ano Samora Machel faleceu?",
      options: ["1986", "1980", "1992", "1975"],
      correct: 0
    }, {
      question: "Qual foi o principal desafio após a independência de Moçambique?",
      options: ["Reconstrução nacional", "Fim do comércio internacional", "Expansão territorial", "Colonização interna"],
      correct: 0
    }, {
      question: "Quem sucedeu Samora Machel como presidente de Moçambique?",
      options: ["Joaquim Chissano", "Filipe Nyusi", "Eduardo Mondlane", "Armando Guebuza"],
      correct: 0
    }, {
      question: "O que foi o Programa de Ajustamento Estrutural em Moçambique?",
      options: ["Reforma econômica", "Plano de guerra", "Acordo de paz", "Projeto de saúde"],
      correct: 0
    }, {
      question: "Quem foi André Matsangaissa?",
      options: ["Primeiro líder da RENAMO", "Fundador da FRELIMO", "Presidente de Moçambique", "Governador colonial"],
      correct: 0
    }, {
      question: "Qual era o objetivo da RENAMO durante a Guerra Civil?",
      options: ["Tomar o poder", "Manter a paz", "Abolir a independência", "Unificar a África"],
      correct: 0
    }, {
      question: "Qual foi o papel da ONU no processo de paz em Moçambique?",
      options: ["Supervisionar o cessar-fogo", "Financiar a guerra", "Apoiar a colonização", "Organizar eleições"],
      correct: 0
    }, {
      question: "O que simboliza a bandeira de Moçambique?",
      options: ["Luta e esperança", "Colonização", "Independência europeia", "Neutralidade"],
      correct: 0
    }, {
      question: "Qual foi o impacto da Guerra Civil na economia moçambicana?",
      options: ["Destruição de infraestruturas", "Aumento da produção", "Fortalecimento do comércio", "Melhora na educação"],
      correct: 0
    }, {
      question: "Quando foram realizadas as primeiras eleições multipartidárias em Moçambique?",
      options: ["1994", "1992", "1986", "2000"],
      correct: 0
    }, {
      question: "Qual é a principal língua oficial de Moçambique?",
      options: ["Português", "Inglês", "Swahili", "Xangana"],
      correct: 0
    }, {
      question: "Qual foi a importância de Mondlane no contexto histórico de Moçambique?",
      options: ["Articulou a luta de libertação", "Governou o país após a independência", "Liderou a guerrilha da RENAMO", "Organizou a economia pós-guerra"],
      correct: 0
    }, {
      question: "Quem colonizou Moçambique antes de Portugal?",
      options: ["Árabes", "Ingleses", "Chineses", "Espanhóis"],
      correct: 0
    }, {
      question: "O que foi o Tratado de Lourenço Marques?",
      options: ["Acordo entre portugueses e ingleses", "Independência de Moçambique", "Divisão territorial africana", "Pacto de comércio"],
      correct: 0
    }, {
      question: "Qual foi o papel da escravidão na colonização de Moçambique?",
      options: ["Exportação de mão de obra", "Fim da economia agrícola", "Fortalecimento do comércio local", "Expansão do cristianismo"],
      correct: 0
    }, {
      question: "Quando foi abolida a escravidão em Moçambique?",
      options: ["1878", "1884", "1869", "1900"],
      correct: 2
    }, {
      question: "Quem foram os Nguni na história de Moçambique?",
      options: ["Povo guerreiro", "Colonizadores", "Mercadores europeus", "Exploradores portugueses"],
      correct: 0
    }, {
      question: "Qual foi a principal consequência da Conferência de Berlim para Moçambique?",
      options: ["Divisão colonial africana", "Independência política", "Unificação de tribos", "Fim do comércio europeu"],
      correct: 0
    }, {
      question: "Qual é a relação de Moçambique com o Oceano Índico na história?",
      options: ["Rota de comércio marítimo", "Barreira geográfica", "Exploração de petróleo", "Extensão territorial"],
      correct: 0
    }, {
      question: "Quem liderou a assinatura dos Acordos de Roma?",
      options: ["Joaquim Chissano", "Samora Machel", "Eduardo Mondlane", "Filipe Nyusi"],
      correct: 0
    }, {
      question: "O que foi a Operação Produção em Moçambique?",
      options: ["Programa de trabalho agrícola", "Campanha militar", "Acordo de paz", "Projeto de industrialização"],
      correct: 0
    }, {
      question: "Qual era o objetivo do Movimento das Forças Armadas de Portugal?",
      options: ["Promover a descolonização", "Expandir o império", "Manter o colonialismo", "Unir territórios africanos"],
      correct: 0
    }],

    biblia: [{
      question: "O que é a Bíblia?", 
      options: ["É um conjunto de livros que contam histórias", "É um livro que serve para ser usado nos Domingos", "É um Conjunto de 66 Livros canônicos sagrado", "É um livro Escolar"], 
      correct: 2
      }, {
      question: "Em quantas partes está agrupada a Bíblia?", 
      options: ["3", "2", "1", "0"],
      correct: 1
      }, {
      question: "Como estão agrupados os livros da Bíblia? ",
      options: ["Antigo Testamento e Novo Testemunho", "Velho Testamento e Nova Testemunha", "Velho Testemunho e Novo Testamento", "Antigo Testamento e Novo Testamento"], 
      correct: 3
      }, {
      question: "Quantos livros tem a Bíblia? ",
      options: ["66", "64", "62", "60"], 
      correct: 0
      },
      {
      question: "Quantos livros tem o Antigo Testamento? ",
      options: ["30", "24", "39", "37"], 
      correct: 2
      }, {
      question: "Quantos livros tem o Novo Testamento? ",
      options: ["27", "23", "32", "20"], 
      correct: 0
      }, {
      question: "O Antigo Testamento está sub dividido enquantos grupos? ",
      options: ["2", "3", "4", "5"], 
      correct: 3
      }, {
      question: "Qual desses grupos de livros fazem parte do Antigo Testamento?",
      options: ["Livros Evagelicos, Livros Históricos, Livros Poéticos, Livros dos Profetas Maiores e Livros dos poetas Menores", "Livros Patateus, Livros Históricos, Livros Poéticos, Livros dos Profetas", "Livros Patateus, Livros Históricos, Livros Poéticos, Livros dos Profetas Maiores e Livros dos Profetas Menores", "Genises, Deternomio, Josué, Ester, Jô, cântaro de Salomão, Isaías, Daniel, Oseias e Malaquias"], 
      correct: 2
      }, {
      question: "Qual desses grupos de livros fazem parte do Antigo Testamento?",
      options: ["Livros Evangélicos, Livros Históricos, Livros Epístolas - Cartas Paulina, Livros Epístolas - Cartas Gerais, Livros Proféticos - Revelações", "Livros Históricos, Livros Epístolas - Cartas Paulina, Livros Epístolas - Cartas Gerais, Livros Proféticos", "Livros Evangélicos, Livros Históricos, Livros Epístolas, Livros Proféticos - Revelações", "Livros Evangélicos, Livros Históricos, Livros Epístolas, Livros de Revelações"], 
      correct: 0
      }, {
      question: "Das opções a seguir, qual é o Sistema de Abreviação dos livros da Bíblia que aprendeste? ",
      options: ["Sistema Antigo e Sistema Novo", "Sistema Velho e Sistema Actualizado", "Sistema Clássico e Sistema Actualizado", "Sistema Clássico e Sistema Moderno"], 
      correct: 3
      }, {
      question: "No sistema Moderno o que acontece com todos os livros que os nomes têm 05 letras? ",
      options: ["Não se abrevia", "Se abrevia", "Usamos as Consoantes do nome", "Usamos a primeira Consoante e o primeira vogal"], 
      correct: 0
      },
      {
      question: "Em que dia da semana Deus fez a Luz? ",
      options: ["2° dia", "4° dia", "1° dia", "3° dia"], 
      correct: 2
      }, {
        question: "Em que dia da semana Deus fez a Separação entre a Água e Água, Surgimento do Céu? ",
      options: ["2° dia", "4° dia", "1° dia", "3° dia"], 
      correct: 0
      }, {
      question: "Em que dia da semana Deus fez terra seca e vegetação? ",
      options: ["2° dia", "4° dia", "1° dia", "3° dia"], 
      correct: 3
      }, {
      question: "Em que dia da semana Deus criou luminares, a Lua e as estrelas? ",
      options: ["2° dia", "4° dia", "1° dia", "3° dia"], 
      correct: 1
      }, {
      question: "Em que dia da semana Deus fez todo Reptil e toda ave? ",
      options: ["6° dia", "4° dia", "7° dia", "5° dia"], 
      correct: 3
      }, {
      question: "Em que dia da semana Deus fez animais terrestres e o Homem? ",
      options: ["6° dia", "4° dia", "7° dia", "5° dia"], 
      correct: 0
      }, {
      question: "Em que dia da semana Deus descansou?",
      options: ["6° dia", "4° dia", "7° dia", "5° dia"], 
      correct: 2
      },
      {
      question: "Que Criatura, para ser feito foi preciso um Soleno Conselho Divino?",
      options: ["O Elefante", "O Leão", "A Mulher", "O Homem"], 
      correct: 3
      }, {
      question: "Qual Das alternativas descreve a criação do Homem segundo a Bíblia? ",
      options: ["Do pó da terra", "Da luz do sol", "Da água do mar", "Criado a partir das estrelas cósmicas"], 
      correct: 0
      }, {
      question: "Qual é a técnica cirúrgica inovadora usada por Deus, segundo o livro de Gênesis, para fazer a primeira Mulher? ",
      options: ["Fez um clone direto do pó da terra", "Transformou água em ossos e carne", "Utilizou uma costela do Homem como base", "Misturou pó da terra com luz do sol"], 
      correct: 2
      }, {
      question: "Deus fez o Homem dotado de pleno poder para governar, e em paralelo uma ordem proibitiva.",
      options: ["Falso", "Verdade"], 
      correct: 1
      }, {
      question: "E importante saber o nome da árvore Proibida?",
      options: ["Sim", "Talvez", "Não"], 
      correct: 2
      }, {
      question: "Será que Deus sabia que o Homem iria pecar?",
      options: ["Sim", "Talvez", "Não"], 
      correct: 0
      }, {
      question: "Das opções abaixo quais são os intervenientes envolvidos na queda do Homem?",
      options: ["A Mulher, a Serpente e o Homem", "A Mulher, A serpente e a Maça", "A Mulher, o Homem e a Árvore da Vida", "A Mulher, O Homem e Deus"], 
      correct: 0
      }, {
        question: "Quem lhe foi aumentado a dor do parto?",
      options: ["O homem", "A mulher", "A árvore da Vida", "A serpente"], 
      correct: 1
      }, {
      question: "A quem lhe foi decretado uma vida amaldiçoada, condenada a andar sobre o seu proprio ventre e comer o pó da Terra?",
      options: ["O homem", "A Mulher", "A árvore da Vida", "A serpente"], 
      correct: 3
      }, {
      question: "Quem lhe foi senteciado a sofrer para poder viver do seu suor?",
      options: ["O homem", "A mulher", "A árvore da Vida", "Deus"], 
      correct: 0
      }, {
      question: "Com a queda do Homem o Relacionamento entre o Homem e Deus foi Prejudicado. Qual e o tipo de Consequências?",
      options: ["Consequência Física", "Consequência Espiritual"], 
      correct: 1
      }, {
      question: "Com a queda do Homem, o homem passou a ficar Doente. Qual e o tipo de Consequências?",
      options: ["Consequência Fisica", "Consequência Espiritual"], 
      correct: 0
      },
      {
      question: "Quem e Pecador?",
      options: ["O Homem", "A Mulher", "A Serpente", "Deus", "Todos os Homens"], 
      correct: 4
      }, {
      question: "Segundo a Bíblia, quem foi a primeira pessoa a pecar?",
      options: ["Caim", "Adão e Eva", "Moisés", "Judas Iscariotes"],
      correct: 1
      }, {
      question: "O que é considerado pecado, de acordo com 1 João 3:4?",
      options: ["Não ir à igreja", "Não dar dízimos", "A transgressão da lei", "Falar mal de outras pessoas"],
      correct: 2
      }, {
      question: "Qual é a consequência do pecado, segundo Romanos 6:23?",
      options: ["A pobreza", "A morte", "A doença", "A tristeza"],
      correct: 1
      }, {
      question: "Quem nos liberta do pecado, de acordo com a Bíblia?",
      options: ["Os profetas", "Moisés", "Jesus Cristo", "O Espírito Santo"],
      correct: 2
      }, {
      question: "O que devemos fazer para sermos perdoados por nossos pecados, segundo 1 João 1:9?",
      options: ["Fazer sacrifícios", "Confessar os pecados", "Ajudar os pobres", "Fazer boas obras"],
      correct: 1
      }, 
      {
      question: "O que significa ser salvo na Bíblia?",  
      options: ["Ser protegido de perigos físicos", "Tornar-se um líder religioso", "Receber bênçãos materiais", "Ser liberto do pecado e da condenação eterna"],
      correct: 3
      }, {
      question: "Quem é o único mediador entre Deus e os homens, segundo 1 Timóteo 2:5?",
      options: ["Moisés", "O Espírito Santo", "Jesus Cristo", "Paulo"],
      correct: 2
      }, {
      question: "De acordo com João 3:16, o que Deus fez para nos dar a salvação?",
      options: ["Deu Seu Filho unigênito", "Enviou anjos para nos proteger", "Prometeu riquezas aos que crerem", "Destruiu o pecado de forma instantânea"],
      correct: 0
      }, {
      question: "O que é necessário para receber a salvação, segundo Romanos 10:9?",
      options: ["Fazer boas obras", "Confessar com a boca que Jesus é o Senhor e crer no coração que Deus o ressuscitou", "Frequentar a igreja regularmente", "Cumprir todos os mandamentos da lei de Moisés"],
      correct: 1
      }, {
      question: "A salvação é algo que podemos conquistar por nossos próprios esforços?",
      options: ["Sim, através de boas obras", "Sim, obedecendo à lei de Moisés", "Não, é um presente de Deus pela graça, mediante a fé", "Depende da igreja que você frequenta"],
      correct: 2
      }, {
      question: "Após receber a salvação, como devemos viver, segundo 2 Coríntios 5:17?",
      options: ["Viver como novas criaturas, com mudança de vida", "Continuar como antes", "Seguir os costumes religiosos do passado", "Viver sem preocupações, pois já estamos salvos"],
      correct: 0
      },
      {
      question: "Quem recebeu de Deus as tábuas da Lei no Monte Sinai?",
      options: ["Abraão", "Moisés", "Davi", "Noé"],
      correct: 1
      }, {
        question: "Quantos mandamentos Deus deu nas tábuas da Lei?",
      options: ["5", "7", "10", "12"],
      correct: 2
      },
      {
      question: "Para que serviam os sacrifícios de animais na lei do Antigo Testamento?",
      options: ["Para alimentar os sacerdotes", "Para enriquecer o templo", "Para mostrar poder sobre os povos vizinhos", "Para simbolizar a expiação dos pecados"],
      correct: 3
      }, {
      question: "Qual era o animal mais comumente usado no sacrifício pelos pecados no Antigo Testamento?",
      options: ["Cordeiro", "Pomba", "Cabra", "Boi"],
      correct: 0
      }, {
      question: "Quem é chamado de Cordeiro de Deus que tira o pecado do mundo?",
      options: ["Moisés", "João Batista", "Jesus Cristo", "Paulo"],
      correct: 2
      }, {
      question: "Qual foi o propósito principal das leis dadas por Deus no Antigo Testamento?",
      options: ["Enriquecer o povo de Israel", "Tornar Israel mais poderoso militarmente", "Afastar Israel dos povos vizinhos", "Demonstrar a necessidade de obediência e santidade"],
      correct: 2
      }, {
      question: "Segundo Hebreus 10:4, por que os sacrifícios de animais não eram suficientes para tirar os pecados completamente?",
      options: ["Porque eram feitos por sacerdotes imperfeitos", "Porque o sangue de animais não podia remover pecados", "Porque eram repetidos muitas vezes", "Porque Deus rejeitou esses sacrifícios"],
      correct: 1
      }, {
      question: "Como Jesus cumpriu a lei e os sacrifícios do Antigo Testamento?",
      options: ["Oferecendo-se como sacrifício perfeito",, "Abolindo completamente a lei", "Tornando os sacrifícios de animais permanentes", "Introduzindo novas leis para substituir as antigas"],
      correct: 0
      },
      {
      question: "Segundo a Bíblia, o que é oração?",
      options: ["Uma forma de meditação silenciosa", "Uma conversa com Deus", "Um ritual obrigatório", "Um pedido de bênçãos aos santos"],
      correct: 1
      }, {
      question: "Qual é o modelo de oração ensinado por Jesus?",
      options: ["A oração de Davi", "A oração de Elias", "O Pai Nosso", "O Credo Apostólico"],
      correct: 2
      }, {
      question: "Segundo 1 Tessalonicenses 5:17, como devemos orar?",
      options: ["Apenas ao amanhecer", "Apenas em momentos de necessidade", "Sem cessar", "Uma vez por semana"],
      correct: 2
      }, {
      question: "Qual é a atitude correta durante a oração, de acordo com Mateus 6:5-6?",
      options: ["Orar em secreto, para o Pai que vê em oculto", "Orar em público para que todos vejam", "Repetir muitas palavras para convencer Deus", "Permanecer em silêncio total"],
      correct: 0
      }, {
      question: "Quem intercede por nós em oração, segundo Romanos 8:26?",
      options: ["Os anjos", "Os apóstolos", "O Espírito Santo", "Os profetas"],
      correct: 2
      }, {
      question: "De acordo com Tiago 5:16, qual é o poder da oração do justo?",
      options: ["Fazer chover no deserto", "Resolver todos os problemas imediatamente", "Garantir riquezas", "Curar os doentes e ser eficaz"],
      correct: 3
      }, {
      question: "Por que Jesus orava frequentemente, mesmo sendo o Filho de Deus?",
      options: ["Para mostrar um exemplo aos discípulos", "Para demonstrar humildade e dependência de Deus", "Para buscar força e comunhão com o Pai", "Todas as alternativas acima"],
      correct: 3
      }, {
        question: "Qual oração Jesus fez por seus inimigos enquanto estava na cruz?",
      options: ["Perdoa-lhes, pois não sabem o que fazem", "Que sejam amaldiçoados", "Por que me abandonaste?", "Venha o teu Reino"],
      correct: 0
      }, {
      question: "O que é jejum, segundo a Bíblia?",
      options: ["Uma forma de purificação física", "Abstenção de alimentos para buscar a Deus", "Um ritual obrigatório para todos os crentes", "Uma forma de disciplina física para perder peso"],
      correct: 1
      }, {
      question: "Qual foi o propósito do jejum de Jesus no deserto?",
      options: ["Ganhar força física", "Cumprir um ritual judaico", "Mostrar ao diabo seu poder", "Buscar poder espiritual e resistir à tentação"],
      correct: 3
      }, {
      question: "Como devemos jejuar, de acordo com Mateus 6:16-18?",
      options: ["Tornando nosso jejum visível para todos", "Reclamando sobre a fome para demonstrar sacrifício", "Com uma aparência alegre e sem alarde", "Apenas quando estamos em situações de emergência"],
      correct: 2
      }, {
      question: "Por quanto tempo Moisés jejuou no Monte Sinai enquanto recebia a Lei de Deus?",
      options: ["3 dias e 3 noites", "21 dias e 21 noite", "40 dias e 40 noites", "7 dias e 7 noites"],
      correct: 2
      }, {
      question: "Qual foi o jejum realizado por Ester e o povo judeu?",
      options: ["3 dias e 3 noites sem comer nem beber", "7 dias comendo apenas pão e água", "40 dias de abstenção parcial", "Apenas durante o período da manhã"],
      correct: 0
      }, {
      question: "De acordo com Isaías 58:6, qual é o propósito do jejum que agrada a Deus?",
      options: ["Libertar os oprimidos, quebrar jugos e praticar justiça", "Demonstrar superioridade espiritual", "Reforçar a tradição religiosa", "Mostrar arrependimento ao público"],
      correct: 0
      }, {
      question: "Quem declarou um jejum coletivo para buscar a proteção de Deus antes de enfrentar uma grande batalha?",
      options: ["Josué", "Neemias", "Jeosafá", "Gideão"],
      correct: 2
      }, {
      question: "Qual foi o jejum realizado por Daniel?",
      options: ["Abstinência total de alimentos por 40 dias", "Consumo apenas de legumes, frutas e água", "Jejum de pão e carne por 7 dias", "Apenas abstinência de água"],
      correct: 1
      }, {
      question: "Segundo Joel 2:12, o jejum deve ser acompanhado de qual atitude?",
      options: ["Arrependimento sincero e busca por Deus de todo o coração", "Alegria e celebração", "Uma oferta especial no templo", "Reuniões públicas de oração"],
      correct: 0
      },
      {
      question: "O que Jesus ensinou sobre quantas vezes devemos perdoar alguém?",
      options: ["Sete vezes", "Setenta vezes sete", "Apenas uma vez", "Depende da gravidade do erro"],
      correct: 1
      }, {
      question: "De acordo com Mateus 6:14-15, qual é a condição para que Deus nos perdoe?",
      options: ["Fazer boas obras", "Não cometer mais pecados", "Jejuar regularmente", "Perdoar aqueles que nos ofendem"],
      correct: 3
      }, {
      question: "Quem disse: Pai, perdoa-lhes, pois não sabem o que fazem?",
      options: ["Estêvão", "Pedro", "Paulo", "Jesus"],
      correct: 3
      }, {
      question: "De acordo com 1 João 1:9, o que Deus faz quando confessamos nossos pecados?",
      options: ["Nos ignora", "Nos condena", "Nos perdoa e nos purifica de toda injustiça", "Nos dá uma segunda chance apenas se mudarmos"],
      correct: 2
      }, {
        question: "Na parábola do servo impiedoso (Mateus 18:23-35), o que o rei fez ao servo que lhe devia muito?",
      options: ["Mandou-o para a prisão", "Perdoou toda a dívida", "Deu-lhe mais tempo para pagar", "Cobrou juros altos"],
      correct: 1
      }, {
      question: "Qual atitude é essencial para buscar o perdão de Deus, segundo Salmos 51:17?",
      options: ["Um espírito quebrantado e um coração contrito", "Uma oferta generosa", "Realizar um jejum prolongado", "Orar publicamente"],
      correct: 0
      }, {
      question: "O que Jesus disse sobre quem não perdoa os outros?",
      options: ["Será abençoado de outra forma", "Também não será perdoado por Deus", "Será punido diretamente", "Não enfrentará consequências"],
      correct: 1
      }, {
      question: "Segundo Colossenses 3:13, como devemos perdoar uns aos outros?",
      options: ["Baseados no exemplo de Cristo", "Somente se houver arrependimento", "De maneira parcial", "Apenas quando somos solicitados"],
      correct: 0
      }, {
      question: "Na história de José e seus irmãos (Gênesis 50:15-21), como José demonstrou perdão?",
      options: ["Pagou-lhes na mesma moeda", "Esqueceu o que haviam feito", "Tratou-os com bondade e viu o plano de Deus em tudo", "Recusou-se a falar com eles"],
      correct: 2
      }], 

    biologia: [{
      question: "Qual é a unidade básica da vida?",
      options: ["Célula", "Tecido", "Órgão", "Organismo"],
      correct: 0
    }, {
      question: "Qual é o processo pelo qual as plantas produzem seu próprio alimento?",
      options: ["Respiração celular", "Fotossíntese", "Fermentação", "Transpiração"],
      correct: 1
    }, {
      question: "Qual organela celular é responsável pela produção de energia?",
      options: ["Cloroplasto", "Mitocôndria", "Ribossomo", "Núcleo"],
      correct: 1
    }, {
      question: "Qual é a principal função do DNA?",
      options: ["Produzir energia", "Carregar informações genéticas", "Destruir toxinas", "Transportar oxigênio"],
      correct: 1
    }, {
      question: "Qual é o reino dos fungos?",
      options: ["Animalia", "Fungi", "Plantae", "Protista"],
      correct: 1
    }, {
      question: "Qual é o processo de divisão celular que resulta em duas células idênticas?",
      options: ["Mitose", "Meiose", "Citocinese", "Bipartição"],
      correct: 0
    }, {
      question: "Qual é o nome do pigmento responsável pela coloração verde das plantas?",
      options: ["Hemoglobina", "Melanina", "Clorofila", "Carotenoide"],
      correct: 2
    }, {
      question: "Qual é a principal função dos glóbulos vermelhos no sangue?",
      options: ["Defender o corpo contra doenças", "Transportar oxigênio", "Coagular o sangue", "Produzir hormônios"],
      correct: 1
    }, {
      question: "Qual é a estrutura responsável pelo transporte de água nas plantas?",
      options: ["Floema", "Xilema", "Estômato", "Raiz"],
      correct: 1
    }, {
      question: "Qual é o tipo de reprodução que não envolve a fusão de gametas?",
      options: ["Sexuada", "Assexuada", "Parasitária", "Hermafrodita"],
      correct: 1
    }, {
      question: "Qual é o principal gás liberado na fotossíntese?",
      options: ["Dióxido de carbono", "Oxigênio", "Nitrogênio", "Hidrogênio"],
      correct: 1
    }, {
      question: "Qual parte do sistema nervoso é responsável pelos reflexos?",
      options: ["Cérebro", "Medula espinhal", "Nervos periféricos", "Cerebelo"],
      correct: 1
    }, {
      question: "Qual é o nome do processo pelo qual o RNA é convertido em proteína?",
      options: ["Replicação", "Transcrição", "Tradução", "Mutação"],
      correct: 2
    }, {
      question: "Qual é a função dos lisossomos na célula?",
      options: ["Produzir energia", "Digirir substâncias", "Armazenar água", "Sintetizar proteínas"],
      correct: 1
    }, {
      question: "Qual é o tecido responsável pelo transporte de nutrientes nas plantas?",
      options: ["Xilema", "Floema", "Estômato", "Meristema"],
      correct: 1
    }, {
      question: "Qual é o nome do processo em que uma célula engole partículas externas?",
      options: ["Exocitose", "Endocitose", "Pinocitose", "Fagocitose"],
      correct: 3
    }, {
      question: "Qual é o tipo de célula que não possui núcleo definido?",
      options: ["Procarionte", "Eucarionte", "Animal", "Vegetal"],
      correct: 0
    }, {
      question: "Qual é a molécula que fornece energia para as células?",
      options: ["ATP", "DNA", "RNA", "Proteína"],
      correct: 0
    }, {
      question: "Qual é o nome da fase do ciclo celular em que o DNA é duplicado?",
      options: ["Mitose", "Interfase", "Meiose", "Citocinese"],
      correct: 1
    }, {
      question: "Qual é a função dos ribossomos?",
      options: ["Produzir proteínas", "Transportar oxigênio", "Armazenar energia", "Sintetizar lipídios"],
      correct: 0
    }, {
      question: "Qual é a estrutura que protege as células vegetais?",
      options: ["Membrana plasmática", "Parede celular", "Núcleo", "Vacuolo"],
      correct: 1
    }, {
      question: "Qual é a base nitrogenada exclusiva do RNA?",
      options: ["Adenina", "Timina", "Uracila", "Guanina"],
      correct: 2
    }, {
      question: "Qual é o grupo taxonômico mais específico?",
      options: ["Reino", "Filo", "Gênero", "Espécie"],
      correct: 3
    }, {
      question: "Qual é a função dos estômatos nas plantas?",
      options: ["Absorver nutrientes", "Permitir trocas gasosas", "Transportar água", "Armazenar energia"],
      correct: 1
    }, {
      question: "Qual é o nome da molécula que carrega os genes?",
      options: ["RNA", "DNA", "Proteína", "ATP"],
      correct: 1
    }, {
      question: "Qual é o principal produto da fermentação alcoólica?",
      options: ["Água", "Álcool etílico", "Ácido lático", "Oxigênio"],
      correct: 1
    }, {
      question: "Qual é o principal componente da parede celular das plantas?",
      options: ["Quitina", "Celulose", "Amido", "Proteína"],
      correct: 1
    }, {
      question: "Qual é o reino dos organismos unicelulares eucariontes?",
      options: ["Fungi", "Protista", "Plantae", "Animalia"],
      correct: 1
    }, {
      question: "Qual é o nome do processo em que o DNA se transforma em RNA?",
      options: ["Transcrição", "Tradução", "Replicação", "Mutação"],
      correct: 0
    }, {
      question: "Qual é a parte do olho humano que detecta luz?",
      options: ["Iris", "Córnea", "Retina", "Cristalino"],
      correct: 2
    }, {
      question: "O que é biodiversidade?",
      options: ["Diversidade de climas", "Diversidade de espécies", "Quantidade de organismos", "Número de habitats"],
      correct: 1
    }, {
      question: "Qual é o principal órgão do sistema respiratório humano?",
      options: ["Coração", "Pulmões", "Diafragma", "Traqueia"],
      correct: 1
    }, {
      question: "O que significa 'homeostase'?",
      options: ["Desequilíbrio interno", "Estabilidade do ambiente interno", "Troca de gases", "Crescimento celular"],
      correct: 1
    }, {
      question: "Qual é o nome da molécula que armazena energia nos músculos?",
      options: ["ATP", "Glicose", "Ácido lático", "Creatina"],
      correct: 3
    }, {
      question: "Qual é o órgão responsável pela filtragem do sangue no corpo humano?",
      options: ["Coração", "Rins", "Pulmões", "Estômago"],
      correct: 1
    }, {
      question: "Qual é a função do sistema linfático?",
      options: ["Transportar nutrientes", "Defender o corpo contra infecções", "Produzir energia", "Filtrar toxinas"],
      correct: 1
    }, {
      question: "Qual é o nome do tecido muscular presente no coração?",
      options: ["Muscular liso", "Muscular cardíaco", "Muscular esquelético", "Muscular voluntário"],
      correct: 1
    }, {
      question: "Qual é o nome da estrutura que conecta os músculos aos ossos?",
      options: ["Ligamentos", "Tendões", "Cartilagem", "Articulações"],
      correct: 1
      }],

    contabilidade: [{
      question: "Qual é a equação básica da contabilidade?",
      options: ["Ativos = Passivos + Patrimônio Líquido", "Passivos = Ativos + Patrimônio Líquido", "Receitas = Despesas + Lucro", "Ativos + Passivos = Patrimônio Líquido"],
      correct: 0
    }, {
      question: "O que significa o termo 'débito' em contabilidade?",
      options: ["Entrada de dinheiro", "Saída de dinheiro", "Registro no lado esquerdo de uma conta", "Registro no lado direito de uma conta"],
      correct: 2
    }, {
      question: "Qual é o principal objetivo da contabilidade?",
      options: ["Registrar transações financeiras", "Controlar estoques", "Reduzir custos", "Produzir informações para a tomada de decisões"],
      correct: 3
    }, {
      question: "Qual é o principal relatório contábil que apresenta a posição financeira de uma empresa?",
      options: ["Demonstração de Resultado", "Balanço Patrimonial", "Demonstração de Fluxo de Caixa", "Livro Diário"],
      correct: 1
    }, {
      question: "Qual é a natureza de saldo da conta 'Receitas'?",
      options: ["Devedora", "Credora", "Mista", "Indefinida"],
      correct: 1
    }, {
      question: "O que é patrimônio líquido?",
      options: ["Ativos menos passivos", "Passivos menos ativos", "Receitas menos despesas", "Ativos mais passivos"],
      correct: 0
    }, {
      question: "Qual é a finalidade do Livro Diário?",
      options: ["Registrar transações resumidas", "Registrar todas as transações em ordem cronológica", "Controlar o caixa", "Elaborar balanços"],
      correct: 1
    }, {
      question: "O que é um ativo circulante?",
      options: ["Ativo com vida útil superior a um ano", "Ativo que será convertido em dinheiro dentro de um ano", "Passivo de curto prazo", "Ativo não disponível"],
      correct: 1
    }, {
      question: "O que representa uma despesa?",
      options: ["Aumento no patrimônio líquido", "Redução no patrimônio líquido", "Entrada de caixa", "Aumento nos passivos"],
      correct: 1
    }, {
      question: "Qual é o significado de 'auditoria' em contabilidade?",
      options: ["Registro de transações", "Revisão sistemática das demonstrações financeiras", "Cálculo de impostos", "Preparação de balanços"],
      correct: 1
    }, {
      question: "Qual é a função do Livro Razão?",
      options: ["Registrar entradas de caixa", "Registrar saídas de caixa", "Organizar as transações por conta", "Elaborar o balanço patrimonial"],
      correct: 2
    }, {
      question: "Qual é o regime contábil que reconhece receitas e despesas somente quando o dinheiro é recebido ou pago?",
      options: ["Regime de competência", "Regime de caixa", "Regime híbrido", "Regime orçamentário"],
      correct: 1
    }, {
      question: "Qual é a diferença entre ativo e passivo?",
      options: ["Ativo são bens e direitos, passivo são obrigações", "Passivo são bens e direitos, ativo são obrigações", "Ambos são recursos da empresa", "Ativo representa capital externo, passivo representa capital interno"],
      correct: 0
    }, {
      question: "Qual é a natureza de saldo da conta 'Caixa'?",
      options: ["Credora", "Devedora", "Indefinida", "Ambas"],
      correct: 1
    }, {
      question: "O que é uma provisão em contabilidade?",
      options: ["Uma receita futura", "Uma despesa futura", "Uma obrigação de valor incerto", "Um ativo de curto prazo"],
      correct: 2
    }, {
      question: "Qual relatório demonstra a capacidade de uma empresa gerar caixa?",
      options: ["Balanço Patrimonial", "Demonstração de Resultado", "Demonstração de Fluxo de Caixa", "Relatório de Auditoria"],
      correct: 2
    }, {
      question: "Qual é a função de um contador?",
      options: ["Registrar transações financeiras", "Elaborar relatórios financeiros", "Auxiliar na tomada de decisões", "Todas as alternativas anteriores"],
      correct: 3
    }, {
      question: "O que é um passivo contingente?",
      options: ["Uma dívida confirmada", "Uma possível obrigação futura", "Um ativo de longo prazo", "Uma despesa fixa"],
      correct: 1
    }, {
      question: "Qual é o principal objetivo da Demonstração de Resultados?",
      options: ["Mostrar o lucro ou prejuízo do período", "Detalhar o patrimônio líquido", "Listar os ativos da empresa", "Registrar transações financeiras"],
      correct: 0
    }, {
      question: "O que são receitas operacionais?",
      options: ["Receitas obtidas de atividades secundárias", "Receitas obtidas da atividade principal da empresa", "Receitas obtidas de empréstimos", "Receitas provenientes de juros"],
      correct: 1
    }, {
      question: "Qual é a diferença entre lucro bruto e lucro líquido?",
      options: ["Lucro bruto considera impostos, lucro líquido não", "Lucro líquido considera despesas, lucro bruto não", "Lucro bruto exclui custos variáveis, lucro líquido exclui custos fixos", "Lucro líquido é o lucro total, lucro bruto é parcial"],
      correct: 1
    }, {
      question: "O que significa a sigla CPC na contabilidade brasileira?",
      options: ["Código de Práticas Contábeis", "Comissão de Princípios Contábeis", "Comitê de Pronunciamentos Contábeis", "Conselho de Profissionais Contábeis"],
      correct: 2
    }, {
      question: "Qual é o método contábil que registra a depreciação de ativos?",
      options: ["Valor de mercado", "Taxa linear", "Custo histórico", "Valor presente"],
      correct: 1
    }, {
      question: "O que é capital de giro?",
      options: ["Capital investido em ativos fixos", "Recursos disponíveis para as operações diárias", "Patrimônio líquido da empresa", "Receitas totais de um período"],
      correct: 1
    }, {
      question: "Qual é a finalidade de um balancete de verificação?",
      options: ["Apresentar o fluxo de caixa", "Verificar a igualdade entre débitos e créditos", "Detalhar as receitas", "Calcular o patrimônio líquido"],
      correct: 1
    }, {
      question: "O que são contas patrimoniais?",
      options: ["Contas de receita e despesa", "Contas de ativo, passivo e patrimônio líquido", "Contas de fluxo de caixa", "Contas de inventário"],
      correct: 1
    }, {
      question: "O que é contabilizado no ativo imobilizado?",
      options: ["Bens de consumo imediato", "Bens destinados à produção ou operação da empresa", "Reservas financeiras", "Receitas operacionais"],
      correct: 1
    }, {
      question: "Qual é o objetivo da contabilidade de custos?",
      options: ["Registrar transações financeiras", "Determinar o custo dos produtos ou serviços", "Elaborar o fluxo de caixa", "Apurar impostos"],
      correct: 1
    }, {
      question: "O que é amortização em contabilidade?",
      options: ["Pagamento de dívidas", "Redução gradual do valor de um ativo intangível", "Aumento do patrimônio líquido", "Reconhecimento de receitas"],
     correct: 1
    }],

    economia: [{
      question: "O que é economia?",
      options: ["O estudo da distribuição de energia.", "O estudo da produção, distribuição e consumo de bens e serviços.", "O estudo do comportamento dos organismos vivos.", "O estudo das leis físicas do universo."],
      correct: 1
    }, {
      question: "O que significa PIB?",
      options: ["Produto Industrial Bancal", "Produto Interno Bruto", "Produção Interna Básica", "Plano de Investimento Bancário"],
      correct: 1
    }, {
      question: "O que é oferta em economia?",
      options: [
        "A quantidade de bens que os consumidores desejam comprar.",
        "A quantidade de bens e serviços que os produtores estão dispostos a vender.",
        "O preço final de um produto no mercado.",
        "O consumo per capita de um país."
      ],
      correct: 1
    }, {
      question: "O que é demanda?",
      options: [
        "A quantidade de bens disponíveis no mercado.",
        "A quantidade de bens e serviços que os consumidores desejam adquirir.",
        "O total de bens exportados por um país.",
        "O número de trabalhadores empregados em uma empresa."
      ],
      correct: 1
    }, {
      question: "Qual é a principal lei da oferta e da demanda?",
      options: [
        "Quando a oferta aumenta, o preço aumenta.",
        "Quando a demanda aumenta, o preço diminui.",
        "Quando a oferta diminui e a demanda aumenta, o preço tende a subir.",
        "Quando a oferta e a demanda diminuem, o preço permanece constante."
      ],
      correct: 2
    }, {
      question: "O que é inflação?",
      options: [
        "Aumento geral e contínuo dos preços.",
        "Redução do número de bens no mercado.",
        "Estagnação da economia de um país.",
        "Aumento das taxas de desemprego."
      ],
      correct: 0
    }, {
      question: "O que é deflação?",
      options: [
        "Redução geral e contínua dos preços.",
        "Aumento do custo de produção.",
        "Crescimento acelerado da economia.",
        "Aumento dos impostos sobre produtos importados."
      ],
      correct: 0
    }, {
      question: "Qual é a diferença entre microeconomia e macroeconomia?",
      options: [
        "Microeconomia analisa o mercado internacional, enquanto macroeconomia estuda empresas.",
        "Microeconomia estuda unidades individuais, enquanto macroeconomia analisa a economia como um todo.",
        "Microeconomia estuda apenas grandes empresas, enquanto macroeconomia foca em governos.",
        "Não há diferença; ambas estudam os mesmos aspectos."
      ],
      correct: 1
    }, {
      question: "O que é um mercado competitivo?",
      options: [
        "Um mercado com apenas um fornecedor dominante.",
        "Um mercado onde muitos compradores e vendedores negociam livremente.",
        "Um mercado onde os preços são fixados pelo governo.",
        "Um mercado com baixos índices de consumo."
      ],
      correct: 1
    }, {
      question: "Qual é a função principal do Banco Central?",
      options: [
        "Produzir bens e serviços.",
        "Regulamentar e supervisionar o sistema financeiro.",
        "Definir os preços dos produtos no mercado.",
        "Controlar o consumo das famílias."
      ],
      correct: 1
    }, {
      question: "O que é câmbio flutuante?",
      options: [
        "Quando o governo controla o valor da moeda.",
        "Quando o valor da moeda é determinado pelo mercado.",
        "Quando a moeda não é usada em transações comerciais.",
        "Quando o valor da moeda é fixo em relação a outra moeda."
      ],
      correct: 1
    }, {
      question: "O que é taxa de juros?",
      options: [
        "O valor cobrado pelo governo sobre bens importados.",
        "O custo do dinheiro emprestado ou o retorno de um investimento.",
        "A taxa de crescimento da população em uma economia.",
        "A quantidade de bens produzidos em um país."
      ],
      correct: 1
    }, {
      question: "O que é desemprego estrutural?",
      options: [
        "Desemprego causado por flutuações econômicas.",
        "Desemprego causado pela substituição de trabalhadores por tecnologia.",
        "Desemprego causado por desastres naturais.",
        "Desemprego voluntário de pessoas qualificadas."
      ],
      correct: 1
    }, {
      question: "O que é uma política fiscal expansionista?",
      options: [
        "Aumento de impostos e corte de gastos públicos.",
        "Redução de impostos e aumento de gastos públicos.",
        "Controle rigoroso da inflação.",
        "Aumento das exportações e redução das importações."
      ],
      correct: 1
    }, {
      question: "O que é o conceito de custo de oportunidade?",
      options: [
        "O custo de produzir bens em grande escala.",
        "O benefício perdido ao escolher uma alternativa em vez de outra.",
        "O custo de oportunidade de não investir.",
        "O preço total pago por um bem ou serviço."
      ],
      correct: 1
    }, {
      question: "O que é balança comercial?",
      options: [
        "A diferença entre exportações e importações de um país.",
        "O número de empregos gerados pelo comércio.",
        "A quantidade total de bens produzidos internamente.",
        "O valor da moeda de um país em relação a outra."
     ] ,
      correct: 0
    }, {
      question: "O que significa 'mercado monopolista'?",
      options: [
        "Um mercado com muitos fornecedores.",
        "Um mercado dominado por uma única empresa ou fornecedor.",
        "Um mercado sem regulação governamental.",
        "Um mercado onde os preços são fixados pelos consumidores."
      ],
      correct: 1
    }, {
      question: "O que é elasticidade-preço da demanda?",
      options: ["A variação na quantidade demandada em resposta a mudanças de preço.", "A diferença entre a oferta e a demanda em um mercado.", "O impacto do custo de produção no preço final.", "A relação entre preços de bens concorrentes."],
      correct: 0
    }, {
      question: "Qual é o objetivo da política monetária?",
      options: ["Reduzir o desemprego estrutural.", "Controlar a oferta de moeda e as taxas de juros.", "Aumentar as taxas de exportação.", "Melhorar a competitividade de pequenas empresas."],
      correct: 1
    }, {
      question: "O que é uma economia de mercado?",
      options: ["Uma economia onde o governo controla a produção.", "Uma economia onde as decisões são baseadas na oferta e demanda.", "Uma economia sem uso de moeda.", "Uma economia baseada na troca direta de bens."],
      correct: 1
    }], 

    geografia: [{
      "question": "Qual é o maior continente em extensão territorial?",
      "options": [
        "África",
        "América",
        "Ásia",
        "Europa"
      ],
      "correct": 2
    }, {
      "question": "Qual é o país mais populoso do mundo?",
      "options": [
        "Índia",
        "China",
        "Estados Unidos",
        "Indonésia"
      ],
      "correct": 1
    }, {
      "question": "Qual é o rio mais longo do mundo?",
      "options": [
        "Rio Nilo",
        "Rio Amazonas",
        "Rio Yangtzé",
        "Rio Mississippi"
      ],
      "correct": 0
    }, {
      "question": "Qual é a capital do Japão?",
      "options": [
        "Tóquio",
        "Seul",
        "Pequim",
        "Bangkok"
      ],
      "correct": 0
    }, {
      "question": "Qual país tem a maior área territorial?",
      "options": [
        "Estados Unidos",
        "China",
        "Brasil",
        "Rússia"
      ],
      "correct": 3
    }, {
      "question": "Qual é o deserto mais quente do mundo?",
      "options": [
        "Deserto do Saara",
        "Deserto de Gobi",
        "Deserto de Kalahari",
        "Deserto do Atacama"
      ],
      "correct": 0
    }, {
      "question": "Qual linha divide o globo em hemisfério norte e hemisfério sul?",
      "options": [
        "Meridiano de Greenwich",
        "Trópico de Câncer",
        "Linha do Equador",
        "Trópico de Capricórnio"
      ],
      "correct": 2
    }, {
      "question": "Qual oceano é o maior do mundo?",
      "options": [
        "Oceano Atlântico",
        "Oceano Índico",
        "Oceano Pacífico",
        "Oceano Ártico"
      ],
      "correct": 2
    }, {
      "question": "Qual é a maior floresta tropical do mundo?",
      "options": [
        "Floresta Amazônica",
        "Floresta do Congo",
        "Floresta Boreal",
        "Floresta de Bornéu"
      ],
      "correct": 0
    }, {
      "question": "Qual país é conhecido como o 'berço da civilização ocidental'?",
      "options": [
        "Egito",
        "Grécia",
        "Itália",
        "Mesopotâmia"
      ],
      "correct": 1
    }, {
      "question": "Qual é a capital de Moçambique?",
      "options": [
        "Beira",
        "Maputo",
        "Nampula",
        "Quelimane"
      ],
      "correct": 1
    }, {
      "question": "Qual é o rio mais longo de Moçambique?",
      "options": [
        "Rio Rovuma",
        "Rio Limpopo",
        "Rio Zambeze",
        "Rio Save"
      ],
      "correct": 2
    }, {
      "question": "Qual é a principal atividade econômica da região norte de Moçambique?",
      "options": [
        "Turismo",
        "Pesca",
        "Mineração",
        "Agricultura"
      ],
      "correct": 3
    }, {
      "question": "Quantas províncias existem em Moçambique?",
      "options": [
        "9",
        "10",
        "11",
        "12"
      ],
      "correct": 2
    }, {
      "question": "Qual é o principal porto marítimo de Moçambique?",
      "options": [
        "Porto de Nacala",
        "Porto de Beira",
        "Porto de Maputo",
        "Porto de Quelimane"
      ],
      "correct": 0
    }, {
      "question": "Qual é o ponto mais alto de Moçambique?",
      "options": [
        "Monte Binga",
        "Monte Namuli",
        "Monte Gorongosa",
        "Monte Chiperone"
      ],
      "correct": 0
    }, {
      "question": "Qual é o principal parque nacional de Moçambique conhecido pela sua biodiversidade?",
      "options": [
        "Parque Nacional da Gorongosa",
        "Parque Nacional de Limpopo",
        "Reserva de Niassa",
        "Parque Nacional do Arquipélago das Quirimbas"
      ],
      "correct": 0
    }, {
      "question": "Qual rio faz fronteira natural entre Moçambique e a Tanzânia?",
      "options": [
        "Rio Limpopo",
        "Rio Save",
        "Rio Rovuma",
        "Rio Zambeze"
      ],
      "correct": 2
    }, {
      "question": "Qual província de Moçambique é conhecida pela produção de gás natural?",
      "options": [
        "Tete",
        "Cabo Delgado",
        "Inhambane",
        "Manica"
      ],
      "correct": 1
    }, {
      "question": "Qual cidade é o principal centro econômico de Moçambique?",
      "options": [
        "Nampula",
        "Maputo",
        "Beira",
        "Chimoio"
      ],
      "correct": 1
    }],

    etica: [{
      "question": "O que é ética?",
      "options": [
        "A ciência que estuda o comportamento animal",
        "O estudo dos princípios que orientam as ações humanas",
        "A análise das leis de um país",
        "A prática de ações religiosas"
      ],
      "correct": 1
    }, {
      "question": "Qual é a diferença entre ética e moral?",
      "options": [
        "Não há diferença entre os dois conceitos",
        "A ética é universal, enquanto a moral varia entre culturas e sociedades",
        "A moral é teórica, enquanto a ética é prática",
        "A ética é um conjunto de leis, e a moral é um conjunto de regras"
      ],
      "correct": 1
    }, {
      "question": "Quem é o filósofo considerado o pai da ética ocidental?",
      "options": [
        "Sócrates",
        "Aristóteles",
        "Platão",
        "Kant"
      ],
      "correct": 0
    }, {
      "question": "O que é ética profissional?",
      "options": [
        "O conjunto de regras de um país",
        "O comportamento adequado no exercício de uma profissão",
        "A prática de leis no ambiente de trabalho",
        "A filosofia aplicada ao cotidiano"
      ],
      "correct": 1
    }, {
      "question": "O que é um dilema ético?",
      "options": [
        "Uma decisão que não tem impacto moral",
        "Um conflito entre duas escolhas moralmente aceitáveis ou inaceitáveis",
        "Uma regra socialmente imposta",
        "Um debate acadêmico sobre moralidade"
      ],
      "correct": 1
    }, {
      "question": "Qual é o princípio fundamental da ética kantiana?",
      "options": [
        "A busca pelo prazer acima de tudo",
        "A ação baseada no dever e em princípios universais",
        "A maximização dos resultados positivos",
        "A valorização das emoções na tomada de decisão"
      ],
      "correct": 1
    }, {
      "question": "O que é ética utilitarista?",
      "options": [
        "A ética baseada na busca do dever",
        "A ética que busca maximizar o bem-estar coletivo",
        "A ética fundamentada na religião",
        "A ética que valoriza as emoções"
      ],
      "correct": 1
    }, {
      "question": "Qual é o papel da ética nas relações interpessoais?",
      "options": [
        "Criar conflitos entre as pessoas",
        "Promover respeito e harmonia entre indivíduos",
        "Impor regras inflexíveis",
        "Eliminar a moralidade nas decisões"
      ],
      "correct": 1
    }, {
      "question": "O que significa agir com integridade?",
      "options": [
        "Seguir ordens sem questionar",
        "Agir de acordo com princípios éticos e valores morais",
        "Priorizar os interesses pessoais",
        "Evitar responsabilidades"
      ],
      "correct": 1
    }, {
      "question": "O que é ética ambiental?",
      "options": [
        "Um movimento político",
        "A reflexão sobre o impacto das ações humanas no meio ambiente",
        "Um conjunto de leis sobre a natureza",
        "A prática de preservação sem reflexão"
      ],
      "correct": 1
    }, {
      "question": "O que significa responsabilidade social?",
      "options": [
        "Ações individuais para melhorar a própria vida",
        "O compromisso de indivíduos e organizações com o bem-estar da sociedade",
        "A aplicação de leis penais",
        "A gestão de recursos financeiros"
      ],
      "correct": 1
    }, {
      "question": "O que é ética empresarial?",
      "options": [
        "A aplicação de estratégias econômicas",
        "A prática de valores e princípios éticos no ambiente corporativo",
        "A busca por lucros acima de tudo",
        "A imposição de regras rígidas para os funcionários"
      ],
      "correct": 1
    }, {
      "question": "Qual é a principal característica da ética de Aristóteles?",
      "options": [
        "A busca pelo prazer como objetivo final",
        "A busca pela virtude e pelo equilíbrio",
        "A obediência a regras absolutas",
        "A maximização dos resultados positivos"
      ],
      "correct": 1
    }, {
   "question": "O que significa 'ética normativa'?",
    "options": [
        "A ética que analisa a origem dos valores",
        "A ética que busca estabelecer normas para orientar o comportamento",
        "A ética que estuda as leis jurídicas",
        "A ética que ignora as regras morais"
      ],
      "correct": 1
    }, {
      "question": "Qual é o conceito de justiça segundo John Rawls?",
      "options": [
        "A justiça como igualdade para todos",
        "A justiça como a busca pelo bem maior",
        "A justiça baseada em regras fixas",
        "A justiça como resultado de conflitos"
      ],
      "correct": 0
    },  {
      "question": "O que é ética deontológica?",
      "options": [
        "A ética que valoriza as consequências das ações",
        "A ética que enfatiza o cumprimento do dever e das regras",
        "A ética baseada na busca pelo prazer",
        "A ética que ignora as responsabilidades"
      ],
      "correct": 1
    }, {
      "question": "O que é um código de ética?",
      "options": [
        "Um documento com regras e princípios para orientar comportamentos",
        "Uma lista de leis governamentais",
        "Um conjunto de manuais técnicos",
        "Uma teoria filosófica"
      ],
      "correct": 0
    }, {
      "question": "Por que a ética é importante na educação?",
      "options": [
        "Para ensinar apenas conteúdos acadêmicos",
        "Para formar cidadãos conscientes e responsáveis",
        "Para garantir obediência às leis escolares",
        "Para eliminar conflitos no ambiente escolar"
      ],
      "correct": 1
    }, {
      "question": "Qual é o impacto da ética na sociedade?",
      "options": [
        "Criar divisões entre grupos",
        "Promover convivência harmoniosa e respeito mútuo",
        "Eliminar diferenças culturais",
        "Impor padrões universais a todos"
      ],
      "correct": 1
    }, {
      "question": "O que é ética aplicada?",
      "options": [
        "Uma teoria filosófica abstrata",
        "A análise ética de questões práticas e específicas",
        "A criação de leis universais",
        "A rejeição de valores morais"
      ],
      "correct": 1
    }],

    cultura: [{
      "question": "Qual é a dança tradicional da região sul de Moçambique?",
      "options": ["Mapiko", "Xigubo", "Marrebenta", "Ngalanga"],
      "correct": 1
    },
    {
      "question": "Qual é o prato tradicional amplamente consumido em Moçambique?",
      "options": ["Matapa", "Feijoada", "Cuscuz", "Sushi"],
      "correct": 0
    },
    {
      "question": "Qual é a língua oficial de Moçambique?",
      "options": ["Inglês", "Português", "Swahili", "Changana"],
      "correct": 1
    },
    {
      "question": "Qual é o nome da cerimônia tradicional realizada para celebrar casamentos em Moçambique?",
      "options": ["Lobolo", "Batizado", "Ngoma", "Xigubo"],
      "correct": 0
    },
    {
      "question": "Qual é o instrumento musical tradicional usado na dança Mapiko?",
      "options": ["Tambor", "Piano", "Violino", "Flauta"],
      "correct": 0
    },
    {
      "question": "Qual é o grupo étnico conhecido por suas máscaras tradicionais em Moçambique?",
      "options": ["Macuas", "Tsongas", "Chopes", "Shonas"],
      "correct": 0
    },
    {
      "question": "Qual é a bebida tradicional feita de milho fermentado em Moçambique?",
      "options": ["Tchipwo", "Maheu", "Marula", "Cerveja"],
      "correct": 1
    },
    {
      "question": "Qual é o gênero musical popular originado em Moçambique?",
      "options": ["Marrebenta", "Kizomba", "Semba", "Kuduro"],
      "correct": 0
    },
    {
      "question": "Qual é o significado do termo 'Ngoma' em algumas culturas moçambicanas?",
      "options": ["Dança", "Instrumento", "Celebração", "Todos os anteriores"],
      "correct": 3
    },
    {
      "question": "Quem é um dos escritores moçambicanos mais conhecidos por obras sobre a cultura local?",
      "options": ["Mia Couto", "Pepetela", "Chinua Achebe", "José Saramago"],
      "correct": 0
    },
    {
      "question": "Qual é a religião predominante em Moçambique?",
      "options": ["Cristianismo", "Islamismo", "Hinduísmo", "Budismo"],
      "correct": 0
    },
    {
      "question": "Qual é o material tradicionalmente usado para construir casas em áreas rurais moçambicanas?",
      "options": ["Madeira e palha", "Concreto", "Aço", "Vidro"],
      "correct": 0
    },
    {
      "question": "Qual é o festival cultural que celebra a dança e a música em Moçambique?",
      "options": ["Festival Marrabenta", "Carnaval de Maputo", "Festival de Zalala", "Festival de Chigubo"],
      "correct": 0
    },
    {
      "question": "O que simboliza a capulana na cultura moçambicana?",
      "options": ["Respeito e tradição", "Riqueza", "Modernidade", "Religião"],
      "correct": 0
    },
    {
      "question": "Qual é a prática tradicional usada para transmitir conhecimentos em Moçambique?",
      "options": ["Narrativas orais", "Livros", "Filmes", "Internet"],
      "correct": 0
    },
    {
      "question": "Qual é o principal produto artesanal produzido em Moçambique?",
      "options": ["Esculturas de madeira", "Cerâmica", "Tapeçarias", "Joias"],
      "correct": 0
    },
    {
      "question": "O que é Matapa na culinária moçambicana?",
      "options": ["Um prato de mandioca com amendoim", "Uma sobremesa de frutas", "Uma sopa de peixe", "Um pão tradicional"],
      "correct": 0
    },
    {
      "question": "Qual é o grupo étnico conhecido pela produção de instrumentos musicais tradicionais?",
      "options": ["Chopes", "Makondes", "Swahilis", "Nhúngues"],
      "correct": 1
    },
    {
      "question": "Qual é a importância das máscaras Mapiko na cultura moçambicana?",
      "options": [
        "São usadas em rituais de iniciação",
        "Representam espíritos ancestrais",
        "Ambas as anteriores",
        "Apenas para decoração"
      ],
      "correct": 2
    },
    {
      "question": "Qual é o idioma mais falado na região sul de Moçambique além do português?",
      "options": ["Changana", "Macua", "Sena", "Lomwe"],
      "correct": 0
    }],

    direito: [{
      "question": "Qual é a Constituição atualmente em vigor em Moçambique?",
      "options": ["Constituição de 1975", "Constituição de 1990", "Constituição de 2004", "Constituição de 2010"],
      "correct": 2
    },
    {
      "question": "Qual é o sistema jurídico adotado por Moçambique?",
      "options": ["Sistema Romano-Germânico", "Sistema Anglo-Saxão", "Sistema Costumeiro", "Sistema Islâmico"],
      "correct": 0
    },
    {
      "question": "Quem exerce o poder legislativo em Moçambique?",
      "options": ["Presidente da República", "Assembleia da República", "Tribunal Supremo", "Primeiro-Ministro"],
      "correct": 1
    },
    {
      "question": "Quantos poderes soberanos existem segundo a Constituição de Moçambique?",
      "options": ["Dois", "Três", "Quatro", "Cinco"],
      "correct": 1
    },
    {
      "question": "O que é um contrato no Direito Moçambicano?",
      "options": [
        "Um acordo entre partes para criar, modificar ou extinguir obrigações",
        "Uma imposição do Estado",
        "Uma decisão judicial",
        "Um ato administrativo"
      ],
      "correct": 0
    },
    {
      "question": "Quem é o Chefe de Estado em Moçambique?",
      "options": ["Primeiro-Ministro", "Presidente da República", "Presidente da Assembleia", "Governador Provincial"],
      "correct": 1
    },
    {
      "question": "Qual é o órgão responsável pela administração da justiça em Moçambique?",
      "options": ["Assembleia da República", "Tribunais", "Conselho de Ministros", "Ministério Público"],
      "correct": 1
    },
      {
    "question": "O que é a nacionalidade moçambicana?",
      "options": [
        "O vínculo jurídico e político entre o indivíduo e o Estado de Moçambique",
        "A cidadania de um país estrangeiro",
        "Um título concedido pelo parlamento",
        "Uma categoria de estrangeiro residente"
      ],
      "correct": 0
    },
    {
      "question": "Qual é a idade mínima para votar em Moçambique?",
      "options": ["16 anos", "18 anos", "21 anos", "25 anos"],
      "correct": 1
    },
    {
      "question": "O que é um direito fundamental, segundo a Constituição de Moçambique?",
      "options": [
        "Um direito essencial garantido a todos os cidadãos",
        "Um privilégio para membros do governo",
        "Um benefício condicionado",
        "Um ato administrativo"
      ],
      "correct": 0
    },
    {
      "question": "O que é o direito consuetudinário?",
      "options": [
        "Direito baseado nos costumes e práticas tradicionais",
        "Leis criadas pelo parlamento",
        "Regulamentos administrativos",
        "Decisões judiciais internacionais"
      ],
      "correct": 0
    },
    {
      "question": "Quem representa o Estado em processos criminais?",
      "options": ["Advogados de defesa", "Juízes", "Ministério Público", "Assembleia da República"],
      "correct": 2
    },
    {
      "question": "Qual é o prazo de mandato do Presidente da República em Moçambique?",
      "options": ["4 anos", "5 anos", "6 anos", "7 anos"],
      "correct": 1
    },
    {
      "question": "O que caracteriza o Direito Administrativo em Moçambique?",
      "options": [
        "Normas que regulam a relação entre a Administração Pública e os cidadãos",
        "Regras do comércio internacional",
        "Leis sobre propriedade intelectual",
        "Direitos relacionados ao trabalho"
      ],
      "correct": 0
    },
    {
      "question": "Qual é a função principal do Tribunal Supremo em Moçambique?",
      "options": [
        "Elaborar leis",
        "Julgar os recursos de última instância",
        "Conduzir investigações criminais",
        "Revisar decretos do governo"
      ],
      "correct": 1
    },
    {
      "question": "O que significa a sigla CNE no contexto do Direito Moçambicano?",
      "options": [
        "Conselho Nacional de Educação",
        "Comissão Nacional de Eleições",
        "Comitê Nacional de Empresas",
        "Câmara Nacional de Estudos"
      ],
      "correct": 1
    },
    {
      "question": "Qual é a principal fonte de receita do Estado em Moçambique?",
      "options": ["Impostos", "Doações", "Exportações", "Multas"],
      "correct": 0
    },
    {
      "question": "O que é o direito penal?",
      "options": [
        "O conjunto de normas que regula crimes e punições",
        "Regras sobre contratos comerciais",
        "Direito sobre propriedade intelectual",
        "Normas ambientais"
      ],
      "correct": 0
    },
    {
      "question": "Quem nomeia o Primeiro-Ministro em Moçambique?",
      "options": ["Assembleia da República", "Presidente da República", "Tribunal Supremo", "Governo Provincial"],
      "correct": 1
    },
    {
      "question": "O que é uma sentença judicial?",
      "options": [
        "A decisão final de um juiz em um processo",
        "Uma proposta de lei",
        "Um contrato público",
        "Um relatório administrativo"
      ],
      "correct": 0
    }, {
  "question": "O que é a Procuradoria-Geral da República em Moçambique?",
      "options": [
        "O órgão responsável pela supervisão da legalidade",
        "O órgão legislativo nacional",
        "Uma instituição financeira",
        "Um tribunal regional"
      ],
      "correct": 0
    },
    {
      "question": "Qual é a diferença entre uma lei ordinária e uma lei constitucional?",
      "options": [
        "A lei constitucional tem maior hierarquia e trata de temas fundamentais",
        "A lei ordinária regula apenas aspectos internacionais",
        "Ambas têm a mesma importância",
        "As leis ordinárias não precisam ser cumpridas"
      ],
      "correct": 0
    },
    {
      "question": "O que é o direito do trabalho?",
      "options": [
        "Conjunto de normas que regem as relações entre empregadores e trabalhadores",
        "Leis sobre comércio exterior",
        "Direitos de consumidores",
        "Normas ambientais"
      ],
      "correct": 0
    }],

    ingles: [{
      "question": "What is the past tense of the verb 'go'?",
      "options": ["Goes", "Going", "Went", "Gone"],
      "correct": 2
    },
    {
      "question": "Which of these words is a synonym for 'happy'?",
      "options": ["Sad", "Joyful", "Angry", "Tired"],
      "correct": 1
    },
    {
      "question": "What is the plural form of 'child'?",
      "options": ["Childs", "Children", "Childes", "Child"],
      "correct": 1
    },
    {
      "question": "Which article is used before a vowel sound?",
      "options": ["A", "An", "The", "No article"],
      "correct": 1
    },
    {
      "question": "What is the correct translation of 'Eu gosto de ler livros'?",
      "options": ["I like reading books", "I liked to read books", "I love books", "I am reading books"],
      "correct": 0
    },
    {
      "question": "Choose the correct form: 'She _____ to school every day.'",
      "options": ["Go", "Goes", "Going", "Went"],
      "correct": 1
    },
    {
      "question": "Which of these is a regular verb?",
      "options": ["Run", "Dance", "Eat", "Swim"],
      "correct": 1
    },
    {
      "question": "What is the correct comparative form of 'big'?",
      "options": ["Bigger", "Biggest", "More big", "Most big"],
      "correct": 0
    },
    {
      "question": "Complete the sentence: 'I am ______ a movie now.'",
      "options": ["Watch", "Watching", "Watched", "Watches"],
      "correct": 1
    },
             {
    "question": "Which word is a noun?",
      "options": ["Quickly", "Beautiful", "Happiness", "Run"],
      "correct": 2
    },
    {
      "question": "What is the meaning of 'library'?",
      "options": ["A place to borrow books", "A place to eat", "A place to study science", "A place to sleep"],
      "correct": 0
    },
    {
      "question": "What is the superlative form of 'fast'?",
      "options": ["Faster", "Fastest", "More fast", "Most fast"],
      "correct": 1
    },
    {
      "question": "How do you say 'boa noite' in English?",
      "options": ["Good evening", "Good morning", "Good night", "Good afternoon"],
      "correct": 2
    },
    {
      "question": "What is the plural form of 'mouse'?",
      "options": ["Mouses", "Mice", "Mouse", "Mices"],
      "correct": 1
    },
    {
      "question": "Which of these sentences is correct?",
      "options": [
        "He don’t like coffee.",
        "He doesn’t likes coffee.",
        "He doesn’t like coffee.",
        "He don’t likes coffee."
      ],
      "correct": 2
    },
    {
      "question": "What is the opposite of 'cold'?",
      "options": ["Hot", "Warm", "Cool", "Freezing"],
      "correct": 0
    },
    {
      "question": "Choose the correct preposition: 'He is good _____ math.'",
      "options": ["At", "In", "On", "With"],
      "correct": 0
    },
        {
    "question": "Which of these is a question word?",
      "options": ["And", "But", "Why", "Because"],
      "correct": 2
    },
    {
      "question": "What is the correct order: 'usually / we / dinner / at / 7 pm / have'?",
      "options": [
        "We usually have dinner at 7 pm.",
        "Usually we have dinner at 7 pm.",
        "We have dinner usually at 7 pm.",
        "We have dinner at usually 7 pm."
      ],
      "correct": 0
    },
    {
      "question": "What is the opposite of 'early'?",
      "options": ["Fast", "Late", "Quick", "Soon"],
      "correct": 1
    },
    {
      "question": "What does 'hungry' mean?",
      "options": ["Feeling tired", "Feeling sleepy", "Feeling thirsty", "Feeling the need to eat"],
      "correct": 3
    },
    {
      "question": "Choose the correct option: 'She ______ coffee every morning.'",
      "options": ["Drinks", "Drink", "Drank", "Drinking"],
      "correct": 0
    },
    {
      "question": "What is the past tense of 'eat'?",
      "options": ["Eated", "Ate", "Eating", "Eats"],
      "correct": 1
    },
    {
      "question": "Complete the sentence: 'We _____ to the park yesterday.'",
      "options": ["Go", "Goes", "Went", "Gone"],
      "correct": 2
    },
    {
      "question": "Which word is an adjective?",
      "options": ["Quickly", "Beautiful", "Run", "Eat"],
      "correct": 1
    },
    {
      "question": "What is the meaning of 'teacher'?",
      "options": ["A person who teaches", "A person who studies", "A person who cooks", "A person who works"],
      "correct": 0
    },
             {
    "question": "What is the plural of 'person'?",
      "options": ["People", "Persons", "Peoples", "Person"],
      "correct": 0
    },
    {
      "question": "What does 'often' mean?",
      "options": ["Always", "Never", "Sometimes", "Frequently"],
      "correct": 3
    },
    {
      "question": "What is the synonym of 'quick'?",
      "options": ["Fast", "Slow", "Late", "Calm"],
      "correct": 0
    },
    {
      "question": "What is the opposite of 'clean'?",
      "options": ["Dirty", "Tidy", "Bright", "Clear"],
      "correct": 0
    },
    {
      "question": "What does 'tall' mean?",
      "options": ["Short", "High", "Wide", "Thin"],
      "correct": 1
    },
    {
      "question": "Complete the sentence: 'I _____ my homework now.'",
      "options": ["Do", "Did", "Am doing", "Does"],
      "correct": 2
    },
    {
      "question": "What is the meaning of 'family'?",
      "options": ["A group of friends", "A group of relatives", "A group of students", "A group of teachers"],
      "correct": 1
    },
    {
      "question": "What is the opposite of 'happy'?",
      "options": ["Joyful", "Angry", "Sad", "Excited"],
      "correct": 2
    },
    {
      "question": "Choose the correct form: 'They _____ at school.'",
      "options": ["Is", "Are", "Am", "Was"],
      "correct": 1
    },
    {
      "question": "What does 'book' mean?",
      "options": ["To reserve", "A printed work", "A notebook", "A place to stay"],
      "correct": 1
    },
    {
      "question": "What is the meaning of 'study'?",
      "options": ["To read books", "To learn", "To go to school", "To teach"],
      "correct": 1
    },
        {
  "question": "What is the synonym of 'start'?",
      "options": ["Begin", "Finish", "End", "Close"],
      "correct": 0
    },
    {
      "question": "What is the past tense of 'write'?",
      "options": ["Wrote", "Written", "Writing", "Writes"],
      "correct": 0
    }],

    






    quimica: [{
      question: "Qual é o símbolo químico do Ouro?",
      options: ["Au", "Ag", "Fe", "Cu"],
      correct: 0
    }],
    moda: [{
      question: "Exemplo de questão de Moda",
      options: ["Opção 1", "Opção 2", "Opção 3", "Opção 4"],
      correct: 0
    }]
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
