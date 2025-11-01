// --- SPA Section Navigation (Original) ---
const sections = document.querySelectorAll('.section');
const homeBtn = document.getElementById('nav-home');
const loginBtn = document.getElementById('nav-login');
const signupBtn = document.getElementById('nav-signup');

// --- Dashboard V2 Elements ---
const sidebarProfileBtn = document.getElementById('sidebar-profile-btn');
const sidebarHeadlinesBtn = document.getElementById('sidebar-headlines-btn');
const sidebarFavoritesBtn = document.getElementById('sidebar-favorites-btn');
const sidebarLogoutBtn = document.getElementById('sidebar-logout-btn');

const dashboardTitle = document.getElementById('dashboard-title');
const currentTimeDisplay = document.getElementById('current-time');
const dashboardViews = document.querySelectorAll('.dashboard-view');
const sidebarLinks = document.querySelectorAll('.sidebar-link');

const headlinesContainer = document.getElementById('headlines-container');
const favoritesContainer = document.getElementById('favorites-container');
const profileName = document.getElementById('profile-name');
const profileEmail = document.getElementById('profile-email');
const statsFavorites = document.getElementById('stats-favorites');
const statsRead = document.getElementById('stats-read');
const statsTopCategory = document.getElementById('stats-top-category');
const newsletterCheck = document.getElementById('newsletter-check');
const searchInput = document.getElementById('search-bar');
const searchButton = document.getElementById('search-btn');

// --- [NEW] Onboarding Elements ---
const onboardWelcome = document.getElementById('onboard-welcome');
const categoryPicker = document.querySelector('.onboard-category-picker');
const savePrefsBtn = document.getElementById('save-preferences-btn');

// --- [NEW] Push Notification Elements ---
const enablePushBtn = document.getElementById('enable-push-btn');
const sendTestPushBtn = document.getElementById('send-test-push-btn');

// --- API Configuration ---
const NEWS_API_URL_TOP = '/api/news';
const NEWS_API_URL_EVERYTHING = '/api/news';
const AUTH_API_URL = '/api/auth';
const USER_API_URL = '/api/user';


// --- [CRITICAL] PASTE YOUR PUBLIC KEY HERE ---
// This MUST match the public key you generated and put in your .env file
const VAPID_PUBLIC_KEY = 'BBgYUtscPZQf8rW-FA5qvqJdiJFk3ySMgqJKFzOt-orAihWgGnM6JqGsMn2iH858Ele-Mj1PfmVe5AWf6qtPNE0';
// ---

// --- State Variables ---
let sourceChart = null;
let timeIntervalId = null;
let popupTimer = null; // For the 10-second newsletter nudge
let serviceWorkerReg = null; // [NEW] To hold the service worker registration

// ================== TIME FUNCTIONS ==================
function timeAgo(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${hours}h ago`;
  return `${days}d ago`;
}
function updateTime() {
  if (currentTimeDisplay && document.body.classList.contains('dashboard-active')) {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata'
    });
    currentTimeDisplay.textContent = timeString;
  }
}
setInterval(() => {
  document.querySelectorAll('.time-label').forEach(label => {
    const time = label.getAttribute('data-time');
    if (time) {
        const newTimeAgo = timeAgo(time);
        if (label.textContent !== newTimeAgo) {
            label.textContent = newTimeAgo;
        }
    }
  });
}, 60000);

// ================== DASHBOARD & NEWS FUNCTIONS ==================

// --- Dashboard View Manager ---
function showDashboardView(viewId) {
  // [MODIFIED] Reset title by default
  if(dashboardTitle) dashboardTitle.textContent = 'Headlines'; 
  
  if (viewId === 'favorites-view') { dashboardTitle.textContent = 'My Favorites'; }
  else if (viewId === 'profile-view') { dashboardTitle.textContent = 'My Profile'; }
  dashboardViews.forEach(view => view.classList.toggle('active', view.id === viewId));
  sidebarLinks.forEach(link => link.classList.remove('active'));
  const activeBtn = document.getElementById(`sidebar-${viewId.split('-')[0]}-btn`);
  if (activeBtn) {
      activeBtn.classList.add('active');
  }
}

// --- Main Section Navigation ---
function showSection(id) {
  sections.forEach(sec => sec.classList.remove('active'));
  const element = document.getElementById(id);
  if (element) { element.classList.add('active'); }
  window.scrollTo(0, 0);
  document.body.classList.toggle('dashboard-active', id === 'dashboard');
  if (id === 'dashboard') {
      if (!timeIntervalId) {
          updateTime();
          timeIntervalId = setInterval(updateTime, 1000);
      }
  } else {
      if (timeIntervalId) {
          clearInterval(timeIntervalId);
          timeIntervalId = null;
          if (currentTimeDisplay) currentTimeDisplay.textContent = '';
      }
  }
}

// --- Top-Level Event Listeners ---
const getStartedBtn = document.querySelectorAll('.btn-start');
const toSignup = document.getElementById('to-signup');
const toLogin = document.getElementById('to-login');
homeBtn?.addEventListener('click', (e) => { e.preventDefault(); showSection('home'); });
loginBtn?.addEventListener('click', (e) => { e.preventDefault(); showSection('login'); });
signupBtn?.addEventListener('click', (e) => { e.preventDefault(); showSection('signup'); });
getStartedBtn.forEach(btn => btn.addEventListener('click', (e) => { e.preventDefault(); showSection('login'); }));
toSignup?.addEventListener('click', (e) => { e.preventDefault(); showSection('signup'); });
toLogin?.addEventListener('click', (e) => { e.preventDefault(); showSection('login'); });
sidebarHeadlinesBtn?.addEventListener('click', (e) => { e.preventDefault(); showDashboardView('headlines-view'); });
sidebarFavoritesBtn?.addEventListener('click', (e) => { e.preventDefault(); showDashboardView('favorites-view'); renderFavorites(); });
sidebarProfileBtn?.addEventListener('click', (e) => { e.preventDefault(); showDashboardView('profile-view'); });
sidebarLogoutBtn?.addEventListener('click', (e) => { e.preventDefault(); logout(); });

// --- News API Integration (General News) ---
async function fetchNews(category = 'general', country = 'us', query = '') {
  headlinesContainer.innerHTML = '<div class="loading-spinner">Loading news...</div>';
  try {
    let url;
    const params = new URLSearchParams(); 
    if (query) {
      params.set('q', query);
      url = `${NEWS_API_URL_EVERYTHING}?${params.toString()}`;
    } else {
      params.set('country', country);
      params.set('category', category);
      url = `${NEWS_API_URL_TOP}?${params.toString()}`;
    }
    const response = await fetch(url); 
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Server Error: ${errorData.msg || response.statusText} (${response.status})`);
    }
    const data = await response.json();
    if (data.status === "error") {
        throw new Error(`NewsAPI Error: ${data.message} (${data.code})`);
    }
    if (data.articles && data.articles.length > 0) {
      return data.articles.filter(article => article.title && article.title !== '[Removed]' && article.source?.name && article.urlToImage && article.url);
    } else {
      throw new Error('No articles found.');
    }
  } catch (error) {
    console.error('Error fetching news:', error);
    headlinesContainer.innerHTML = `<div class="empty-state">Could not load articles. ${error.message}</div>`;
    renderSourcePieChart([]);
    renderWordCloud([]);
    return [];
  }
}

// --- [REFACTORED] News Rendering (with Summarize/Translate) ---
function renderNewsArticles(articles) {
  headlinesContainer.innerHTML = '';
  if (!articles || articles.length === 0) {
    if (!headlinesContainer.querySelector('.empty-state')) {
      // [MODIFIED] Added 'localActive' check
      const forYouActive = document.querySelector('.category-btn[data-category="foryou"]')?.classList.contains('active');
      const localActive = document.querySelector('.category-btn[data-category="local"]')?.classList.contains('active');
      if(forYouActive) {
        headlinesContainer.innerHTML = '<div class="empty-state">Your feed is empty. Try adding more topics in your profile.</div>';
      } else if(localActive) {
        headlinesContainer.innerHTML = '<div class="empty-state">No local news found for your city.</div>';
      } else {
        headlinesContainer.innerHTML = '<div class="empty-state">No articles found.</div>';
      }
    }
    renderSourcePieChart([]);
    renderWordCloud([]);
    return;
  }

  articles.forEach(article => {
    const isFavorite = isArticleFavorited(article);
    const articleEl = document.createElement('div');
    articleEl.className = 'article-item';
    const articleJson = JSON.stringify(article).replace(/"/g, '&quot;');
    const relativeTime = timeAgo(article.publishedAt);
    const description = article.description ? article.description.replace(/<[^>]*>?/gm, '') : '';

    // This is YOUR HTML with the Summarize button
    articleEl.innerHTML = `
      <div class="article-item-img">
        <img src="${article.urlToImage}" alt="" loading="lazy" onerror="this.parentElement.style.display='none'">
      </div>
      <div class="article-item-content">
        <h4>${article.title}</h4>
        <p class="article-description">${description}</p>
        <button class="summarize-btn">🧠 Summarize</button>
        <p class="article-summary" style="display:none; font-style:italic; margin-top:8px;"></p>
        <p class="article-source">${article.source.name} • <span class="time-label" data-time="${article.publishedAt}">${relativeTime}</span></p>
      </div>
      <div class="article-item-actions">
        <button title="Toggle Favorite" class="action-btn ${isFavorite ? 'favorited' : ''}" onclick="toggleFavorite(this, ${articleJson})">
          <i class="fa-${isFavorite ? 'solid' : 'regular'} fa-star"></i>
        </button>
      </div>
    `;
    articleEl.addEventListener('click', (e) => { if (!e.target.closest('button')) { window.open(article.url, '_blank'); addToHistory(article); } });
    headlinesContainer.appendChild(articleEl);

    // This is YOUR Summarize/Translate/Listen logic
    const summarizeBtn = articleEl.querySelector('.summarize-btn');
    const summaryPara = articleEl.querySelector('.article-summary');
    summarizeBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      summarizeBtn.textContent = "Summarizing...";
      try {
        const res = await fetch("/api/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: article.description || article.title })
        });
        const data = await res.json();
        if (data.summary) {
          summaryPara.innerHTML = `
            ${data.summary}
            <br>
            <div class="translate-container">
              <button class="translate-btn">🌐 Translate</button>
              <select class="languageSelect">
                <option value="" selected disabled>Select Language</option>
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="mr">Marathi</option>
                <option value="ta">Tamil</option>
                <option value="bn">Bengali</option>
              </select>
            </div>
            <button class="listen-btn">🔊 Listen</button>
            <button class="stop-btn">⏹️ Stop</button>
          `;
          summaryPara.style.display = "block";
          const listenBtn = summaryPara.querySelector(".listen-btn");
          const stopBtn = summaryPara.querySelector(".stop-btn");
          const translateBtn = summaryPara.querySelector(".translate-btn");
          const languageSelect = summaryPara.querySelector(".languageSelect");
          languageSelect.addEventListener("click", (e) => e.stopPropagation());
          translateBtn.addEventListener("click", (e) => e.stopPropagation());
          
          let isSpeaking = false, isPaused = false, utterance;
          listenBtn.addEventListener("click", () => {
            if (isPaused) { speechSynthesis.resume(); isPaused = false; listenBtn.textContent = "⏸ Pause"; return; }
            if (isSpeaking) { speechSynthesis.pause(); isPaused = true; listenBtn.textContent = "▶ Resume"; return; }
            speechSynthesis.cancel();
            utterance = new SpeechSynthesisUtterance(data.summary);
            utterance.lang = "en-IN";
            utterance.rate = 1;
            utterance.onstart = () => { isSpeaking = true; listenBtn.textContent = "⏸ Pause"; };
            utterance.onend = () => { isSpeaking = false; isPaused = false; listenBtn.textContent = "🔊 Listen"; };
            speechSynthesis.speak(utterance);
          });
          stopBtn.addEventListener("click", () => {
            speechSynthesis.cancel(); isSpeaking = false; isPaused = false; listenBtn.textContent = "🔊 Listen";
          });

          translateBtn.addEventListener("click", async () => {
            const targetLang = languageSelect.value;
            if (!targetLang) { alert("Please select a language before translating!"); return; }
            translateBtn.textContent = "Translating...";
            try {
              const res = await fetch("/api/translate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: data.summary, targetLang })
              });
              const transData = await res.json();
              if (transData.translatedText) {
                summaryPara.innerHTML = `${transData.translatedText}<br><button class="listen-btn">🔊 Listen</button><button class="stop-btn">⏹️ Stop</button>`;
                const newListenBtn = summaryPara.querySelector(".listen-btn");
                const newStopBtn = summaryPara.querySelector(".stop-btn");
                newListenBtn.addEventListener("click", () => {
                  const utterance = new SpeechSynthesisUtterance(transData.translatedText);
                  switch (targetLang) {
                    case "hi": utterance.lang = "hi-IN"; break;
                    case "mr": utterance.lang = "mr-IN"; break;
                    case "ta": utterance.lang = "ta-IN"; break;
                    case "bn": utterance.lang = "bn-IN"; break;
                    default: utterance.lang = "en-IN";
                  }
                  utterance.rate = 1; utterance.pitch = 1;
                  const voices = speechSynthesis.getVoices();
                  const selectedVoice = voices.find(v => v.lang === utterance.lang) || voices.find(v => v.lang.startsWith(utterance.lang.split('-')[0])) || voices[0];
                  if (selectedVoice) utterance.voice = selectedVoice;
                  speechSynthesis.cancel();
                  speechSynthesis.speak(utterance);
                });
                newStopBtn.addEventListener("click", () => { speechSynthesis.cancel(); });
              } else {
                summaryPara.innerHTML += "<br><em>Translation unavailable.</em>";
              }
            } catch (err) {
              console.error("Translation Error:", err);
              summaryPara.innerHTML += "<br><em>Translation failed.</em>";
            } finally {
              translateBtn.textContent = "🌐 Translate";
              languageSelect.value = "";
            }
          });
        } else {
          summaryPara.textContent = "Summary unavailable."; summaryPara.style.display = "block";
        }
      } catch (err) {
        summaryPara.textContent = "Error generating summary."; summaryPara.style.display = "block";
      } finally {
        summarizeBtn.textContent = "🧠 Summarize";
      }
    });
  });
  renderSourcePieChart(articles);
  renderWordCloud(articles);
}

// --- General Headlines Function ---
async function renderHeadlines(category = "general", query = '') {
  // [MODIFIED] Default country is 'us'. We don't use 'us' for search.
  const country = (query ? '' : 'us');
  const news = await fetchNews(category, country, query);
  renderNewsArticles(news);
}

// --- "For You" Feed Function ---
async function renderForYouFeed() {
  headlinesContainer.innerHTML = '<div class="loading-spinner">Building your feed...</div>';
  try {
    const data = await fetchWithAuth(`${NEWS_API_URL_TOP}/foryou`, { method: 'GET' });
    renderNewsArticles(data.articles);
    if (!localStorage.getItem('hasSeenNewsletterNudge')) {
      localStorage.setItem('hasSeenNewsletterNudge', 'true');
      showNewsletterNudge();
    }
  } catch (error) {
    console.error('Error fetching "For You" feed:', error);
    if (error.message.includes('No preferences set')) {
      showSection('onboarding');
      if (onboardWelcome) {
        const name = localStorage.getItem('userName')?.split(' ')[0] || 'User';
        onboardWelcome.textContent = `Welcome, ${name}!`;
      }
    } else {
      headlinesContainer.innerHTML = `<div class="empty-state">Could not load your feed. ${error.message}</div>`;
      renderSourcePieChart([]);
      renderWordCloud([]);
    }
  }
}

// --- [NEW] Local News Function (GNews) ---
async function renderLocalNews() {
  headlinesContainer.innerHTML = '<div class="loading-spinner">Getting your location...</div>';
  if (!navigator.geolocation) {
    headlinesContainer.innerHTML = '<div class="empty-state">Geolocation is not supported by your browser.</div>';
    return;
  }
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      headlinesContainer.innerHTML = '<div class="loading-spinner">Finding your city...</div>';
      try {
        const geoResponse = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
        const geoData = await geoResponse.json();
        const city = geoData.city || geoData.locality;
        if (!city) { throw new Error("Could not determine your city."); }
        headlinesContainer.innerHTML = `<div class="loading-spinner">Fetching news for ${city}...</div>`;
        
        // Note: This requires the /api/news/local route on your backend
        const newsResponse = await fetch(`${NEWS_API_URL_TOP}/local?city=${city}`);
        if (!newsResponse.ok) {
            const errorData = await newsResponse.json();
            throw new Error(errorData.msg || 'Failed to fetch local news.');
        }
        const data = await newsResponse.json();
        renderNewsArticles(data.articles);
        if(dashboardTitle) dashboardTitle.textContent = `Local News: ${city}`;
      } catch (err) {
        console.error("Local news error:", err);
        headlinesContainer.innerHTML = `<div class="empty-state">Could not load local news. ${err.message}</div>`;
        renderSourcePieChart([]);
        renderWordCloud([]);
      }
    },
    (error) => {
      console.error("Geolocation error:", error.message);
      let errorMsg = "Could not get your location.";
      if (error.code === 1) { errorMsg = "Please enable location services in your browser to see local news."; }
      headlinesContainer.innerHTML = `<div class="empty-state">${errorMsg}</div>`;
      renderSourcePieChart([]);
      renderWordCloud([]);
    }
  );
}

// --- Favorites System ---
function toggleFavorite(button, article) {
    let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    const articleIndex = favorites.findIndex(fav => fav.url === article.url);
    if (articleIndex === -1) { favorites.push(article); if(button){button.classList.add('favorited'); button.querySelector('i').classList.replace('fa-regular','fa-solid');} showNotification('Added to favorites!'); }
    else { favorites.splice(articleIndex, 1); if(button){button.classList.remove('favorited'); button.querySelector('i').classList.replace('fa-solid','fa-regular');} showNotification('Removed from favorites!'); }
    localStorage.setItem('favorites', JSON.stringify(favorites)); renderFavorites(); updateProfileStats();
}
function isArticleFavorited(article) { const favs=JSON.parse(localStorage.getItem('favorites')||'[]'); return favs.some(f=>f.url===article.url); }
function renderFavorites() {
    let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    favoritesContainer.innerHTML = '';
    if(favorites.length === 0){ favoritesContainer.innerHTML='<div class="empty-state">No favorites saved.</div>'; return; }
    favorites.forEach(article => {
        const articleEl = document.createElement('div'); articleEl.className='article-item';
        const articleJson = JSON.stringify(article).replace(/"/g, '&quot;');
        const relativeTime = timeAgo(article.publishedAt);
        const description = article.description ? article.description.replace(/<[^>]*>?/gm, '') : '';
        articleEl.innerHTML = `
          <div class="article-item-img"><img src="${article.urlToImage}" alt="" loading="lazy" onerror="this.parentElement.style.display='none'"></div>
          <div class="article-item-content">
            <h4>${article.title}</h4>
            <p class="article-description">${description}</p>
            <p class="article-source">${article.source.name} • <span class="time-label" data-time="${article.publishedAt}">${relativeTime}</span></p>
          </div>
          <div class="article-item-actions"><button title="Remove Favorite" class="action-btn remove" onclick="removeFavorite(event, ${articleJson})"><i class="fa-solid fa-trash"></i></button></div>`;
        articleEl.addEventListener('click', e=>{if(!e.target.closest('button')){window.open(article.url,'_blank');}});
        favoritesContainer.appendChild(articleEl);
    });
}
// [MODIFIED] Added 'local' case to removeFavorite
function removeFavorite(event, article) {
    event.stopPropagation(); 
    toggleFavorite(null, article);
    const activeBtn = document.querySelector('.category-btn.active');
    if (sidebarHeadlinesBtn?.classList.contains('active') && activeBtn) {
        const category = activeBtn.dataset.category;
        if (category === 'foryou') { renderForYouFeed(); }
        else if (category === 'local') { renderLocalNews(); }
        else { renderHeadlines(category, searchInput.value.trim()); }
    }
}

// --- History System ---
function addToHistory(article) { let h=JSON.parse(localStorage.getItem('history')||'[]'); h=h.filter(i=>i.url!==article.url); h.unshift(article); if(h.length>50){h=h.slice(0,50);} localStorage.setItem('history',JSON.stringify(h)); updateProfileStats(); }

// --- Chart Functions (Pie & WordCloud) ---
function renderSourcePieChart(headlines){const c=document.getElementById('sourcePieChart');if(!c)return; const x=c.getContext('2d'); const sC=headlines.reduce((a,r)=>{const n=r.source.name||'Unk';a[n]=(a[n]||0)+1;return a;},{}); const sS=Object.entries(sC).sort(([,a],[,b])=>b-a).slice(0,7); const l=sS.map(([n])=>n); const d=sS.map(([,c])=>c); if(sourceChart){sourceChart.destroy();} if(d.length>0){sourceChart=new Chart(x,{type:'doughnut',data:{labels:l,datasets:[{label:'Articles by Source',data:d,backgroundColor:['#362E6F','#6A5ACD','#B0AACE','#1A73E8','#93C5FD','#FBBC04','#A5D6A7'],borderColor:'#FFFFFF',borderWidth:2,hoverOffset:10,hoverBorderColor:'#333',hoverBorderWidth:1}]},options:{responsive:true,maintainAspectRatio:false,animation:{duration:1200,easing:'easeInOutQuart'},plugins:{legend:{position:'bottom',align:'center',labels:{color:getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim(),padding:20,usePointStyle:true,pointStyle:'rectRounded',font:{family:"'Poppins',sans-serif",size:12}}},tooltip:{backgroundColor:'rgba(0,0,0,0.7)',titleFont:{family:"'Poppins',sans-serif",size:14,weight:'bold'},bodyFont:{family:"'Poppins',sans-serif",size:12},padding:10,cornerRadius:8,displayColors:false}},cutout:'70%'}}); }else{x.clearRect(0,0,c.width,c.height);x.font="16px Poppins";x.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim();x.textAlign="center";x.fillText("No source data.",c.width/2,c.height/2);}}
function renderWordCloud(headlines){const c=document.getElementById('wordCloudCanvas');const a=document.getElementById('wordCloudAlt'); if(!c||typeof WordCloud!=='function'){return;} const sW=new Set(["a","about","above","after","again","against","all","am","an","and","any","are","aren't","as","at","be","because","been","before","being","below","between","both","but","by","can't","cannot","could","couldn't","did","didn't","do","does","doesn't","doing","don't","down","during","each","few","for","from","further","had","hadn't","has","hasn't","have","haven't","having","he","he'd","he'll","he's","her","here","here's","hers","herself","him","himself","his","how","how's","i","i'd","i'll","i'm","i've","if","in","into","is","isn't","it","it's","its","itself","let's","me","more","most","mustn't","my","myself","no","nor","not","of","off","on","once","only","or","other","ought","our","ours","ourselves","out","over","own","same","shan't","she","she'd","she'll","she's","should","shouldn't","so","some","such","than","that","that's","the","their","theirs","them","themselves","then","there","there's","these","they","they'd","they'll","they're","they've","this","those","through","to","too","under","until","up","very","was","wasn't","we","we'd","we'll","we're","we've","were","weren't","what","what's","when","when's","where","where's","which","while","who","who's","whom","why","why's","with","won't","would","wouldn't","you","you'd","you'll","you're","you've","your","yours","yourself","yourselves","news","says","update","latest","breaking","story","report","live","watch","video","photo","image","new","first","after","over","world","us","uk","will","may","just","day","week","month","year","says","like","get","make","one","two","three","covid-19","coronavirus","trump","biden"]); const wC={}; headlines.forEach(r=>{const t=`${r.title||''}`;const w=t.toLowerCase().match(/\b(\w+)\b/g); if(w){w.forEach(wd=>{if(wd.length>3&&!sW.has(wd)&&isNaN(wd)){wC[wd]=(wC[wd]||0)+1;}});}}); const lD=Object.entries(wC).map(([w,c])=>[w,c]).sort(([,a],[,b])=>b-a).slice(0,50); const p=c.parentElement; if(lD.length>5){const cw=p.clientWidth;const ch=p.clientHeight>100?p.clientHeight:300;c.width=Math.min(cw,600);c.height=Math.min(ch,350); const maxWeight=lD[0][1];const wf=s=>{const n=s/maxWeight;const maxS=Math.max(30,c.width/15);const minS=maxS/5;return minS+(Math.pow(n,0.7)*(maxS-minS));}; const opts={list:lD,gridSize:Math.max(4,Math.round(16*c.width/1024)),weightFactor:wf,fontFamily:'Poppins,sans-serif',color:'random-dark',rotateRatio:0.3,minRotation:-Math.PI/12,maxRotation:Math.PI/12,shuffle:true,shape:'circle',backgroundColor:'transparent',drawOutOfBound:false,hover:(i,d,e)=>{c.style.cursor=i?'pointer':'default';},click:i=>{if(i){const w=i[0];searchInput.value=w;searchButton.click();}}}; try{WordCloud(c,opts);if(a)a.textContent="WC terms: "+lD.map(i=>i[0]).slice(0,10).join(', ')+".";}catch(e){console.error("WC2 error:",e);if(a)a.textContent="WC error.";}}else{const x=c.getContext('2d');x.clearRect(0,0,c.width,c.height);x.font="16px Poppins";x.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim();x.textAlign="center";x.fillText("Not enough data.",c.width/2,c.height/2);if(a)a.textContent="WC: Not enough data.";}}// --- Profile & Stats Update ---
function updateProfileStats(){const f=JSON.parse(localStorage.getItem('favorites')||'[]');const h=JSON.parse(localStorage.getItem('history')||'[]'); if(statsFavorites){statsFavorites.textContent=f.length;}if(statsRead){statsRead.textContent=h.length;} if(h.length>0&&statsTopCategory){const c=h.reduce((a,r)=>{const s=r.source.name||'Unk';a[s]=(a[s]||0)+1;return a;},{});let t='Gen',m=0;for(const[cat,ct]of Object.entries(c)){if(ct>m){m=ct;t=cat;}}statsTopCategory.textContent=t;}else if(statsTopCategory){statsTopCategory.textContent='N/A';}}
function loadUserProfile(){const e=localStorage.getItem('userEmail')||'your@example.com';const n=localStorage.getItem('userName')||'Your Name';if(profileName){profileName.textContent=n;}if(profileEmail){profileEmail.textContent=e;}}

// --- Notification System ---
function showNotification(msg){const old=document.querySelector('.notification');if(old){old.remove();}const N=document.createElement('div');N.className='notification';N.textContent=msg;document.body.appendChild(N);setTimeout(()=>{N.style.transition='opacity 0.5s ease';N.style.opacity='0';setTimeout(()=>N.remove(),500);},2500);}

// --- Helper for Authenticated Fetch ---
async function fetchWithAuth(url,opts={}){const t=localStorage.getItem('token');if(!t){console.error("No token.");alert("Auth error.");logout();throw new Error("Auth required.");} const h={'Content-Type':'application/json','x-auth-token':t,...opts.headers}; const b=opts.body?JSON.stringify(opts.body):undefined; try{const r=await fetch(url,{...opts,headers:h,body:b});let d; const ct=r.headers.get("content-type"); if(ct?.includes("application/json")){d=await r.json();}else{d={msg:await r.text()||`Req failed (${r.status})`};} if(!r.ok){console.error("API Error:",d); throw new Error(d.msg||`Req failed (${r.status})`);} return d;} catch(err){console.error("Auth Fetch Err:",err); if(err.message.includes("Token")||err.message.includes("denied")||err.status===401){alert("Session expired.");logout();}else{alert(`Error: ${err.message}`);} throw err;}}

// --- Auth Helpers ---
async function handleAuthRequest(url,body){try{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok){throw new Error(d.msg||`Req failed (${r.status})`);} return d;}catch(err){console.error("Auth Err:",err);alert(`Error: ${err.message}`);throw err;}}

// --- Onboarding Logic ---
async function savePreferences() {
  const selectedNodes = categoryPicker.querySelectorAll('.onboard-category-btn.active');
  const preferences = Array.from(selectedNodes).map(btn => btn.dataset.category);
  if (preferences.length === 0) {
    alert('Please select at least one topic to get started.');
    return;
  }
  try {
    await fetchWithAuth(`${USER_API_URL}/preferences`, {
      method: 'POST',
      body: { preferences: preferences }
    });
    showSection('dashboard');
    loadDashboard();
  } catch (err) {
    alert("Could not save preferences. Please try again.");
    console.error("Error saving preferences:", err);
  }
}

// --- Newsletter Nudge Popup Logic ---
function showNewsletterNudge() {
  const popup = document.createElement('div');
  popup.className = 'explore-popup';
  popup.innerHTML = `
    <div class="popup-content">
      <h4>Get this feed on the go?</h4>
      <p>Want a daily digest of headlines from your topics sent to your inbox?</p>
      <div class="popup-actions">
        <button id="popup-no-btn">No, Thanks</button>
        <button id="popup-yes-btn">Yes, sign me up!</button>
      </div>
      <div class="popup-timer-bar"></div>
    </div>
  `;
  document.body.appendChild(popup);
  document.getElementById('popup-yes-btn').addEventListener('click', () => {
    updateSubscriptionStatus(true); 
    if (newsletterCheck) {
        newsletterCheck.checked = true;
    }
    closeNewsletterNudge();
  });
  document.getElementById('popup-no-btn').addEventListener('click', () => {
    closeNewsletterNudge();
  });
  popupTimer = setTimeout(closeNewsletterNudge, 10000); // 10s
}
function closeNewsletterNudge() {
  if (popupTimer) {
    clearTimeout(popupTimer);
    popupTimer = null;
  }
  const popup = document.querySelector('.explore-popup');
  if (popup) {
    popup.classList.add('closing');
    setTimeout(() => popup.remove(), 300);
  }
}

// --- [NEW] Web Push Notification Logic ---

// Helper to convert VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// 1. Register the Service Worker
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.error('Service Workers not supported.');
    if(enablePushBtn) enablePushBtn.disabled = true;
    return;
  }
  try {
    // We register the service-worker.js file located at the root of the Frontend
    const registration = await navigator.serviceWorker.register('./service-worker.js');
    serviceWorkerReg = registration; // Save registration for later
    console.log('Service Worker Registered.');
    // Once registered, update the UI to show current subscription status
    updatePushSubscriptionStatus(); 
  } catch (error) {
    console.error('Service Worker registration failed:', error);
  }
}

// 2. Ask for Permission & Subscribe
async function subscribeToPush() {
  if (!serviceWorkerReg) {
    alert("Service worker not ready. Please wait a moment.");
    return;
  }
  if (!VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY.includes('...')) {
    console.error("VAPID_PUBLIC_KEY is not set in script.js");
    alert("Push notification setup error. Admin must provide a VAPID key.");
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Permission not granted.');
    }

    console.log('Subscribing to Push Manager...');
    const subscription = await serviceWorkerReg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
    
    // 3. Send subscription to backend
    await fetchWithAuth(`${USER_API_URL}/subscribe`, {
      method: 'POST',
      body: { subscription: subscription }
    });
    
    showNotification('Push notifications enabled!');
    updatePushSubscriptionStatus(); // Update UI

  } catch (err) {
    console.error('Failed to subscribe to push:', err);
    showNotification('Could not enable push notifications.', 'error');
  }
}

// 4. Update UI based on current status
async function updatePushSubscriptionStatus() {
  if (!serviceWorkerReg) return;
  try {
    const subscription = await serviceWorkerReg.pushManager.getSubscription();
    if (subscription) {
      if(enablePushBtn) {
        enablePushBtn.textContent = 'Enabled';
        enablePushBtn.disabled = true;
      }
      if(sendTestPushBtn) sendTestPushBtn.disabled = false;
    } else {
      if(enablePushBtn) {
        enablePushBtn.textContent = 'Enable';
        enablePushBtn.disabled = false;
      }
      if(sendTestPushBtn) sendTestPushBtn.disabled = true;
    }
  } catch (err) {
    console.error('Error getting push subscription status:', err);
  }
}

// 5. Send Test Notification
async function sendTestPush() {
  if(sendTestPushBtn) sendTestPushBtn.textContent = 'Sending...';
  try {
    await fetchWithAuth(`${USER_API_URL}/test-push`, { method: 'POST' });
    // The notification will appear from the service worker
    // We just show a confirmation here.
    showNotification('Test notification sent! Check your device.');
  } catch (err) {
    console.error('Error sending test push:', err);
    showNotification('Could not send notification.', 'error');
  }
  if(sendTestPushBtn) sendTestPushBtn.textContent = 'Send';
}
// --- End of Web Push Logic ---


// --- Signup Handler ---
const signupForm=document.querySelector('#signup form');
signupForm?.addEventListener('submit',async e=>{ 
  e.preventDefault(); 
  const n=e.target.elements.name.value; 
  const m=e.target.elements.email.value; 
  const p=e.target.elements.password.value; 
  try{
    const d=await handleAuthRequest(`${AUTH_API_URL}/register`,{name:n,email:m,password:p}); 
    localStorage.setItem('token',d.token); 
    localStorage.setItem('userName',n); 
    localStorage.setItem('userEmail',m); 
    showSection('onboarding');
    if (onboardWelcome) {
      onboardWelcome.textContent = `Welcome, ${n.split(' ')[0]}!`;
    }
  }catch(err){}});

// --- Login Handler ---
const loginForm=document.querySelector('#login form'); 
loginForm?.addEventListener('submit',async e=>{ 
  e.preventDefault(); 
  const m=e.target.elements.email.value; 
  const p=e.target.elements.password.value; 
  try{
    const d=await handleAuthRequest(`${AUTH_API_URL}/login`,{email:m,password:p}); 
    localStorage.setItem('token',d.token); 
    localStorage.setItem('userEmail',m); 
    const nG=m.split('@')[0].replace(/[\._-]/g,' ').replace(/\b\w/g,l=>l.toUpperCase()) || 'User';
    localStorage.setItem('userName',nG);
    showSection('dashboard'); 
    loadDashboard();
  }catch(err){}});

// --- Logout Function ---
function logout(){ 
  // [NEW] Unregister service worker on logout
  navigator.serviceWorker.getRegistration().then(reg => {
    if (reg) {
      reg.unregister().then(success => {
        console.log('Service Worker unregistered:', success);
      });
    }
  });

  localStorage.clear(); 
  showSection('home'); 
  if(timeIntervalId){clearInterval(timeIntervalId);timeIntervalId=null; if(currentTimeDisplay)currentTimeDisplay.textContent='';} 
}

// --- [MODIFIED] Category Button Handlers (with Local News) ---
document.querySelectorAll('.category-btn').forEach(b=>{
  b.addEventListener('click',()=>{
    document.querySelectorAll('.category-btn').forEach(b2=>b2.classList.remove('active'));
    b.classList.add('active');
    
    // --- THIS IS THE NEW LOGIC ---
    const category = b.dataset.category;
    if(dashboardTitle) dashboardTitle.textContent = 'Headlines'; // Reset title
    
    if (category === 'foryou') {
      renderForYouFeed();
    } else if (category === 'local') {
      renderLocalNews(); // Call the new local function
    } else {
      renderHeadlines(category); // Call the original general function
    }
    // ---
    
    searchInput.value='';
  });
});

// --- Search Bar Handler ---
searchButton?.addEventListener('click',()=>{ const q=searchInput.value.trim(); if(q){document.querySelectorAll('.category-btn').forEach(b=>b.classList.remove('active'));showDashboardView('headlines-view');renderHeadlines('',q);}else{const gB=document.querySelector('.category-btn[data-category="general"]'); if(gB) gB.click();}});
searchInput?.addEventListener('keyup',e=>{if(e.key==='Enter'){searchButton.click();}});

// --- Newsletter Subscription Logic ---
async function fetchSubscriptionStatus(){if(!newsletterCheck)return; try{const d=await fetchWithAuth(`${USER_API_URL}/subscription-status`,{method:'GET'}); newsletterCheck.checked=d.isSubscribed; newsletterCheck.disabled=false; console.log("Fetched sub status:",d.isSubscribed);}catch(err){console.error("Could not fetch sub status."); newsletterCheck.checked=false; newsletterCheck.disabled=true;}}
async function updateSubscriptionStatus(isSubscribed){if(!newsletterCheck)return; try{const d=await fetchWithAuth(`${USER_API_URL}/subscription-status`,{method:'PUT',body:{isSubscribed}}); newsletterCheck.checked=d.isSubscribed; showNotification(d.msg); console.log("Updated sub status:",d.isSubscribed);}catch(err){console.error("Could not update sub status."); if(newsletterCheck){newsletterCheck.checked=!isSubscribed;}}}
if(newsletterCheck){newsletterCheck.addEventListener('change',e=>{updateSubscriptionStatus(e.target.checked);});}

// --- [MODIFIED] Dashboard Loader ---
function loadDashboard(){ 
  showDashboardView('headlines-view'); 
  renderForYouFeed(); // Default to "For You"
  renderFavorites(); 
  loadUserProfile(); 
  updateProfileStats(); 
  fetchSubscriptionStatus();
  registerServiceWorker(); // [NEW] Register the service worker
}

// --- Homepage Navbar Scroll Effect ---
const navbar = document.querySelector('.global-navbar');
window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        navbar?.classList.add('scrolled');
    } else {
        navbar?.classList.remove('scrolled');
    }
});

// --- Scroll Animations (Homepage) ---
const animatedElements = document.querySelectorAll('.feature-card, .step-card, .testimonial-card, .faq-item');
const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
        }
    });
}, { threshold: 0.1 }); 
if (animatedElements.length > 0) {
    animatedElements.forEach(el => observer.observe(el));
}

// --- Onboarding Button Listeners ---
categoryPicker?.addEventListener('click', (e) => {
  const button = e.target.closest('.onboard-category-btn');
  if (button) {
    button.classList.toggle('active');
  }
});
savePrefsBtn?.addEventListener('click', savePreferences);

// --- [NEW] Push Button Listeners ---
enablePushBtn?.addEventListener('click', subscribeToPush);
sendTestPushBtn?.addEventListener('click', sendTestPush);


// --- Initial Render ---
document.addEventListener('DOMContentLoaded',()=>{
  if(localStorage.getItem('token')){
    showSection('dashboard');
    loadDashboard();
  } else {
    showSection('home');
  }
});