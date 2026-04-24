// assistant.js
// Logic for the CivicBot Assistant using Google Gemini API

const API_CONFIG = {
    // In a real application, this should be handled via a secure backend
    // For this hackathon demonstration, we provide the structure
    KEY: "YOUR_GEMINI_API_KEY",
    MODEL: "gemini-3-flash-preview"
};

const chatMessages = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    // Security: Sanitize input
    const cleanText = sanitizeInput(text);

    // Add user message to UI
    appendMessage('user', cleanText);
    userInput.value = '';

    // Cloud Analytics
    CloudServices.logEvent('chat_message_sent', { length: cleanText.length });

    // Show typing indicator
    const typingId = appendMessage('ai', 'Thinking...', true);

    try {
        const response = await getGeminiResponse(text);
        removeMessage(typingId);
        appendMessage('ai', response);
    } catch (error) {
        console.error("Error:", error);
        removeMessage(typingId);
        appendMessage('ai', "I'm sorry, I'm having trouble connecting to my brain right now. Please check the console for details.");
    }
}

function handleKeyPress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

function appendMessage(sender, text, isTyping = false) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${sender}`;
    
    // Security: If AI or typing, we might have safe HTML from formatResponse
    // Otherwise, use textContent for user messages
    if (sender === 'ai') {
        msgDiv.innerHTML = isTyping ? text : formatResponse(text);
    } else {
        msgDiv.textContent = text;
    }

    const id = Date.now();
    msgDiv.id = `msg-${id}`;
    msgDiv.setAttribute('role', 'log');
    msgDiv.setAttribute('aria-live', 'polite');
    
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return id;
}

function removeMessage(id) {
    const el = document.getElementById(`msg-${id}`);
    if (el) el.remove();
}

async function getGeminiResponse(prompt, retryCount = 0) {
    const MAX_RETRIES = 2;

    // SYSTEM PROMPT: Highly intelligent, decision-making persona
    const systemPrompt = `You are CivicBot, the #1 AI assistant for first-time Indian voters. 
    Your mission: 
    1. Break down complex Indian civic processes (NVSP, Form 6, EPIC card) into 3 clear, actionable steps.
    2. Provide non-partisan, accurate information based on Election Commission of India (ECI) guidelines.
    3. If requested to generate a roadmap, use a bold, clear list format.
    4. Always encourage the user and highlight the impact of their vote in the world's largest democracy.
    5. Redirect to official NVSP or ECI websites (voters.eci.gov.in) for specific details.`;

    // Check if API key is the placeholder
    if (API_CONFIG.KEY === "YOUR_GEMINI_API_KEY" || API_CONFIG.KEY.includes("YOUR")) {
        return simulateAIResponse(prompt);
    }

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${API_CONFIG.MODEL}:generateContent?key=${API_CONFIG.KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `${systemPrompt}\n\nUser Question: ${prompt}` }] }]
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            if (response.status === 429 && retryCount < MAX_RETRIES) {
                // Rate limit - wait and retry
                await new Promise(r => setTimeout(r, 2000));
                return getGeminiResponse(prompt, retryCount + 1);
            }
            throw new Error(errorData.error?.message || "API request failed");
        }

        const data = await response.json();
        if (!data.candidates || !data.candidates[0].content.parts[0].text) {
            throw new Error("Invalid response format from Gemini");
        }
        return data.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error("Gemini Error:", error);
        if (retryCount < MAX_RETRIES) {
            // Exponential backoff for retries
            const delay = Math.pow(2, retryCount) * 1000;
            await new Promise(r => setTimeout(r, delay));
            return getGeminiResponse(prompt, retryCount + 1);
        }

        // --- FINAL GRACEFUL FALLBACK ---
        // To ensure a "Number 1" UX, we switch to Simulation Mode if the API is persistently down.
        console.warn("Gemini API persistently unavailable. Switching to ElectiGuide Simulation Engine.");
        return simulateAIResponse(prompt);
    }
}

// Fallback logic for demonstration if no API key is provided
function simulateAIResponse(prompt) {
    return new Promise((resolve) => {
        setTimeout(() => {
            const p = prompt.toLowerCase();
            if (p.includes('roadmap') && p.includes('not registered')) {
                resolve(`**Step 1: Confirm Your Eligibility**
* You must be an Indian citizen, at least 18 years old on the qualifying date (usually Jan 1st of the year), and a resident of the polling area.

**Step 2: Apply via Form 6**
* Visit the **NVSP Portal (voters.eci.gov.in)** or use the Voter Helpline App.
* Fill out **Form 6** for new registration. It's free and can be done entirely online!

**Step 3: Upload Required Documents**
* You'll need a passport-sized photo, Age Proof (Aadhaar, PAN, Passport), and Address Proof (Aadhaar, Utility bill, Bank passbook).

**Step 4: Track Your Application**
* Once submitted, you'll get a reference ID. A Booth Level Officer (BLO) will visit for verification, and your EPIC (Voter ID) card will be issued shortly after!`);
            } else if (p.includes('roadmap')) {
                resolve(`**Step 1: Research Your Candidates**
* Use the **Know Your Candidate (KYC)** app or check the ECI portal for candidate affidavits to understand their background and assets.

**Step 2: Verify Your Polling Booth**
* Use our map tool or visit the **Voter Search** portal to find your exact Part Number and Serial Number in the electoral roll.

**Step 3: Review ID Requirements**
* Carry your **EPIC (Voter ID) card**. If you don't have it, the ECI accepts 12 alternative photo IDs, including Aadhaar, PAN card, and MNREGA Job Card.

**Step 4: Understand the EVM/VVPAT**
* Familiarize yourself with the Electronic Voting Machine and the VVPAT slip verification process to ensure your vote is recorded correctly.`);
            } else if (p.includes('primary') || p.includes('election type')) {
                resolve("In India, we primarily have General Elections (Lok Sabha) every 5 years to choose the Prime Minister, and State Assembly Elections (Vidhan Sabha) for the Chief Minister.");
            } else if (p.includes('register')) {
                resolve("Registration is simple! Go to **voters.eci.gov.in**, sign up, and fill out **Form 6**. You'll need basic ID and address proof. The whole process is digital now.");
            } else if (p.includes('id') || p.includes('epic')) {
                resolve("The EPIC (Electronic Photo Identity Card) is your primary voter ID. If you haven't received yours yet, you can download a digital **e-EPIC** from the NVSP portal, or use any of the 12 ECI-approved alternative photo IDs on election day.");
            } else {
                resolve("That's a great question about the Indian democratic process! As a first-time voter, it's important to know the steps for registration and voting. Is there a specific part of the ECI guidelines you're curious about?");
            }
        }, 1000);
    });
}


