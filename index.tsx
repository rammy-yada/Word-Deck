/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI } from "@google/genai";

const searchForm = document.getElementById('search-form') as HTMLFormElement;
const searchInput = document.getElementById('search-input') as HTMLInputElement;
const resultsContainer = document.getElementById('results-container') as HTMLDivElement;
const loader = document.getElementById('loader') as HTMLDivElement;
const errorContainer = document.getElementById('error') as HTMLDivElement;
const dailyWordEl = document.getElementById('daily-word') as HTMLParagraphElement;
const newWordButton = document.getElementById('new-word-button') as HTMLButtonElement;
const historySection = document.getElementById('history-section') as HTMLElement;
const historyList = document.getElementById('history-list') as HTMLDivElement;

const HISTORY_KEY = 'dictionarySearchHistory';

// Note: Do not expose your API key in client-side code. 
// This is done for demonstration purposes only.
// In a production app, this call should be made from a backend server.
let ai: GoogleGenAI;
try {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
} catch (e) {
    showError('Could not initialize the Gemini API. Please check your API key.');
    console.error(e);
}


const dailyWords = [
    'Ephemeral', 'Ubiquitous', 'Mellifluous', 'Serendipity', 'Petrichor',
    'Ineffable', 'Sonder', 'Defenestration', 'Limerence', 'Pulchritudinous'
];

function setWordOfTheDay() {
    const randomWord = dailyWords[Math.floor(Math.random() * dailyWords.length)];
    dailyWordEl.textContent = randomWord;
}

dailyWordEl.addEventListener('click', () => {
    searchInput.value = dailyWordEl.textContent || '';
    searchForm.dispatchEvent(new Event('submit'));
});

newWordButton.addEventListener('click', setWordOfTheDay);

searchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const word = searchInput.value.trim();
    if (!word) {
        showError("Please enter a word.");
        return;
    }

    if (!ai) {
        showError('Gemini API is not initialized.');
        return;
    }

    showLoading(true);
    clearResults();

    try {
        const prompt = `You are a helpful dictionary. Provide a comprehensive entry for the word '${word}'. Include the following sections, clearly labeled with bold headings: 'Pronunciation' (using IPA phonetic transcription), 'Definition', 'Etymology', and 'Example Sentences'. Provide at least two example sentences.`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
            },
        });

        updateHistory(word);

        const definition = response.text.replace(/\n/g, '<br>');
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;

        let sourcesHtml = '';
        if (groundingChunks && groundingChunks.length > 0) {
            sourcesHtml = '<h3 class="text-lg font-semibold mt-6 mb-2 text-slate-600">Sources</h3><ul class="list-disc pl-5 text-sm space-y-1">';
            const seenUris = new Set();
            for (const chunk of groundingChunks) {
                if (chunk.web && !seenUris.has(chunk.web.uri)) {
                    sourcesHtml += `<li><a href="${chunk.web.uri}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">${chunk.web.title || chunk.web.uri}</a></li>`;
                    seenUris.add(chunk.web.uri);
                }
            }
            sourcesHtml += '</ul>';
        }

        resultsContainer.innerHTML = `
            <div class="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                <div class="flex items-center gap-4 mb-4">
                     <h2 class="text-3xl font-bold capitalize">${word}</h2>
                     <button id="audio-button" aria-label="Listen to pronunciation" title="Listen to pronunciation" class="text-slate-500 hover:text-blue-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-full p-2">
                        <i class="fas fa-volume-up text-2xl"></i>
                    </button>
                </div>
                <div class="prose max-w-none text-slate-700">${definition}</div>
                ${sourcesHtml}
            </div>
        `;

        const audioButton = document.getElementById('audio-button');
        if (audioButton) {
            if ('speechSynthesis' in window) {
                audioButton.addEventListener('click', () => {
                    const utterance = new SpeechSynthesisUtterance(word);
                    window.speechSynthesis.speak(utterance);
                });
            } else {
                audioButton.style.display = 'none';
            }
        }


    } catch (error) {
        console.error(error);
        showError("An error occurred while fetching the definition. Please try again.");
    } finally {
        showLoading(false);
    }
});

function showLoading(isLoading: boolean) {
    loader.classList.toggle('hidden', !isLoading);
}

function clearResults() {
    resultsContainer.innerHTML = '';
    errorContainer.classList.add('hidden');
}

function showError(message: string) {
    resultsContainer.innerHTML = '';
    errorContainer.textContent = message;
    errorContainer.classList.remove('hidden');
}

function renderHistory() {
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') as string[];

    if (history.length === 0) {
        historySection.classList.add('hidden');
        return;
    }

    historySection.classList.remove('hidden');
    historyList.innerHTML = ''; // Clear previous items

    history.forEach(word => {
        const historyItem = document.createElement('button');
        historyItem.textContent = word;
        historyItem.className = "bg-slate-200 text-slate-700 px-3 py-1 rounded-full text-sm hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 capitalize";
        historyItem.dataset.word = word;
        historyList.appendChild(historyItem);
    });
}

function updateHistory(word: string) {
    const normalizedWord = word.toLowerCase();
    let history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') as string[];
    // Remove if exists to move it to the front
    history = history.filter(item => item !== normalizedWord);
    // Add to the front
    history.unshift(normalizedWord);
    // Keep only the last 5
    if (history.length > 5) {
        history = history.slice(0, 5);
    }
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    renderHistory();
}

historyList.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON' && target.dataset.word) {
        searchInput.value = target.dataset.word;
        searchForm.dispatchEvent(new Event('submit', { bubbles: true }));
    }
});

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    setWordOfTheDay();
    renderHistory();
});