export function getUserPermissions(username) {
  const permissions = {
    'Camilo Duvane': {
      study: ['matematica', 'fisica', 'quimica', 'biologia'],
      quiz: ['matematica', 'fisica', 'quimica', 'biologia']
    },
    'Camilo Wiliamo': {
      study: ['matematica', 'fisica', 'biologia'],
      quiz: ['matematica', 'fisica', 'biologia']
    },
    'Cíntia Mucumbi': {
      study: ['matematica', 'fisica', 'quimica', 'biologia'],
      quiz: ['matematica', 'fisica', 'quimica', 'biologia'] 
    },
    'Milo': {
      study: ['matematica', 'fisica', 'biologia'],
      quiz: ['matematica', 'fisica', 'biologia']
    }
  };
  return permissions[username] || {
    study: [],
    quiz: []
  };
}