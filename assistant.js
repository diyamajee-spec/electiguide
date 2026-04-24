// assistant.js
// Logic for the CivicBot Assistant using Google Gemini API

const API_CONFIG = {
    // In a real application, this should be handled via a secure backend
    // For this hackathon demonstration, we provide the structure
    KEY: "YOUR_GEMINI_API_KEY",
    MODEL: "gemini-1.5-flash"
};

const chatMessages = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    // Add user message to UI
    appendMessage('user', text);
    userInput.value = '';

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
    msgDiv.textContent = text;
    const id = Date.now();
    msgDiv.id = `msg-${id}`;
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
* You must be a U.S. citizen, at least 18 years old on election day, and meet your state's residency requirements.

**Step 2: Choose Your Registration Method**
* Online: Fast and easy at Vote.gov (available in 40+ states).
* In-Person: Visit your local DMV, post office, or election office.
* Mail: Download and send the National Mail Voter Registration Form.

**Step 3: Gather Required Documents**
* Most states require a valid Driver's License or a Social Security number. Have these ready before you start!

**Step 4: Meet the Deadlines**
* Many states require registration 15 to 30 days before the election. Don't wait—register today to ensure your voice is heard!`);
            } else if (p.includes('roadmap')) {
                resolve(`**Step 1: Deep Research**
* Dive into non-partisan guides like Vote411 to compare candidate platforms.

**Step 2: Verify Your Polling Place**
* Use our map tool to find your exact voting location or local drop boxes.

**Step 3: Review Voter ID Laws**
* Double-check if your state requires a photo ID or other documents.

**Step 4: Plan Your Trip**
* Decide when you'll go and how you'll get there. Making a plan increases your likelihood of voting!`);
            } else if (p.includes('primary')) {
                resolve("A primary election is how political parties choose their candidate for the general election. Think of it like the 'semi-finals' of voting!");
            } else if (p.includes('register')) {
                resolve("You can usually register online, by mail, or in person at your local election office. Deadlines vary by state, but most are 15-30 days before the election.");
            } else if (p.includes('id')) {
                resolve("Requirements for ID vary by state. Some require a photo ID, while others accept non-photo IDs like a utility bill. Check your state's official election website for the most accurate info.");
            } else {
                resolve("That's a great question about the election process! As a first-time voter, it's important to know the steps. Is there a specific part of the timeline you're curious about?");
            }
        }, 1000);
    });
}
