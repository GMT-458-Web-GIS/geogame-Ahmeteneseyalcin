// ==========================================
// GLOBAL DEĞİŞKENLER VE AYARLAR
// ==========================================
let state = {
    score: 0,
    lives: 3,
    timeLeft: 60,
    isBonusRound: false,
    currentTarget: null, // Şu an aranan ülke (örn: "Turkey")
    guessedNeighborsInRound: [] // Bonus turunda bilinenler
};

let timerInterval;
let geoJsonLayer; // Harita katmanını tutacak değişken

// Verileri tutacak değişkenler (Başlangıçta boş)
let geoJSONData = null;
let neighborData = null;

// HTML Elementlerini Seç
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
// BÖLÜM 1: HARİTA BAŞLATMA (LEAFLET)
// ==========================================
// Haritayı dünya görünümünde başlat
const map = L.map('map-container').setView([20, 0], 2);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
}).addTo(map);


// ==========================================
// BÖLÜM 2: VERİ YÜKLEME (FETCH API) - KRİTİK KISIM
// ==========================================
// Bu fonksiyon dışarıdaki .geojson ve .json dosyalarını yükler.
async function loadExternalData() {
    els.taskText.textContent = "Veriler yükleniyor, lütfen bekleyin...";
    console.log("Veri yükleme işlemi başladı...");

    try {
        // 1. GeoJSON (Harita Sınırları) dosyasını yükle
        // 'countries.geojson' dosyasının klasörde olduğundan emin ol.
        const geoResponse = await fetch('countries.json');
        if (!geoResponse.ok) throw new Error("countries.geojson dosyası bulunamadı!");
        geoJSONData = await geoResponse.json();
        console.log("GeoJSON yüklendi.");

        // 2. Komşuluk JSON dosyasını yükle
        // 'neighbors.json' dosyasının klasörde olduğundan emin ol.
        // EĞER BU DOSYAYI BULAMAZSAN: Aşağıdaki 3 satırı sil ve yerine
        // neighborData = { "Turkey": ["Greece", "Bulgaria"], "Germany": ["France"] };
        // gibi geçici el yapımı bir veri yaz.
        const neighborResponse = await fetch('neighbors.json');
        if (!neighborResponse.ok) throw new Error("neighbors.json dosyası bulunamadı!");
        neighborData = await neighborResponse.json();
        console.log("Komşuluk verisi yüklendi.");

        // Her şey yolunda, oyunu başlat
        initGameAfterLoad();

    } catch (error) {
        console.error("Kritik Hata:", error);
        els.taskText.innerHTML = `<strong style="color:red;">Hata: Veri dosyaları yüklenemedi!</strong><br>Lütfen F12'ye basıp Konsolu kontrol edin.`;
        alert("Hata! 'countries.geojson' ve 'neighbors.json' dosyalarının index.html ile aynı klasörde olduğundan emin olun.");
    }
}


// ==========================================
// BÖLÜM 3: OYUN FONKSİYONLARI
// ==========================================

// Veriler yüklendikten sonra çalışacak ana fonksiyon
function initGameAfterLoad() {
    // 1. Yüklenen GeoJSON Verisini Haritaya Ekle
    renderMapData();
    // 2. İlk turu başlat
    startNewRound();
}

// Harita Verisini Görselleştir
function renderMapData() {
    if (geoJsonLayer) map.removeLayer(geoJsonLayer);

    geoJsonLayer = L.geoJSON(geoJSONData, {
        style: { color: '#3388ff', weight: 1, fillOpacity: 0.4 },
        onEachFeature: function(feature, layer) {
            // Ülke adını al (Veri setine göre 'name', 'ADMIN', 'sovereignt' olabilir, kontrol et)
            const countryName = feature.properties.name || feature.properties.ADMIN;
            layer.on('click', function() {
                handleCountryClick(countryName);
            });
            // İpucu: Üzerine gelince adı yazsın
            layer.bindTooltip(countryName);
        }
    }).addTo(map);
}

// Yeni Tur Başlat (Aşama 1)
function startNewRound() {
    if (state.lives <= 0) { endGame(); return; }

    // Arayüzü sıfırla
    state.isBonusRound = false;
    state.timeLeft = 60;
    state.guessedNeighborsInRound = [];
    updateUI();
    els.stage1Area.style.display = 'block';
    els.stage2Area.style.display = 'none';

    // Rastgele bir ülke seç (Yüklenen gerçek veriden)
    const features = geoJSONData.features;
    const randomFeature = features[Math.floor(Math.random() * features.length)];
    // Ülke adını doğru özellikten aldığımıza emin olalım
    state.currentTarget = randomFeature.properties.name || randomFeature.properties.ADMIN;

    els.taskText.innerHTML = `GÖREV: Haritada <strong>${state.currentTarget}</strong> ülkesini bul!`;
    console.log(`Hedef ülke: ${state.currentTarget}`); // Test için konsola yaz

    // Zamanlayıcıyı başlat
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        state.timeLeft--;
        updateUI();
        if (state.timeLeft <= 0) {
            clearInterval(timerInterval);
            handleWrongGuess("Süre doldu!");
        }
    }, 1000);
}

// Haritada Tıklama Mantığı
function handleCountryClick(clickedCountryName) {
    if (state.isBonusRound) return;

    console.log(`Tıklanan: ${clickedCountryName}, Hedef: ${state.currentTarget}`);

    // Bazı veri setlerinde isimler farklı olabilir (örn: "United States" vs "USA")
    // Basit bir karşılaştırma yapıyoruz. Gerekirse daha karmaşık bir kontrol eklenebilir.
    if (clickedCountryName === state.currentTarget) {
        // DOĞRU
        clearInterval(timerInterval);
        state.score += 100;
        updateUI();
        startBonusRound();
    } else {
        // YANLIŞ
        handleWrongGuess(`Yanlış! Orası ${clickedCountryName}.`);
    }
}

// Yanlış Tahmin İşlemi
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

// Bonus Turunu Başlat (Aşama 2)
function startBonusRound() {
    // Hedef ülkenin komşu verisi var mı kontrol et
    if (!neighborData[state.currentTarget]) {
        alert(`Üzgünüm, ${state.currentTarget} için komşuluk verisi bulunamadı. Yeni tur başlıyor.`);
        startNewRound();
        return;
    }

    state.isBonusRound = true;
    els.stage1Area.style.display = 'none';
    els.stage2Area.style.display = 'block';
    els.bonusTaskText.innerHTML = `BONUS: <strong>${state.currentTarget}</strong> ülkesinin komşularını yaz!`;
    els.guessedList.innerHTML = '';
    els.neighborInput.value = '';
    els.feedback.textContent = '';
}

// Bonus Tahmin Kontrolü
function checkNeighborGuess() {
    const userGuessInput = els.neighborInput.value.trim();
    if (!userGuessInput) return;

    // Büyük/küçük harf duyarlılığını azaltmak için ilk harfi büyüt, kalanı küçült
    // (Veri setindeki isim formatına uydurmak gerekebilir)
    const userGuess = userGuessInput.charAt(0).toUpperCase() + userGuessInput.slice(1).toLowerCase();

    // Gerçek komşu listesini al
    const correctNeighbors = neighborData[state.currentTarget];

    if (correctNeighbors.includes(userGuess) && !state.guessedNeighborsInRound.includes(userGuess)) {
        // DOĞRU ve YENİ
        state.score += 10;
        state.guessedNeighborsInRound.push(userGuess);
        const li = document.createElement('li');
        li.textContent = `${userGuess} (+10)`;
        els.guessedList.appendChild(li);
        showFeedback("Doğru!", true);
    } else if (state.guessedNeighborsInRound.includes(userGuess)) {
         showFeedback("Bunu zaten yazdın.", false);
    } else {
        // Komşu listesinde yoksa yanlıştır
        showFeedback("Yanlış komşu veya ismi hatalı yazdın.", false);
        console.log(`Yanlış tahmin: ${userGuess}. Doğru liste:`, correctNeighbors);
    }
    els.neighborInput.value = '';
    updateUI();
}

// Yardımcı Fonksiyonlar
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
    alert(`Oyun Bitti! Toplam Skorun: ${state.score}`);
    location.reload();
}

// ==========================================
// BÖLÜM 4: OLAY DİNLEYİCİLERİ
// ==========================================
els.submitBtn.addEventListener('click', checkNeighborGuess);
els.finishBtn.addEventListener('click', startNewRound);
els.neighborInput.addEventListener('keypress', (e) => {
    if(e.key === 'Enter') checkNeighborGuess();
});

// ==========================================
// BAŞLAT!
// ==========================================
// Sayfa yüklendiğinde veri yükleme fonksiyonunu çağır
loadExternalData();