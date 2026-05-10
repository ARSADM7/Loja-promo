import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-analytics.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, Timestamp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDye9D5STMA4DuKFTIXGMjLdawHI-CszXo",
    authDomain: "arsadmtv1.firebaseapp.com",
    projectId: "arsadmtv1",
    storageBucket: "arsadmtv1.firebasestorage.app",
    messagingSenderId: "527707354735",
    appId: "1:527707354735:web:b758544ef609789d647f9a",
    measurementId: "G-BKBX0TSDNX"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

// Expor para uso global (onclick)
window.firebaseAuth = auth;
window.firebaseSignIn = signInWithEmailAndPassword;
window.firebaseOnAuthChange = onAuthStateChanged;
window.firebaseSignOut = signOut;
window.firebaseDb = db;
window.firebaseDoc = doc;
window.firebaseGetDoc = getDoc;
window.firebaseSetDoc = setDoc;
window.firebaseServerTimestamp = serverTimestamp;
window.firebaseTimestamp = Timestamp;

console.log("✅ Firebase + Firestore inicializados");

// ========== TOAST ==========
let autoCloseTimer = null;
window.mostrarToast = function() { 
    const toast = document.getElementById('toast-message'); 
    const bar = document.getElementById('toast-timer'); 
    if(bar) { bar.style.animation = 'none'; setTimeout(() => bar.style.animation = 'timerShrink 60s linear forwards', 10); } 
    toast.classList.add('show'); 
    autoCloseTimer = setTimeout(() => window.fecharToast(), 60000); 
};
window.fecharToast = function() { 
    document.getElementById('toast-message').classList.remove('show'); 
    if(autoCloseTimer) clearTimeout(autoCloseTimer); 
};

// ========== LOGIN SIMPLIFICADO COM CRIAÇÃO AUTOMÁTICA ==========
window.tentarLoginFirebase = async function() {
    const email = document.getElementById('email-login').value.trim();
    const password = document.getElementById('password-login').value.trim();
    const errorDiv = document.getElementById('login-error');
    errorDiv.textContent = '';
    
    if(!email || !password) {
        errorDiv.textContent = "❌ Preencha todos os campos!";
        return;
    }
    
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        console.log("✅ Login OK:", user.email);
        
        const userDocRef = doc(db, "users", user.uid);
        let userSnap = await getDoc(userDocRef);
        
        if (!userSnap.exists()) {
            console.log("📄 Criando documento padrão para o usuário");
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 30);
            await setDoc(userDocRef, {
                email: user.email,
                plan: "mensal",
                expiryDate: Timestamp.fromDate(expiryDate),
                isBlocked: false,
                isAdmin: false,
                createdAt: serverTimestamp()
            });
            userSnap = await getDoc(userDocRef);
        }
        
        const userData = userSnap.data();
        
        if (userData.isBlocked === true) {
            await signOut(auth);
            errorDiv.textContent = "⛔ Conta bloqueada. Contacte o suporte.";
            return;
        }
        
        let expiryDate = userData.expiryDate;
        if (expiryDate) {
            const expiry = expiryDate.toDate ? expiryDate.toDate() : new Date(expiryDate);
            if (expiry < new Date()) {
                await signOut(auth);
                errorDiv.textContent = "⛔ Assinatura expirada. Renove pelo WhatsApp.";
                return;
            }
        }
        
        localStorage.setItem("logado", "true");
        localStorage.setItem("userEmail", user.email);
        
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('whatsapp-float').style.display = 'none';
        document.getElementById('main-app').style.display = 'flex';
        
        if (window.canais && window.canais.length) window.carregarCanais();
        else {
            const wait = setInterval(() => {
                if (window.canais && window.canais.length) { clearInterval(wait); window.carregarCanais(); }
            }, 200);
        }
        
        window.mostrarToast();
        
    } catch (error) {
        console.error("❌ Erro login:", error);
        let msg = "❌ Erro ao fazer login.";
        if (error.code === 'auth/invalid-credential') msg = "❌ E-mail ou senha inválidos.";
        errorDiv.textContent = msg;
    }
};

window.logoutFirebase = async function() {
    await signOut(auth);
    localStorage.removeItem("logado");
    localStorage.removeItem("userEmail");
    document.getElementById('main-app').style.display = 'none';
    document.getElementById('whatsapp-float').style.display = 'flex';
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('email-login').value = '';
    document.getElementById('password-login').value = '';
    window.fecharToast();
};

// ========== PLAYER E CANAIS ==========
let player;
let canalAtual = null;
let usandoFallback = false;

window.canais = [];

window.criarCard = function(canal) {
    let card = document.createElement('div');
    card.className = 'channel-card';
    card.innerHTML = `<div class="channel-image-container"><img src="${canal.logo || ''}" alt="${canal.nome}"></div><div class="channel-info"><h3>${canal.nome}</h3></div>`;
    card.onclick = () => window.mudarCanal(canal);
    return card;
};

window.carregarCanais = function() {
    if (!window.canais.length) return;
    const categorias = ['esportes', 'variedades', 'noticias', 'documentario', 'infantil', 'filmes-series', '24horas'];
    categorias.forEach(cat => { const grid = document.getElementById('grid-' + cat); if(grid) grid.innerHTML = ''; });
    const gridTodos = document.getElementById('grid-todos'); if(gridTodos) gridTodos.innerHTML = '';
    window.canais.forEach(canal => {
        let card = window.criarCard(canal);
        const gridCategoria = document.getElementById('grid-' + canal.categoria);
        if(gridCategoria) gridCategoria.appendChild(card);
        if(gridTodos) gridTodos.appendChild(window.criarCard(canal));
    });
};

window.mudarCanal = function(canal) {
    canalAtual = canal;
    usandoFallback = false;
    let type = canal.url.includes(".m3u8") ? "application/x-mpegURL" : "video/mp4";
    player.src({ src: canal.url, type: type });
    player.load();
    player.play().catch(e => console.log("Autoplay bloqueado"));
    window.scrollTo({top: 0, behavior: 'smooth'});
};

window.abrirModal = function(cat) {
    let modal = document.getElementById('modal');
    let content = document.getElementById('modal-content');
    content.innerHTML = '';
    window.canais.filter(c => c.categoria === cat).forEach(c => { content.appendChild(window.criarCard(c)); });
    modal.style.display = 'flex';
};
window.fecharModal = function() { document.getElementById('modal').style.display = 'none'; };
window.abrirPrecos = function() { document.getElementById('price-modal').style.display = 'flex'; };
window.fecharPrecos = function() { document.getElementById('price-modal').style.display = 'none'; };
window.irParaPagamento = function() { window.fecharPrecos(); document.getElementById('purchase-modal').style.display = 'flex'; };
window.fecharCompra = function() { document.getElementById('purchase-modal').style.display = 'none'; };

// Carregar canais.json
(async function carregarDadosCanais() {
    try {
        const response = await fetch('canais.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        window.canais = await response.json();
        console.log(`✅ ${window.canais.length} canais carregados`);
        if (document.getElementById('main-app').style.display === 'flex') window.carregarCanais();
    } catch (erro) { console.error('❌ Erro canais.json:', erro); window.canais = []; }
})();

// Inicializar player
document.addEventListener('DOMContentLoaded', () => {
    player = videojs('main-player');
    player.on('error', function() {
        if (canalAtual && canalAtual.fallback && !usandoFallback) {
            usandoFallback = true;
            let type = canalAtual.fallback.includes(".m3u8") ? "application/x-mpegURL" : "video/mp4";
            player.src({ src: canalAtual.fallback, type: type });
            player.play();
        }
    });
});

// ========== OBSERVER SIMPLIFICADO (sem deslogar por erro de leitura) ==========
onAuthStateChanged(auth, async (user) => {
    if (user && localStorage.getItem("logado") === "true") {
        try {
            const userDocRef = doc(db, "users", user.uid);
            let userSnap = await getDoc(userDocRef);
            if (!userSnap.exists()) {
                const expiryDate = new Date();
                expiryDate.setDate(expiryDate.getDate() + 30);
                await setDoc(userDocRef, {
                    email: user.email,
                    plan: "mensal",
                    expiryDate: Timestamp.fromDate(expiryDate),
                    isBlocked: false,
                    isAdmin: false,
                    createdAt: serverTimestamp()
                });
                userSnap = await getDoc(userDocRef);
            }
            const userData = userSnap.data();
            const blocked = userData.isBlocked === true;
            let expired = false;
            if (userData.expiryDate) {
                const expiry = userData.expiryDate.toDate ? userData.expiryDate.toDate() : new Date(userData.expiryDate);
                if (expiry < new Date()) expired = true;
            }
            if (blocked || expired) {
                await signOut(auth);
                localStorage.removeItem("logado");
                document.getElementById('login-screen').style.display = 'flex';
                document.getElementById('whatsapp-float').style.display = 'flex';
                document.getElementById('main-app').style.display = 'none';
                return;
            }
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('whatsapp-float').style.display = 'none';
            document.getElementById('main-app').style.display = 'flex';
            if (window.canais.length) window.carregarCanais();
            setTimeout(() => window.mostrarToast(), 1000);
        } catch (err) {
            console.error("Observer error:", err);
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('whatsapp-float').style.display = 'none';
            document.getElementById('main-app').style.display = 'flex';
            if (window.canais.length) window.carregarCanais();
        }
    } else if (!user) {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('whatsapp-float').style.display = 'flex';
        document.getElementById('main-app').style.display = 'none';
    }

    window.addEventListener('offline', () => {
  const status = document.createElement('div');
  status.id = 'offline-banner';
  status.innerText = '⚠️ Você está offline. Os canais só serão carregados quando a conexão voltar.';
  status.style.position = 'fixed';
  status.style.bottom = '0';
  status.style.left = '0';
  status.style.right = '0';
  status.style.background = '#ff9800';
  status.style.color = '#000';
  status.style.textAlign = 'center';
  status.style.padding = '8px';
  status.style.zIndex = '20000';
  document.body.appendChild(status);
});
window.addEventListener('online', () => {
  const banner = document.getElementById('offline-banner');
  if (banner) banner.remove();
});
});
