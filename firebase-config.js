// Configuração do Firebase
// Este arquivo deve ser configurado com suas credenciais do Firebase

// Para usar este arquivo:
// 1. Acesse https://console.firebase.google.com/
// 2. Crie um novo projeto ou use um existente
// 3. Vá em "Configurações do projeto" > "Geral" > "Seus aplicativos"
// 4. Clique em "Adicionar app" e selecione "Web"
// 5. Copie as configurações e substitua os valores abaixo

const firebaseConfig = {
    apiKey: "SUA_API_KEY_AQUI",
    authDomain: "seu-projeto.firebaseapp.com",
    databaseURL: "https://seu-projeto-default-rtdb.firebaseio.com",
    projectId: "seu-projeto",
    storageBucket: "seu-projeto.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef123456"
};

// Configuração das regras de segurança do Firestore
const firestoreRules = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Regras para usuários (apenas leitura para autenticados)
    match /usuarios/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if false; // Usuários não podem se auto-editar via Firestore
    }
    
    // Regras para imóveis
    match /imoveis/{imovelId} {
      // Leitura pública apenas para imóveis disponíveis e habilitados
      allow read: if resource.data.status == 'disponivel' && resource.data.habilitado == true;
      
      // Escrita apenas para usuários autenticados (admin)
      allow write: if request.auth != null;
    }
    
    // Regras para contatos
    match /contatos/{contatoId} {
      // Apenas criação permitida (para formulário de contato)
      allow create: if true;
      
      // Leitura apenas para usuários autenticados
      allow read: if request.auth != null;
    }
  }
}
`;

// Configuração das regras do Realtime Database (alternativa ao Firestore)
const realtimeDatabaseRules = {
    "rules": {
        "usuarios": {
            "$uid": {
                ".read": "$uid === auth.uid",
                ".write": false
            }
        },
        "imoveis": {
            ".read": true,
            "$imovelId": {
                ".write": "auth != null"
            }
        },
        "contatos": {
            ".read": "auth != null",
            ".write": true
        }
    }
};

module.exports = {
    firebaseConfig,
    firestoreRules,
    realtimeDatabaseRules
};

