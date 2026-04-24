// UI State
const state = {
    quizOpen: false,
    listening: false,
    roadmapGenerated: false,
    logs: JSON.parse(localStorage.getItem('civic_logs') || '[]'),
    map: null,
    geocoder: null,
    markers: [],
    firebaseInitialized: false
};

/**
 * REAL Google Cloud / Firebase Services Integration
 */
const CloudServices = {
    config: {
        apiKey: "AIzaSyAhVUkFYG4EEvcKUTSwgIk-G8l9EL7n0hw",
        authDomain: "justice-ai-workflow.firebaseapp.com",
        projectId: "justice-ai-workflow",
        storageBucket: "justice-ai-workflow.firebasestorage.app",
        messagingSenderId: "603250355115",
        appId: "1:603250355115:web:82191940989b6574f0c43d",
        measurementId: "G-6SPS0XG9L9"
    },
    db: null,
    user: null,

    init: async function() {
        console.log("☁️ Initializing Live Google Cloud Services...");
        try {
            if (!firebase.apps.length) {
                firebase.initializeApp(this.config);
            }
            this.db = firebase.firestore();
            
            // Anonymous Auth for seamless user sessions
            const cred = await firebase.auth().signInAnonymously();
            this.user = cred.user;
            state.firebaseInitialized = true;
            console.log("✅ Cloud Connected: Anonymous Session", this.user.uid);
            
            // Sync existing logs to cloud if any
            this.syncLogs();
        } catch (error) {
            console.error("❌ Cloud Connection Failed:", error);
        }
    },

    logEvent: function(eventName, params) {
        if (state.firebaseInitialized && this.db) {
            this.db.collection('analytics').add({
                event: eventName,
                userId: this.user.uid,
                params: params,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log(`📊 [Cloud Analytics] Recorded: ${eventName}`);
        }
    },

    syncLogs: async function() {
        if (!state.firebaseInitialized || !this.db) return;
        
        const localLogs = JSON.parse(localStorage.getItem('civic_logs') || '[]');
        const userRef = this.db.collection('users').doc(this.user.uid);
        
        await userRef.set({
            lastActive: firebase.firestore.FieldValue.serverTimestamp(),
            totalLogs: localLogs.length
        }, { merge: true });

        // Batch upload local logs to cloud
        const batch = this.db.batch();
        localLogs.forEach(log => {
            const logRef = userRef.collection('activity_logs').doc(log.id.toString());
            batch.set(logRef, {
                ...log,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        });
        await batch.commit();
        console.log("🔄 Cloud Sync: Logs synchronized to Firestore");
    }
};

/**
 * Security: Sanitize user input to prevent XSS and injection
 * @param {string} input - Raw user input
 * @returns {string} - Cleaned string
 */
function sanitizeInput(input) {
    const temp = document.createElement('div');
    temp.textContent = input;
    return temp.innerHTML;
}

// Google Maps Initialization
function initMap() {
    try {
        // Check if API key is still the placeholder
        const scriptTags = document.querySelectorAll('script');
        let hasPlaceholder = false;
        scriptTags.forEach(s => {
            if (s.src.includes('YOUR_API_KEY')) hasPlaceholder = true;
        });

        if (hasPlaceholder) {
            console.warn("Google Maps API Key is missing or using placeholder.");
            const mapVisual = document.getElementById('map-visual');
            if (mapVisual) {
                mapVisual.innerHTML = `<div class="map-error-msg">
                    <p>📍 Map placeholder is active.</p>
                    <small>To enable the live map, please replace <code>YOUR_API_KEY</code> in <code>index.html</code> with a valid Google Maps API Key.</small>
                </div>`;
            }
        }

        const mapOptions = {
            center: { lat: 20.5937, lng: 78.9629 }, // Center of India
            zoom: 5,
            styles: [
                { "elementType": "geometry", "stylers": [{ "color": "#1e293b" }] },
                { "elementType": "labels.text.fill", "stylers": [{ "color": "#94a3b8" }] },
                { "elementType": "labels.text.stroke", "stylers": [{ "color": "#1e293b" }] },
                { "featureType": "administrative", "elementType": "geometry.stroke", "stylers": [{ "color": "#334155" }] },
                { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#0f172a" }] },
                { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#020617" }] }
            ],
            disableDefaultUI: true,
            zoomControl: true
        };

        state.map = new google.maps.Map(document.getElementById('map-visual'), mapOptions);
        state.geocoder = new google.maps.Geocoder();
    } catch (error) {
        console.error("Google Maps Initialization Error:", error);
        // Map will remain a dark placeholder, searchMap will use its fallback logic
    }
}

function scrollToSection(id) {
    const element = document.getElementById(id);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
    }
}

// Quiz Logic
function openQuiz() {
    document.getElementById('quiz-modal').style.display = 'block';
    state.quizOpen = true;
}

function closeQuiz() {
    document.getElementById('quiz-modal').style.display = 'none';
    state.quizOpen = false;
}

async function generateRoadmap() {
    const form = document.getElementById('quiz-form');
    const roadmapResult = document.getElementById('roadmap-result');
    const roadmapText = document.getElementById('roadmap-text');
    
    const registeredRadio = form.querySelector('input[name="registered"]:checked');
    if (!registeredRadio) {
        alert("Please select your registration status first!");
        return;
    }

    const registered = registeredRadio.value;
    const knowledge = document.getElementById('knowledge-level').value;
    const submitBtn = form.querySelector('button');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Analyzing...';
    form.classList.add('hidden');
    roadmapResult.classList.remove('hidden');
    roadmapText.innerHTML = '<div class="roadmap-loader"></div> <p>Syncing with election databases and analyzing your profile...</p>';

    const prompt = `Generate a detailed 4-step personalized Indian election roadmap for a user who is ${registered === 'yes' ? 'already' : 'not'} registered and has a ${knowledge} knowledge level. 
    ${registered === 'no' ? 'Focus heavily on the registration process via NVSP (National Voters Service Portal), including: 1. Eligibility criteria (18+), 2. Form 6 submission, 3. Typical deadlines, and 4. Required documents (Aadhaar, Age proof, Address proof).' : 'Focus on: 1. EPIC card download/verification, 2. Finding booth via ECI Voter Portal, 3. Knowing your candidates, and 4. VVPAT/EVM process.'} 
    Use bullet points for sub-steps. Keep it encouraging and high-impact. Mention the Election Commission of India (ECI).`;

    try {
        const response = await getGeminiResponse(prompt);
        roadmapText.innerHTML = `<div class="roadmap-content">${formatResponse(response)}</div>
                                <button class="btn btn-secondary" onclick="resetQuiz()" style="margin-top: 20px;">Redo Quiz</button>`;
        state.roadmapGenerated = true;
        
        // Cloud Analytics
        CloudServices.logEvent('roadmap_generated', { registered, knowledge });

        // Auto-scroll to result and highlight milestone
        if (registered === 'no') {
            showMilestone(2); // Focus on registration
        }
        
        if (registered === 'yes') {
            document.getElementById('check1').checked = true;
            document.getElementById('check2').checked = true;
            localStorage.setItem('check1', 'true');
            localStorage.setItem('check2', 'true');
            updateProgress();
            logAction('status', 'Verified registration status via quiz.');
            logAction('registration', 'Confirmed existing registration.');
        } else {
            logAction('status', 'Completed civic diagnostic quiz.');
        }
    } catch (error) {
        roadmapText.innerHTML = `<p class="error-msg">⚠️ Connection issues: ${error.message}. Please try again.</p>
                                <button class="btn btn-primary" onclick="generateRoadmap()">Retry Analysis</button>`;
    }
}

/**
 * Resets the diagnostic quiz to its initial state
 */
function resetQuiz() {
    document.getElementById('quiz-form').classList.remove('hidden');
    document.getElementById('roadmap-result').classList.add('hidden');
    document.getElementById('quiz-form').reset();
    const submitBtn = document.getElementById('quiz-form').querySelector('button');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Generate Roadmap';
}

/**
 * Clears all locally stored data after user confirmation
 */
function clearAllData() {
    if (confirm("This will reset your roadmap and checklist. Continue?")) {
        localStorage.clear();
        location.reload();
    }
}

// --- NAVIGATION & UTILS ---

/**
 * Formats AI responses into safe HTML
 * @param {string} text - Raw Markdown-like text from AI
 * @returns {string} - Safe HTML
 */
function formatResponse(text) {
    // Security: First escape everything to prevent HTML injection
    let safeText = sanitizeInput(text);

    // Then selectively re-apply formatting tokens safely
    return safeText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
               .replace(/^\* (.*?)$/gm, '<li>$1</li>')
               .replace(/^- (.*?)$/gm, '<li>$1</li>')
               .replace(/\n/g, '<br>')
               .replace(/(<li>.*?<\/li>)/g, '<ul>$1</ul>')
               .replace(/<\/ul><ul>/g, ''); 
}

// Performance: Throttling for scroll events
function throttle(fn, wait) {
    let time = Date.now();
    return function() {
        if ((time + wait - Date.now()) < 0) {
            fn();
            time = Date.now();
        }
    }
}

// Voice Logic
function toggleVoice() {
    const btn = document.getElementById('voice-btn');
    if (!('webkitSpeechRecognition' in window)) {
        alert("Voice recognition not supported in this browser.");
        return;
    }

    const recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;

    if (!state.listening) {
        recognition.start();
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
        state.listening = true;
    } else {
        recognition.stop();
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
        state.listening = false;
    }

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        document.getElementById('user-input').value = transcript;
        sendMessage();
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
        state.listening = false;
    };

    recognition.onerror = () => {
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
        state.listening = false;
    };
}

// Map Logic
async function searchMap() {
    let pincode = document.getElementById('zip-search').value;
    if (!pincode) return;

    // Security: Sanitize input
    pincode = sanitizeInput(pincode);

    const list = document.getElementById('location-list');
    list.style.opacity = '0.5';
    
    // Cloud Analytics
    CloudServices.logEvent('map_search', { query: pincode });

    // Check if Google Maps is fully initialized (map and geocoder)
    if (!state.geocoder || !state.map || !window.google) {
        console.warn("Google Maps services not fully initialized. Using fallback mock data.");
        setTimeout(() => {
            list.style.opacity = '1';
            list.innerHTML = `
                <div class="location-item active" role="button" tabindex="0">
                    <h4>KV School No. 1 (Mock)</h4>
                    <p>Sector 4, Central Colony</p>
                    <span class="distance">0.8 km away</span>
                </div>
                <div class="location-item" role="button" tabindex="0">
                    <h4>City Community Center (Mock)</h4>
                    <p>Main Market Road</p>
                    <span class="distance">1.5 km away</span>
                </div>
            `;
            logAction('polling', `Searched for polling booths near ${pincode} (Offline Mode). Found 2 mock locations.`);
        }, 800);
        return;
    }

    state.geocoder.geocode({ address: pincode }, (results, status) => {
        if (status === 'OK') {
            const location = results[0].geometry.location;
            state.map.setCenter(location);
            state.map.setZoom(13);

            // Clear existing markers
            state.markers.forEach(m => m.setMap(null));
            state.markers = [];

            // Search for nearby places (Mocking polling booths for demo)
            const service = new google.maps.places.PlacesService(state.map);
            const request = {
                location: location,
                radius: '5000',
                query: 'library school community center'
            };

            service.textSearch(request, (places, pStatus) => {
                list.style.opacity = '1';
                if (pStatus === google.maps.places.PlacesServiceStatus.OK) {
                    list.innerHTML = '';
                    places.slice(0, 5).forEach((place, i) => {
                        // Create Marker
                        const marker = new google.maps.Marker({
                            position: place.geometry.location,
                            map: state.map,
                            title: place.name,
                            animation: google.maps.Animation.DROP,
                            icon: {
                                path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
                                scale: 5,
                                fillColor: i === 0 ? '#ec4899' : '#6366f1',
                                fillOpacity: 1,
                                strokeWeight: 2,
                                strokeColor: '#ffffff',
                            }
                        });
                        state.markers.push(marker);

                        // Update List
                        const item = document.createElement('div');
                        item.className = `location-item ${i === 0 ? 'active' : ''}`;
                        item.setAttribute('role', 'button');
                        item.setAttribute('tabindex', '0');
                        item.innerHTML = `
                            <h4>${place.name}</h4>
                            <p>${place.formatted_address || 'Nearby Location'}</p>
                            <span class="distance">Polling Location Candidate</span>
                        `;
                        item.onclick = () => {
                            state.map.panTo(place.geometry.location);
                            document.querySelectorAll('.location-item').forEach(el => el.classList.remove('active'));
                            item.classList.add('active');
                        };
                        list.appendChild(item);
                    });

                    logAction('polling', `Found ${places.length} potential polling sites near ${pincode}.`);
                }
            });
        } else {
            list.style.opacity = '1';
            alert('Geocode was not successful for the following reason: ' + status);
        }
    });
}

function updateProgress() {
    const total = document.querySelectorAll('.checklist-item input').length;
    const checked = document.querySelectorAll('.checklist-item input:checked').length;
    const percentage = Math.round((checked / total) * 100);
    
    const progressFill = document.querySelector('.hero-visual .progress');
    const progressText = document.getElementById('progress-text');

    if (progressFill) {
        progressFill.style.width = `${percentage}%`;
        progressFill.setAttribute('aria-valuenow', percentage);
    }
    if (progressText) {
        progressText.textContent = `${percentage}% Completed`;
    }

    updateJourneyPath(percentage);

    if (percentage === 100) {
        triggerConfetti();
    }
}

function updateJourneyPath(percentage) {
    const path = document.getElementById('journey-progress');
    if (!path) return;
    
    const length = path.getTotalLength();
    const offset = length - (length * (percentage / 100));
    path.style.strokeDashoffset = offset;

    // Update node circles based on percentage
    const nodes = document.querySelectorAll('.node-circle');
    nodes.forEach((node, index) => {
        const milestoneThreshold = (index + 1) * 20; // 5 nodes, 20% each
        node.classList.remove('active', 'completed');
        if (percentage >= milestoneThreshold) {
            node.classList.add('completed');
        } else if (percentage >= milestoneThreshold - 20) {
            node.classList.add('active');
        }
    });
}

const milestones = {
    1: { title: "Eligibility Check", desc: "Before you start, ensure you meet the legal requirements: Indian Citizenship, age 18+, and being a resident of the polling area.", btn: "Check Requirements", action: () => { logAction('status', 'Initiated eligibility check.'); scrollToSection('assistant'); } },
    2: { title: "Voter Registration", desc: "Apply via Form 6 on the NVSP portal. It's the essential step to getting your EPIC (Voter ID) card.", btn: "Register on NVSP", action: () => { logAction('registration', 'Redirected to NVSP portal for registration.'); window.open('https://www.nvsp.in/', '_blank'); } },
    3: { title: "Know Your Candidate", desc: "Informed voters make a difference. Check candidate affidavits and details on the 'Know Your Candidates' (KYC) app or ECI website.", btn: "Research Candidates", action: () => { logAction('status', 'Started candidate research on ECI website.'); window.open('https://voters.eci.gov.in/', '_blank'); } },
    4: { title: "Locate Booth", desc: "Plan your trip. Use our interactive map below or the ECI Voter Search to find your assigned polling booth.", btn: "Open Map", action: () => { logAction('polling', 'Navigated to polling map.'); scrollToSection('map'); } },
    5: { title: "Cast Your Vote", desc: "Carry your EPIC card or alternative photo ID. Understand the EVM and VVPAT process for a smooth experience.", btn: "View ID Rules", action: () => { logAction('status', 'Checking ID requirements.'); scrollToSection('assistant'); } }
};

function showMilestone(id) {
    const data = milestones[id];
    const details = document.getElementById('milestone-details');
    document.getElementById('milestone-title').textContent = data.title;
    document.getElementById('milestone-desc').textContent = data.desc;
    
    const btn = document.getElementById('milestone-btn');
    btn.textContent = data.btn;
    btn.onclick = data.action;

    details.classList.remove('hidden');
    details.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideMilestone() {
    document.getElementById('milestone-details').classList.add('hidden');
}

function triggerConfetti() {
    // Simple CSS/JS confetti placeholder
    const colors = ['#6366f1', '#ec4899', '#8b5cf6'];
    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + 'vw';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDuration = (Math.random() * 3 + 2) + 's';
        confetti.style.opacity = Math.random();
        document.body.appendChild(confetti);
        setTimeout(() => confetti.remove(), 5000);
    }
}

// --- LOGGING ENGINE ---
function logAction(type, description) {
    const entry = {
        id: Date.now(),
        type, // 'polling', 'registration', 'status'
        description,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        icon: type === 'polling' ? '📍' : type === 'registration' ? '📝' : '✅'
    };

    state.logs.unshift(entry);
    if (state.logs.length > 20) state.logs.pop(); // Keep last 20
    
    localStorage.setItem('civic_logs', JSON.stringify(state.logs));
    updateLogUI();
}

function updateLogUI() {
    const container = document.getElementById('log-entries');
    if (!container) return;

    if (state.logs.length === 0) {
        container.innerHTML = '<div class="log-placeholder">Your civic journey will be recorded here...</div>';
        return;
    }

    container.innerHTML = state.logs.map(log => `
        <div class="log-entry ${log.type}" role="status">
            <div class="log-time">${log.time}</div>
            <div class="log-icon">${log.icon}</div>
            <div class="log-content">${log.description}</div>
        </div>
    `).join('');
}

function clearLogs() {
    if (confirm("Are you sure you want to clear your activity history?")) {
        state.logs = [];
        localStorage.removeItem('civic_logs');
        updateLogUI();
    }
}

// Handle active nav link on scroll (Throttled for efficiency)
window.addEventListener('scroll', throttle(() => {
    const sections = ['timeline', 'assistant', 'checklist'];
    let current = '';

    sections.forEach(section => {
        const element = document.getElementById(section);
        if (element) {
            const sectionTop = element.offsetTop;
            const sectionHeight = element.clientHeight;
            if (pageYOffset >= sectionTop - 150) {
                current = section;
            }
        }
    });

    document.querySelectorAll('.nav-links a').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${current}`) {
            link.classList.add('active');
        }
    });
}, 100));

// Initialize Checklist and Listeners
function initApp() {
    document.querySelectorAll('.checklist-item input').forEach(checkbox => {
        // Load saved state
        const savedState = localStorage.getItem(checkbox.id);
        if (savedState === 'true') checkbox.checked = true;

        // Add change listener
        checkbox.addEventListener('change', (e) => {
            localStorage.setItem(e.target.id, e.target.checked);
            updateProgress();
            
            if (e.target.checked) {
                const label = document.querySelector(`label[for="${e.target.id}"]`).textContent;
                let type = 'status';
                if (label.toLowerCase().includes('register')) type = 'registration';
                if (label.toLowerCase().includes('polling')) type = 'polling';
                logAction(type, `Completed: ${label}`);
            }
        });
    });

    // Initial progress update
    updateProgress();
    updateLogUI();
}

function updateClock() {
    const timeEl = document.getElementById('current-time');
    if (!timeEl) return;
    
    const now = new Date();
    timeEl.textContent = now.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
}

// Run initialization
document.addEventListener('DOMContentLoaded', () => {
    CloudServices.init();
    initApp();
    updateClock();
    setInterval(updateClock, 1000);
});
// If content already loaded (e.g. script is at bottom)
if (document.readyState !== 'loading') {
    CloudServices.init();
    initApp();
    updateClock();
    setInterval(updateClock, 1000);
}


