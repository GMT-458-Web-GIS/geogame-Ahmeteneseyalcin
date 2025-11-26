// ==========================================
// GLOBAL VARIABLES & SETTINGS
// ==========================================
let state = {
    score: 0,
    lives: 3,
    timeLeft: 60,
    isBonusRound: false,
    currentTarget: null,
    guessedNeighborsInRound: []
};

let timerInterval;
let geoJsonLayer;

let geoJSONData = null;
let neighborData = null;

const els = {
    score: document.getElementById('score-disp'),
    lives: document.getElementById('lives-disp'),
    timer: document.getElementById('timer-disp'),
    taskText: document.getElementById('task-text'),
    stage1Area: document.getElementById('stage1-area'),
    stage2Area: document.getElementById('stage2-area'),
    bonusTaskText: document.getElementById('bonus-task-text'),
    neighborInput: document.getElementById('neighbor-input'),
    submitBtn: document.getElementById('submit-guess-btn'),
    finishBtn: document.getElementById('finish-bonus-btn'),
    guessedList: document.getElementById('guessed-list'),
    feedback: document.getElementById('feedback-msg')
};

// ==========================================
// PART 1: MAP INITIALIZATION (LEAFLET)
// ==========================================
const map = L.map('map-container').setView([20, 0], 2);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
}).addTo(map);


// ==========================================
// PART 2: DATA LOADING (FETCH API)
// ==========================================
async function loadExternalData() {
    // DEĞİŞTİ: İngilizce yükleme mesajı
    els.taskText.textContent = "Loading data, please wait...";
    console.log("Data loading started...");

    try {
        // Dosya adının doğru olduğundan emin ol!
        const geoResponse = await fetch('countries.json');
        if (!geoResponse.ok) throw new Error("countries.geojson.json not found!");
        geoJSONData = await geoResponse.json();
        console.log("GeoJSON loaded.");

        const neighborResponse = await fetch('neighbors.json');
        if (!neighborResponse.ok) throw new Error("neighbors.json not found!");
        neighborData = await neighborResponse.json();
        console.log("Neighbor data loaded.");

        initGameAfterLoad();

    } catch (error) {
        console.error("Critical Error:", error);
        // DEĞİŞTİ: İngilizce hata mesajı
        els.taskText.innerHTML = `<strong style="color:red;">Error: Data files could not be loaded!</strong><br>Please check the Console (F12).`;
        alert("Error! Make sure 'countries.geojson.json' and 'neighbors.json' are in the same folder as index.html.");
    }
}


// ==========================================
// PART 3: GAME FUNCTIONS
// ==========================================

function initGameAfterLoad() {
    renderMapData();
    startNewRound();
}

function renderMapData() {
    if (geoJsonLayer) map.removeLayer(geoJsonLayer);

    geoJsonLayer = L.geoJSON(geoJSONData, {
        style: { color: '#3388ff', weight: 1, fillOpacity: 0.4 },
        onEachFeature: function(feature, layer) {
            const countryName = feature.properties.name || feature.properties.ADMIN;
            layer.on('click', function() {
                handleCountryClick(countryName);
            });
            // --- DÜZELTME: Tooltip (isim gösterme) satırı silindi ---
            // layer.bindTooltip(countryName);  <-- BU SATIR ARTIK YOK
        }
    }).addTo(map);
}

function startNewRound() {
    if (state.lives <= 0) { endGame(); return; }

    state.isBonusRound = false;
    state.timeLeft = 60;
    state.guessedNeighborsInRound = [];
    updateUI();
    els.stage1Area.style.display = 'block';
    els.stage2Area.style.display = 'none';

    const features = geoJSONData.features;
    const randomFeature = features[Math.floor(Math.random() * features.length)];
    state.currentTarget = randomFeature.properties.name || randomFeature.properties.ADMIN;

    // DEĞİŞTİ: İngilizce görev mesajı
    els.taskText.innerHTML = `TASK: Find <strong>${state.currentTarget}</strong> on the map!`;
    console.log(`Target country: ${state.currentTarget}`);

    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        state.timeLeft--;
        updateUI();
        if (state.timeLeft <= 0) {
            clearInterval(timerInterval);
            // DEĞİŞTİ: İngilizce süre doldu mesajı
            handleWrongGuess("Time's up!");
        }
    }, 1000);
}

function handleCountryClick(clickedCountryName) {
    if (state.isBonusRound) return;

    console.log(`Clicked: ${clickedCountryName}, Target: ${state.currentTarget}`);

    if (clickedCountryName === state.currentTarget) {
        clearInterval(timerInterval);
        state.score += 100;
        updateUI();
        startBonusRound();
    } else {
        // DEĞİŞTİ: İngilizce yanlış tahmin mesajı
        handleWrongGuess(`Wrong! That is ${clickedCountryName}.`);
    }
}

function handleWrongGuess(msg) {
    state.lives--;
    alert(msg);
    updateUI();
    if (state.lives > 0) {
        startNewRound();
    } else {
        endGame();
    }
}

function startBonusRound() {
    if (!neighborData[state.currentTarget]) {
        // DEĞİŞTİ: İngilizce veri yok mesajı
        alert(`Sorry, neighbor data not found for ${state.currentTarget}. Starting new round.`);
        startNewRound();
        return;
    }

    state.isBonusRound = true;
    els.stage1Area.style.display = 'none';
    els.stage2Area.style.display = 'block';
    // DEĞİŞTİ: İngilizce bonus görevi mesajı
    els.bonusTaskText.innerHTML = `BONUS: Type neighbors of <strong>${state.currentTarget}</strong>!`;
    els.guessedList.innerHTML = '';
    els.neighborInput.value = '';
    els.feedback.textContent = '';
}

function checkNeighborGuess() {
    const userGuessInput = els.neighborInput.value.trim();
    if (!userGuessInput) return;

    const userGuess = userGuessInput.charAt(0).toUpperCase() + userGuessInput.slice(1).toLowerCase();
    const correctNeighbors = neighborData[state.currentTarget];

    if (correctNeighbors.includes(userGuess) && !state.guessedNeighborsInRound.includes(userGuess)) {
        state.score += 10;
        state.guessedNeighborsInRound.push(userGuess);
        const li = document.createElement('li');
        li.textContent = `${userGuess} (+10)`;
        els.guessedList.appendChild(li);
        // DEĞİŞTİ: İngilizce doğru mesajı
        showFeedback("Correct!", true);
    } else if (state.guessedNeighborsInRound.includes(userGuess)) {
         // DEĞİŞTİ: İngilizce tekrar mesajı
         showFeedback("Already guessed.", false);
    } else {
        // DEĞİŞTİ: İngilizce yanlış komşu mesajı
        showFeedback("Wrong neighbor or misspelled.", false);
        console.log(`Wrong guess: ${userGuess}. Correct list:`, correctNeighbors);
    }
    els.neighborInput.value = '';
    updateUI();
}

function showFeedback(msg, isSuccess) {
    els.feedback.textContent = msg;
    els.feedback.className = isSuccess ? 'success-msg' : 'error-msg';
    setTimeout(() => { els.feedback.textContent = ''; }, 3000);
}

function updateUI() {
    els.score.textContent = `Score: ${state.score}`;
    els.lives.textContent = `Lives: ${"❤️".repeat(state.lives)}`;
    els.timer.textContent = `Time: ${state.timeLeft}`;
}

function endGame() {
    clearInterval(timerInterval);
    // DEĞİŞTİ: İngilizce oyun sonu mesajı
    alert(`Game Over! Your Total Score: ${state.score}`);
    location.reload();
}

// ==========================================
// PART 4: EVENT LISTENERS
// ==========================================
els.submitBtn.addEventListener('click', checkNeighborGuess);
els.finishBtn.addEventListener('click', startNewRound);
els.neighborInput.addEventListener('keypress', (e) => {
    if(e.key === 'Enter') checkNeighborGuess();
});

// ==========================================
// START!
// ==========================================
loadExternalData();

