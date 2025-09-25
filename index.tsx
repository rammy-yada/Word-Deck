/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI, Type } from "@google/genai";

const searchForm = document.getElementById('search-form') as HTMLFormElement;
const searchInput = document.getElementById('search-input') as HTMLInputElement;
const resultsContainer = document.getElementById('results-container') as HTMLDivElement;
const loader = document.getElementById('loader') as HTMLDivElement;
const errorContainer = document.getElementById('error') as HTMLDivElement;
const dailyWordEl = document.getElementById('daily-word') as HTMLParagraphElement;
const newWordButton = document.getElementById('new-word-button') as HTMLButtonElement;
const historySection = document.getElementById('history-section') as HTMLElement;
const historyList = document.getElementById('history-list') as HTMLDivElement;
const wordOfTheDaySection = document.getElementById('word-of-the-day-section') as HTMLElement;


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
    
    wordOfTheDaySection.classList.add('hidden');
    showLoading(true);
    clearResults();

    try {
        const prompt = `You are a helpful and creative dictionary. For the word '${word}', provide a comprehensive entry in a JSON format. The JSON object should include: a creative compliment using the word, pronunciation (IPA), part of speech, a clear definition, an array of synonyms, an array of antonyms, the etymology, and an array of at least two example sentences.`;

        const responseSchema = {
            type: Type.OBJECT,
            properties: {
                compliment: { type: Type.STRING, description: "A creative compliment using the word." },
                pronunciation: { type: Type.STRING, description: "The IPA phonetic transcription." },
                partOfSpeech: { type: Type.STRING, description: "The part of speech (e.g., noun, verb)." },
                definition: { type: Type.STRING, description: "A clear and concise definition." },
                synonyms: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of synonyms." },
                antonyms: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of antonyms." },
                etymology: { type: Type.STRING, description: "The origin and history of the word." },
                exampleSentences: { type: Type.ARRAY, items: { type: Type.STRING }, description: "At least two example sentences." }
            },
            required: ['compliment', 'pronunciation', 'partOfSpeech', 'definition', 'synonyms', 'antonyms', 'etymology', 'exampleSentences']
        };

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            },
        });

        updateHistory(word);

        const data = JSON.parse(response.text);

        resultsContainer.innerHTML = `
            <div class="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                <div class="flex items-center gap-4 mb-4 pb-4 border-b border-slate-200">
                     <h2 class="text-3xl font-bold capitalize">${word}</h2>
                     <button id="audio-button" aria-label="Listen to pronunciation" title="Listen to pronunciation" class="text-slate-500 hover:text-blue-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-full p-2">
                        <i class="fas fa-volume-up text-2xl"></i>
                    </button>
                </div>
                
                <div class="mb-6 p-4 bg-blue-50/70 border-l-4 border-blue-400 rounded-r-lg">
                    <p class="text-blue-800 italic">"${data.compliment}"</p>
                </div>
            
                <div class="space-y-4 text-slate-700">
                    <div>
                        <h3 class="font-semibold text-lg text-slate-600 mb-1 flex items-center gap-2">📖 Definition</h3>
                        <p class="pl-8">${data.definition}</p>
                    </div>
                     ${data.exampleSentences && data.exampleSentences.length > 0 ? `
                    <div>
                        <h3 class="font-semibold text-lg text-slate-600 mb-1 flex items-center gap-2">✍️ Example Sentence</h3>
                        <p class="pl-8">${data.exampleSentences[0]}</p>
                    </div>
                    ` : ''}
                </div>

                <div id="detailed-view" class="hidden space-y-4 text-slate-700 mt-4 pt-4 border-t border-slate-200">
                    <div>
                        <h3 class="font-semibold text-lg text-slate-600 mb-1 flex items-center gap-2">🗣️ Pronunciation</h3>
                        <p class="pl-8">${data.pronunciation}</p>
                    </div>
                    <div>
                        <h3 class="font-semibold text-lg text-slate-600 mb-1 flex items-center gap-2">🏷️ Part of Speech</h3>
                        <p class="pl-8 capitalize">${data.partOfSpeech}</p>
                    </div>
                    ${data.synonyms && data.synonyms.length > 0 ? `
                    <div>
                        <h3 class="font-semibold text-lg text-slate-600 mb-2 flex items-center gap-2">🔄 Synonyms</h3>
                        <div class="flex flex-wrap gap-2 pl-8">
                            ${data.synonyms.map(s => `<span class="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">${s}</span>`).join('')}
                        </div>
                    </div>` : ''}
                    ${data.antonyms && data.antonyms.length > 0 ? `
                    <div>
                        <h3 class="font-semibold text-lg text-slate-600 mb-2 flex items-center gap-2">🚫 Antonyms</h3>
                        <div class="flex flex-wrap gap-2 pl-8">
                            ${data.antonyms.map(a => `<span class="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">${a}</span>`).join('')}
                        </div>
                    </div>` : ''}
                     <div>
                        <h3 class="font-semibold text-lg text-slate-600 mb-1 flex items-center gap-2">📜 Etymology</h3>
                        <p class="pl-8">${data.etymology}</p>
                    </div>
                    ${data.exampleSentences && data.exampleSentences.length > 1 ? `
                    <div>
                        <h3 class="font-semibold text-lg text-slate-600 mb-1 flex items-center gap-2">✍️ More Examples</h3>
                        <ul class="list-disc list-inside pl-8 space-y-1">
                            ${data.exampleSentences.slice(1).map(sentence => `<li>${sentence}</li>`).join('')}
                        </ul>
                    </div>
                    ` : ''}
                </div>
                 <div class="text-center mt-6">
                    <button id="toggle-details-button" class="text-blue-600 font-semibold hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md px-3 py-1">
                        <span>Show More</span>
                        <i class="fas fa-chevron-down ml-1 text-sm transition-transform duration-300"></i>
                    </button>
                </div>
            </div>
        `;

        const toggleDetailsButton = document.getElementById('toggle-details-button');
        const detailedView = document.getElementById('detailed-view');
        
        if (toggleDetailsButton && detailedView) {
            toggleDetailsButton.addEventListener('click', () => {
                const isHidden = detailedView.classList.toggle('hidden');
                const icon = toggleDetailsButton.querySelector('i');
                const text = toggleDetailsButton.querySelector('span');

                if (isHidden) {
                    text.textContent = 'Show More';
                    icon.classList.remove('fa-chevron-up');
                    icon.classList.add('fa-chevron-down');
                } else {
                    text.textContent = 'Show Less';
                    icon.classList.remove('fa-chevron-down');
                    icon.classList.add('fa-chevron-up');
                }
            });
        }


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
        showError("An error occurred while fetching the definition. The word might be too obscure or there was a network issue. Please try again.");
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
    wordOfTheDaySection.classList.remove('hidden');
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