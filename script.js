/* ============================================
   DECISION HELPER - SCRIPT.JS
   Logic and interactivity for the Decision Helper Web App
   ============================================ */

// Data structure to store decisions
let decisions = {
    option1: {
        name: 'Option 1',
        pros: [],
        cons: []
    },
    option2: {
        name: 'Option 2',
        pros: [],
        cons: []
    }
};

// Voice and Speech Synthesis variables
let synth = window.speechSynthesis;
let currentUtterance = null;
let voiceSpeed = 0.9;

// Backend API base URL
const API_BASE_URL = '';

// User session
let currentUser = null;

// Load user session on page load
document.addEventListener('DOMContentLoaded', function() {
    loadUserSession();
    loadDarkModePreference();
    setupEventListeners();
    loadSavedDecision();
});

// Counter to track dynamic input IDs
let pro1Counter = 0;
let con1Counter = 0;
let pro2Counter = 0;
let con2Counter = 0;

// ============ AUTHENTICATION FUNCTIONS ============

/**
 * Load user session from localStorage
 */
function loadUserSession() {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        updateUserUI();
    }
}

/**
 * Update UI based on user login status
 */
function updateUserUI() {
    const userProfile = document.getElementById('userProfile');
    const authButtons = document.getElementById('authButtons');
    const userGreeting = document.getElementById('userGreeting');

    if (currentUser) {
        userProfile.style.display = 'flex';
        authButtons.style.display = 'none';
        userGreeting.textContent = `👤 ${currentUser.username}`;
    } else {
        userProfile.style.display = 'none';
        authButtons.style.display = 'flex';
    }
}

/**
 * Open auth modal (login or signup)
 */
function openAuthModal(mode) {
    const modal = document.getElementById('authModal');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');

    modal.style.display = 'flex';
    
    if (mode === 'login') {
        loginForm.style.display = 'block';
        signupForm.style.display = 'none';
    } else {
        loginForm.style.display = 'none';
        signupForm.style.display = 'block';
    }
}

/**
 * Close auth modal
 */
function closeAuthModal() {
    document.getElementById('authModal').style.display = 'none';
    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('signupUsername').value = '';
    document.getElementById('signupEmail').value = '';
    document.getElementById('signupPassword').value = '';
    document.getElementById('signupPasswordConfirm').value = '';
}

/**
 * Handle login
 */
async function handleLogin() {
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    if (!username || !password) {
        alert('❌ Please enter username and password');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        if (response.ok) {
            const result = await response.json();
            currentUser = result;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            updateUserUI();
            closeAuthModal();
            alert(`✅ Welcome back, ${username}!`);
        } else {
            alert('❌ Invalid username or password');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('❌ Error logging in. Make sure the backend server is running.');
    }
}

/**
 * Handle signup
 */
async function handleSignup() {
    const username = document.getElementById('signupUsername').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const passwordConfirm = document.getElementById('signupPasswordConfirm').value;

    if (!username || !password || !passwordConfirm) {
        alert('❌ Username and password are required');
        return;
    }

    if (password !== passwordConfirm) {
        alert('❌ Passwords do not match');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email: email || null, password })
        });

        if (response.ok) {
            const result = await response.json();
            currentUser = result;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            updateUserUI();
            closeAuthModal();
            alert(`✅ Account created! Welcome, ${username}!`);
        } else {
            const error = await response.json();
            alert(`❌ ${error.error || 'Signup failed'}`);
        }
    } catch (error) {
        console.error('Signup error:', error);
        alert('❌ Error creating account. Make sure the backend server is running.');
    }
}

/**
 * Logout
 */
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        currentUser = null;
        localStorage.removeItem('currentUser');
        updateUserUI();
        alert('✅ Logged out successfully');
    }
}

/**
 * Set up keyboard and click event listeners
 */
function setupEventListeners() {
    // Update labels when options change
    document.getElementById('option1Input').addEventListener('change', updateOptionLabels);
    document.getElementById('option2Input').addEventListener('change', updateOptionLabels);
    
    // Voice speed slider
    const speedSlider = document.getElementById('voiceSpeed');
    if (speedSlider) {
        speedSlider.addEventListener('input', function() {
            voiceSpeed = parseFloat(this.value);
            const speedText = voiceSpeed < 0.9 ? 'Calm & Clear' : voiceSpeed > 1.1 ? 'Fast & Dynamic' : 'Normal';
            document.getElementById('speedValue').textContent = voiceSpeed.toFixed(1) + 'x (' + speedText + ')';
        });
    }
    
    // Note: "Add Pro" and "Add Con" buttons now use onclick in HTML
}

/**
 * Toggle dark mode and save preference
 */
function toggleDarkMode() {
    const isDarkMode = document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', isDarkMode);
    updateDarkModeButton();
}

/**
 * Load dark mode preference from localStorage
 */
function loadDarkModePreference() {
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
    }
    updateDarkModeButton();
}

/**
 * Update dark mode button text/icon
 */
function updateDarkModeButton() {
    const btn = document.getElementById('darkModeBtn');
    const isDarkMode = document.body.classList.contains('dark-mode');
    btn.textContent = isDarkMode ? '☀️' : '🌙';
}

/**
 * Update option labels throughout the page
 */
function updateOptionLabels() {
    const option1Name = document.getElementById('option1Input').value || 'Option 1';
    const option2Name = document.getElementById('option2Input').value || 'Option 2';

    decisions.option1.name = option1Name;
    decisions.option2.name = option2Name;

    document.getElementById('option1Label').textContent = option1Name;
    document.getElementById('option2Label').textContent = option2Name;
    document.getElementById('resultOption1Label').textContent = option1Name;
    document.getElementById('resultOption2Label').textContent = option2Name;
}

/* ============================================
   DYNAMIC PRO & CON INPUT FIELD CREATION
   ============================================ */

/**
 * Add a new Pro input field for Option 1
 * Creates a text input + importance dropdown + remove button
 */
function addProInputField(optionNum) {
    // Get the container where we'll add the new input field
    const containerId = `dynamic-pro${optionNum}-container`;
    let container = document.getElementById(containerId);
    
    // If container doesn't exist, create it
    if (!container) {
        const prosList = document.getElementById(`pros${optionNum}List`);
        container = document.createElement('div');
        container.id = containerId;
        container.style.marginBottom = '15px';
        prosList.parentElement.insertBefore(container, prosList);
    }
    
    // Increment counter for unique IDs
    if (optionNum === 1) pro1Counter++;
    else pro2Counter++;
    
    const counter = optionNum === 1 ? pro1Counter : pro2Counter;
    const fieldId = `pro${optionNum}-field-${counter}`;
    
    // Create the input field wrapper
    const fieldWrapper = document.createElement('div');
    fieldWrapper.id = fieldId;
    fieldWrapper.style.marginBottom = '12px';
    fieldWrapper.style.display = 'flex';
    fieldWrapper.style.gap = '10px';
    fieldWrapper.style.flexWrap = 'wrap';
    fieldWrapper.style.alignItems = 'center';
    
    // Create text input
    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.placeholder = 'Enter a pro...';
    textInput.className = 'input-field';
    textInput.style.flex = '1';
    textInput.style.minWidth = '150px';
    textInput.style.marginBottom = '0';
    
    // Create importance dropdown
    const importanceSelect = document.createElement('select');
    importanceSelect.className = 'importance-select';
    importanceSelect.style.padding = '10px 12px';
    importanceSelect.innerHTML = `
        <option value="1">1 - Low</option>
        <option value="2">2 - Low-Mid</option>
        <option value="3" selected>3 - Medium</option>
        <option value="4">4 - Mid-High</option>
        <option value="5">5 - High</option>
    `;
    
    // Create "Add" button
    const addBtn = document.createElement('button');
    addBtn.textContent = '✓ Add';
    addBtn.className = 'btn-add';
    addBtn.style.flex = '0 0 auto';
    addBtn.style.padding = '10px 16px';
    addBtn.style.width = 'auto';
    addBtn.style.marginBottom = '0';
    addBtn.onclick = function() {
        submitProField(optionNum, textInput.value, importanceSelect.value, fieldId);
    };
    
    // Create "Remove" button for this input
    const removeBtn = document.createElement('button');
    removeBtn.textContent = '✕ Clear';
    removeBtn.style.backgroundColor = '#ff6b6b';
    removeBtn.style.color = 'white';
    removeBtn.style.padding = '10px 12px';
    removeBtn.style.width = 'auto';
    removeBtn.style.flex = '0 0 auto';
    removeBtn.style.marginBottom = '0';
    removeBtn.style.borderRadius = '8px';
    removeBtn.style.border = 'none';
    removeBtn.style.cursor = 'pointer';
    removeBtn.style.fontWeight = '600';
    removeBtn.onclick = function() {
        fieldWrapper.remove();
    };
    
    // Append all elements to the field wrapper
    fieldWrapper.appendChild(textInput);
    fieldWrapper.appendChild(importanceSelect);
    fieldWrapper.appendChild(addBtn);
    fieldWrapper.appendChild(removeBtn);
    
    // Add wrapper to container
    container.appendChild(fieldWrapper);
    
    // Focus on the text input for better UX
    textInput.focus();
}

/**
 * Add a new Con input field for Option 1
 * Creates a text input + importance dropdown + remove button
 */
function addConInputField(optionNum) {
    // Get the container where we'll add the new input field
    const containerId = `dynamic-con${optionNum}-container`;
    let container = document.getElementById(containerId);
    
    // If container doesn't exist, create it
    if (!container) {
        const consList = document.getElementById(`cons${optionNum}List`);
        container = document.createElement('div');
        container.id = containerId;
        container.style.marginBottom = '15px';
        consList.parentElement.insertBefore(container, consList);
    }
    
    // Increment counter for unique IDs
    if (optionNum === 1) con1Counter++;
    else con2Counter++;
    
    const counter = optionNum === 1 ? con1Counter : con2Counter;
    const fieldId = `con${optionNum}-field-${counter}`;
    
    // Create the input field wrapper
    const fieldWrapper = document.createElement('div');
    fieldWrapper.id = fieldId;
    fieldWrapper.style.marginBottom = '12px';
    fieldWrapper.style.display = 'flex';
    fieldWrapper.style.gap = '10px';
    fieldWrapper.style.flexWrap = 'wrap';
    fieldWrapper.style.alignItems = 'center';
    
    // Create text input
    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.placeholder = 'Enter a con...';
    textInput.className = 'input-field';
    textInput.style.flex = '1';
    textInput.style.minWidth = '150px';
    textInput.style.marginBottom = '0';
    
    // Create importance dropdown
    const importanceSelect = document.createElement('select');
    importanceSelect.className = 'importance-select';
    importanceSelect.style.padding = '10px 12px';
    importanceSelect.innerHTML = `
        <option value="1">1 - Low</option>
        <option value="2">2 - Low-Mid</option>
        <option value="3" selected>3 - Medium</option>
        <option value="4">4 - Mid-High</option>
        <option value="5">5 - High</option>
    `;
    
    // Create "Add" button
    const addBtn = document.createElement('button');
    addBtn.textContent = '✓ Add';
    addBtn.className = 'btn-add';
    addBtn.style.flex = '0 0 auto';
    addBtn.style.padding = '10px 16px';
    addBtn.style.width = 'auto';
    addBtn.style.marginBottom = '0';
    addBtn.onclick = function() {
        submitConField(optionNum, textInput.value, importanceSelect.value, fieldId);
    };
    
    // Create "Remove" button for this input
    const removeBtn = document.createElement('button');
    removeBtn.textContent = '✕ Clear';
    removeBtn.style.backgroundColor = '#ff6b6b';
    removeBtn.style.color = 'white';
    removeBtn.style.padding = '10px 12px';
    removeBtn.style.width = 'auto';
    removeBtn.style.flex = '0 0 auto';
    removeBtn.style.marginBottom = '0';
    removeBtn.style.borderRadius = '8px';
    removeBtn.style.border = 'none';
    removeBtn.style.cursor = 'pointer';
    removeBtn.style.fontWeight = '600';
    removeBtn.onclick = function() {
        fieldWrapper.remove();
    };
    
    // Append all elements to the field wrapper
    fieldWrapper.appendChild(textInput);
    fieldWrapper.appendChild(importanceSelect);
    fieldWrapper.appendChild(addBtn);
    fieldWrapper.appendChild(removeBtn);
    
    // Add wrapper to container
    container.appendChild(fieldWrapper);
    
    // Focus on the text input for better UX
    textInput.focus();
}

/**
 * Submit a pro field and add it to the list
 * @param {number} optionNum - Option 1 or 2
 * @param {string} proText - The pro text
 * @param {number} importance - Importance score (1-5)
 * @param {string} fieldId - ID of the field to remove
 */
function submitProField(optionNum, proText, importance, fieldId) {
    proText = proText.trim();
    
    // Validate: Don't add empty items
    if (proText === '') {
        alert('Please enter a pro before adding!');
        return;
    }
    
    // Add to data structure
    decisions[`option${optionNum}`].pros.push({
        text: proText,
        importance: parseInt(importance)
    });
    
    // Remove the input field
    document.getElementById(fieldId).remove();
    
    // Update display
    displayItems(optionNum);
}

/**
 * Submit a con field and add it to the list
 * @param {number} optionNum - Option 1 or 2
 * @param {string} conText - The con text
 * @param {number} importance - Importance score (1-5)
 * @param {string} fieldId - ID of the field to remove
 */
function submitConField(optionNum, conText, importance, fieldId) {
    conText = conText.trim();
    
    // Validate: Don't add empty items
    if (conText === '') {
        alert('Please enter a con before adding!');
        return;
    }
    
    // Add to data structure
    decisions[`option${optionNum}`].cons.push({
        text: conText,
        importance: parseInt(importance)
    });
    
    // Remove the input field
    document.getElementById(fieldId).remove();
    
    // Update display
    displayItems(optionNum);
}

/**
 * Display all pros and cons for an option
 * @param {number} optionNum - 1 or 2
 */
function displayItems(optionNum) {
    const option = decisions[`option${optionNum}`];

    // Display Pros
    const prosList = document.getElementById(`pros${optionNum}List`);
    prosList.innerHTML = '';
    option.pros.forEach((pro, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${pro.text}</span>
            <span class="importance-badge">Score: ${pro.importance}</span>
            <button onclick="deletePro(${optionNum}, ${index})">Delete</button>
        `;
        prosList.appendChild(li);
    });

    // Display Cons
    const consList = document.getElementById(`cons${optionNum}List`);
    consList.innerHTML = '';
    option.cons.forEach((con, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${con.text}</span>
            <span class="importance-badge">Score: ${con.importance}</span>
            <button onclick="deleteCon(${optionNum}, ${index})">Delete</button>
        `;
        consList.appendChild(li);
    });
}

/**
 * Delete a pro from specified option
 * @param {number} optionNum - 1 or 2
 * @param {number} index - index of pro to delete
 */
function deletePro(optionNum, index) {
    decisions[`option${optionNum}`].pros.splice(index, 1);
    displayItems(optionNum);
}

/**
 * Delete a con from specified option
 * @param {number} optionNum - 1 or 2
 * @param {number} index - index of con to delete
 */
function deleteCon(optionNum, index) {
    decisions[`option${optionNum}`].cons.splice(index, 1);
    displayItems(optionNum);
}

/**
 * Calculate the decision based on pros and cons
 * Score = sum of pros importance - sum of cons importance
 */
function calculateDecision() {
    // Get option names
    const option1Name = document.getElementById('option1Input').value.trim() || 'Option 1';
    const option2Name = document.getElementById('option2Input').value.trim() || 'Option 2';

    if (option1Name === '' || option2Name === '') {
        alert('Please enter names for both options!');
        return;
    }

    // Update decision data
    decisions.option1.name = option1Name;
    decisions.option2.name = option2Name;

    // Check if there's any data to analyze
    const totalItems = decisions.option1.pros.length + decisions.option1.cons.length +
                       decisions.option2.pros.length + decisions.option2.cons.length;

    if (totalItems === 0) {
        alert('Please add at least one pro or con to analyze!');
        return;
    }

    // Calculate scores
    const score1 = calculateScore(1);
    const score2 = calculateScore(2);

    // Update results display
    displayResults(score1, score2);

    // Show results section
    document.getElementById('resultsSection').style.display = 'block';
    document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth' });
}

/**
 * Calculate total score for an option
 * @param {number} optionNum - 1 or 2
 * @returns {number} total score
 */
function calculateScore(optionNum) {
    const option = decisions[`option${optionNum}`];

    // Sum pro scores
    const prosScore = option.pros.reduce((sum, pro) => sum + pro.importance, 0);

    // Sum con scores (negative because cons reduce the score)
    const consScore = option.cons.reduce((sum, con) => sum + con.importance, 0);

    // Total score = pros - cons
    return prosScore - consScore;
}

/**
 * Display results and recommendation
 * @param {number} score1 - Option 1 score
 * @param {number} score2 - Option 2 score
 */
function displayResults(score1, score2) {
    const option1Name = decisions.option1.name;
    const option2Name = decisions.option2.name;

    // Calculate component scores
    const option1Pros = decisions.option1.pros.reduce((sum, p) => sum + p.importance, 0);
    const option1Cons = decisions.option1.cons.reduce((sum, c) => sum + c.importance, 0);
    const option2Pros = decisions.option2.pros.reduce((sum, p) => sum + p.importance, 0);
    const option2Cons = decisions.option2.cons.reduce((sum, c) => sum + c.importance, 0);

    // Update result cards
    document.getElementById('resultOption1Label').textContent = option1Name;
    document.getElementById('option1Score').textContent = score1;
    document.getElementById('option1ProsScore').textContent = option1Pros;
    document.getElementById('option1ConsScore').textContent = option1Cons;

    document.getElementById('resultOption2Label').textContent = option2Name;
    document.getElementById('option2Score').textContent = score2;
    document.getElementById('option2ProsScore').textContent = option2Pros;
    document.getElementById('option2ConsScore').textContent = option2Cons;

    // Generate recommendation
    generateRecommendation(score1, score2, option1Name, option2Name);
}

/**
 * Generate recommendation based on scores
 * @param {number} score1 - Option 1 score
 * @param {number} score2 - Option 2 score
 * @param {string} name1 - Option 1 name
 * @param {string} name2 - Option 2 name
 */
function generateRecommendation(score1, score2, name1, name2) {
    const recommendationDiv = document.getElementById('recommendation');
    let recommendation = '';

    if (score1 > score2) {
        const difference = score1 - score2;
        recommendation = `
            <p>✅ <strong>${name1}</strong> is the better choice!</p>
            <p>Score Difference: <strong>+${difference}</strong> in favor of ${name1}</p>
            <p>${name1} has more advantages compared to ${name2}.</p>
        `;
    } else if (score2 > score1) {
        const difference = score2 - score1;
        recommendation = `
            <p>✅ <strong>${name2}</strong> is the better choice!</p>
            <p>Score Difference: <strong>+${difference}</strong> in favor of ${name2}</p>
            <p>${name2} has more advantages compared to ${name1}.</p>
        `;
    } else {
        recommendation = `
            <p>⚖️ <strong>It's a tie!</strong></p>
            <p>Both options have equal scores (${score1}).</p>
            <p>Consider factors beyond the analysis or add more pros/cons to help decide.</p>
        `;
    }

    recommendationDiv.innerHTML = recommendation;
}

/**
 * Save the current decision to localStorage
 */
function saveDecision() {
    // Validate inputs
    const option1Name = document.getElementById('option1Input').value.trim();
    const option2Name = document.getElementById('option2Input').value.trim();

    if (option1Name === '' || option2Name === '') {
        alert('Please enter names for both options!');
        return;
    }

    // Update decision names
    decisions.option1.name = option1Name;
    decisions.option2.name = option2Name;

    // Save to localStorage
    localStorage.setItem('decisionData', JSON.stringify(decisions));
    localStorage.setItem('lastSaved', new Date().toLocaleString());

    alert('✅ Decision saved successfully!');
}

/**
 * Load saved decision from localStorage
 */
function loadSavedDecision() {
    const saved = localStorage.getItem('decisionData');
    if (saved) {
        try {
            decisions = JSON.parse(saved);

            // Populate option names
            document.getElementById('option1Input').value = decisions.option1.name;
            document.getElementById('option2Input').value = decisions.option2.name;

            // Update labels
            updateOptionLabels();

            // Display saved items
            displayItems(1);
            displayItems(2);
        } catch (e) {
            console.error('Error loading saved decision:', e);
        }
    }
}

/**
 * Reset all data and start fresh
 * Clears all entries and hides results section
 */
function resetAll() {
    if (confirm('Are you sure you want to start over? This will clear all your entries.')) {
        // Clear data
        decisions = {
            option1: {
                name: 'Option 1',
                pros: [],
                cons: []
            },
            option2: {
                name: 'Option 2',
                pros: [],
                cons: []
            }
        };

        // Clear all input fields
        document.getElementById('option1Input').value = '';
        document.getElementById('option2Input').value = '';

        // Clear all lists
        document.getElementById('pros1List').innerHTML = '';
        document.getElementById('cons1List').innerHTML = '';
        document.getElementById('pros2List').innerHTML = '';
        document.getElementById('cons2List').innerHTML = '';

        // Clear dynamic input containers if they exist
        const containers = ['dynamic-pro1-container', 'dynamic-con1-container', 
                           'dynamic-pro2-container', 'dynamic-con2-container'];
        containers.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });

        // Reset counters
        pro1Counter = 0;
        con1Counter = 0;
        pro2Counter = 0;
        con2Counter = 0;

        // Hide results section
        document.getElementById('resultsSection').style.display = 'none';

        // Scroll back to top
        document.querySelector('header').scrollIntoView({ behavior: 'smooth' });

        alert('Fresh start! All entries cleared.');
    }
}

/**
 * Generate AI Insights using Decision Science Frameworks
 * Uses 6 frameworks: Financial, Practical, Emotional, Time-Based, Risk, and Opportunity Cost
 */
function generateAIInsights() {
    const option1Name = document.getElementById('option1Input').value.trim();
    const option2Name = document.getElementById('option2Input').value.trim();
    
    // Validation: Check if both options are entered
    if (!option1Name || !option2Name) {
        alert('⚠️ Please enter both option names first to get AI insights!');
        document.getElementById('option1Input').focus();
        return;
    }
    
    // Confirm with user
    const proceed = confirm(
        `🤖 I'll analyze these options using decision frameworks:\n\n` +
        `Option 1: "${option1Name}"\n` +
        `Option 2: "${option2Name}"\n\n` +
        `This will add smart pros/cons with importance weights. Continue?`
    );
    
    if (!proceed) return;
    
    // Comprehensive insight database organized by decision categories
    const insights = {
        financial: {
            pros: [
                { text: 'Cost-effective long-term', importance: 5 },
                { text: 'Better return on investment (ROI)', importance: 5 },
                { text: 'Reduces ongoing expenses', importance: 4 },
                { text: 'Generates additional income', importance: 5 },
                { text: 'Improves cash flow', importance: 4 },
                { text: 'Better financial stability', importance: 4 }
            ],
            cons: [
                { text: 'High upfront costs', importance: 5 },
                { text: 'Requires financial commitment', importance: 4 },
                { text: 'Fluctuating expenses', importance: 3 },
                { text: 'Limited budget for other needs', importance: 4 },
                { text: 'Financial risk involved', importance: 5 },
                { text: 'Slower return on investment', importance: 4 }
            ]
        },
        practical: {
            pros: [
                { text: 'Easier to implement immediately', importance: 4 },
                { text: 'Less complex logistically', importance: 3 },
                { text: 'Requires minimal preparation', importance: 3 },
                { text: 'Uses existing resources effectively', importance: 4 },
                { text: 'Quick setup and deployment', importance: 4 },
                { text: 'Straightforward process', importance: 3 }
            ],
            cons: [
                { text: 'Complicated to execute properly', importance: 4 },
                { text: 'Requires extensive planning', importance: 4 },
                { text: 'Needs specialized tools/resources', importance: 4 },
                { text: 'Time-consuming implementation', importance: 5 },
                { text: 'Currently unavailable resources', importance: 4 },
                { text: 'Requires external support/expertise', importance: 3 }
            ]
        },
        timeAndEffort: {
            pros: [
                { text: 'Saves significant time daily/weekly', importance: 5 },
                { text: 'Reduces workload and stress', importance: 4 },
                { text: 'Faster results and outcomes', importance: 4 },
                { text: 'Frees up mental energy for other tasks', importance: 3 },
                { text: 'Quick decision implementation', importance: 3 },
                { text: 'Less ongoing maintenance needed', importance: 3 }
            ],
            cons: [
                { text: 'Requires substantial time investment upfront', importance: 5 },
                { text: 'Steep learning curve', importance: 4 },
                { text: 'Ongoing time commitment needed', importance: 4 },
                { text: 'Delayed payoff and results', importance: 4 },
                { text: 'Complex and demanding process', importance: 4 },
                { text: 'Continuous effort required', importance: 3 }
            ]
        },
        emotional: {
            pros: [
                { text: 'Increases confidence and motivation', importance: 4 },
                { text: 'Better alignment with personal values', importance: 5 },
                { text: 'Reduced stress and anxiety long-term', importance: 4 },
                { text: 'Brings more satisfaction and happiness', importance: 4 },
                { text: 'Feels right intuitively', importance: 3 },
                { text: 'Improves overall peace of mind', importance: 4 }
            ],
            cons: [
                { text: 'Creates fear or anxiety about the choice', importance: 4 },
                { text: 'Conflicts with personal values', importance: 5 },
                { text: 'May cause regret later', importance: 4 },
                { text: 'Uncomfortable or stressful process', importance: 3 },
                { text: 'Triggers self-doubt and uncertainty', importance: 3 },
                { text: 'Feels emotionally draining', importance: 3 }
            ]
        },
        riskAndUncertainty: {
            pros: [
                { text: 'Proven track record of success', importance: 5 },
                { text: 'Low risk of failure', importance: 5 },
                { text: 'Predictable and stable outcomes', importance: 4 },
                { text: 'Well-tested and reliable method', importance: 4 },
                { text: 'Minimal unknown variables', importance: 3 },
                { text: 'Protected against market changes', importance: 3 }
            ],
            cons: [
                { text: 'High uncertainty and unpredictability', importance: 5 },
                { text: 'Significant risk of failure', importance: 5 },
                { text: 'Untested approach with unknown outcomes', importance: 4 },
                { text: 'Vulnerable to external market changes', importance: 4 },
                { text: 'No guarantee of success', importance: 4 },
                { text: 'Potential hidden pitfalls unknown', importance: 3 }
            ]
        },
        hiddenFactors: {
            pros: [
                { text: 'Opens doors for future opportunities', importance: 4 },
                { text: 'Builds valuable skills/experience', importance: 4 },
                { text: 'Creates networking and relationship benefits', importance: 3 },
                { text: 'Long-term career/personal growth potential', importance: 5 },
                { text: 'Avoids sunk cost fallacy', importance: 3 },
                { text: 'Positions you for future success', importance: 4 }
            ],
            cons: [
                { text: 'Closes alternative opportunities', importance: 5 },
                { text: 'Opportunity cost from other options', importance: 5 },
                { text: 'Misses potential future benefits elsewhere', importance: 4 },
                { text: 'Sunk costs in current situation', importance: 3 },
                { text: 'Limits future flexibility', importance: 4 },
                { text: 'Precedent may limit future choices', importance: 3 }
            ]
        }
    };
    
    // Select 3-4 random categories to create diverse insights
    const categories = Object.keys(insights);
    const selectedCategories = [];
    
    while (selectedCategories.length < 3 && selectedCategories.length < categories.length) {
        const randomCategory = categories[Math.floor(Math.random() * categories.length)];
        if (!selectedCategories.includes(randomCategory)) {
            selectedCategories.push(randomCategory);
        }
    }
    
    // Generate insights for both options
    selectedCategories.forEach(category => {
        const categoryInsights = insights[category];
        
        // Option 1: Alternate between pros and cons
        const randomPro = categoryInsights.pros[Math.floor(Math.random() * categoryInsights.pros.length)];
        const randomCon = categoryInsights.cons[Math.floor(Math.random() * categoryInsights.cons.length)];
        
        // Add to opposite options to create contrast
        addProFieldWithValue(1, randomPro.text, randomPro.importance);
        addConFieldWithValue(1, randomCon.text, randomCon.importance);
        
        // Option 2: Add con from option 1's pros and pro from option 1's cons
        const randomPro2 = categoryInsights.pros[Math.floor(Math.random() * categoryInsights.pros.length)];
        const randomCon2 = categoryInsights.cons[Math.floor(Math.random() * categoryInsights.cons.length)];
        
        addConFieldWithValue(2, randomPro2.text, randomPro2.importance);
        addProFieldWithValue(2, randomCon2.text, randomCon2.importance);
    });
    
    // Show success message with tips
    alert(
        `✨ AI Insights Added!\n\n` +
        `I've analyzed your options using decision science frameworks:\n\n` +
        `✓ Financial impact analysis\n` +
        `✓ Practical feasibility assessment\n` +
        `✓ Time and effort impact\n` +
        `✓ Emotional considerations\n` +
        `✓ Risk evaluation\n` +
        `✓ Hidden opportunity costs\n\n` +
        `💡 Tip: Adjust importance scores (1-5) based on what matters most to you!\n` +
        `Then click "Calculate Decision" to see your results.`
    );
    
    // Scroll to analysis section
    document.querySelector('.analysis-section').scrollIntoView({ behavior: 'smooth' });
}

/**
 * Helper function to add pro field with value directly
 */
function addProFieldWithValue(optionNum, text, importance) {
    const list = document.getElementById(`pros${optionNum}List`);
    const listItem = document.createElement('li');
    listItem.className = 'item';
    
    const itemContent = document.createElement('div');
    itemContent.className = 'item-content';
    itemContent.innerHTML = `<strong>${text}</strong>`;
    
    const importance_badge = document.createElement('span');
    importance_badge.className = 'importance-badge importance-' + importance;
    importance_badge.textContent = importance + '/5';
    
    const itemRemove = document.createElement('button');
    itemRemove.className = 'btn-remove';
    itemRemove.textContent = '✕';
    itemRemove.onclick = function() { listItem.remove(); };
    
    listItem.appendChild(itemContent);
    listItem.appendChild(importance_badge);
    listItem.appendChild(itemRemove);
    list.appendChild(listItem);
    
    // Update data structure
    decisions[`option${optionNum}`].pros.push({
        text: text,
        importance: parseInt(importance)
    });
}

/**
 * Save decision to backend API
 */
async function saveDecision() {
    const decisionData = {
        option1Name: decisions.option1.name,
        option2Name: decisions.option2.name,
        pros1: decisions.option1.pros,
        cons1: decisions.option1.cons,
        pros2: decisions.option2.pros,
        cons2: decisions.option2.cons
    };

    try {
        const response = await fetch(`${API_BASE_URL}/api/decisions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(decisionData)
        });

        if (response.ok) {
            const result = await response.json();
            alert(`✅ Decision saved successfully!\n\nDecision ID: ${result.id}\nCreated: ${new Date(result.createdAt).toLocaleString()}`);
        } else {
            const error = await response.json();
            alert(`❌ Failed to save decision: ${error.error || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Save error:', error);
        alert('❌ Error saving decision. Make sure the backend server is running.');
    }
}

/**
 * Load all saved decisions from backend and display in table
 */
async function loadAllDecisions() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/decisions`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const decisions = await response.json();
            displayDecisionsTable(decisions);
        } else {
            alert('Failed to load decisions');
        }
    } catch (error) {
        console.error('Load all decisions error:', error);
        alert('❌ Error loading decisions. Make sure the backend server is running.');
    }
}

/**
 * Display decisions in a table
 */
function displayDecisionsTable(decisionsData) {
    const decisionsList = document.getElementById('decisionsList');
    const noDecisions = document.getElementById('noDecisions');
    const tableBody = document.getElementById('decisionsTableBody');

    if (decisionsData.length === 0) {
        decisionsList.style.display = 'none';
        noDecisions.style.display = 'block';
        return;
    }

    tableBody.innerHTML = '';
    decisionsData.forEach(decision => {
        const row = document.createElement('tr');
        const createdDate = new Date(decision.createdAt).toLocaleString();
        row.innerHTML = `
            <td>${decision.id}</td>
            <td>${decision.option1Name}</td>
            <td>${decision.option2Name}</td>
            <td>${createdDate}</td>
            <td>
                <button onclick="loadSingleDecision('${decision.id}')" class="btn-load-decision">Load</button>
                <button onclick="shareDecision('${decision.id}')" class="btn-share-decision">Share</button>
            </td>
        `;
        tableBody.appendChild(row);
    });

    decisionsList.style.display = 'block';
    noDecisions.style.display = 'none';
}

/**
 * Load a single decision by ID and populate the form
 */
async function loadSingleDecision(decisionId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/decisions/${decisionId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const decision = await response.json();
            
            // Parse JSON strings back to objects
            const pros1 = typeof decision.pros1 === 'string' ? JSON.parse(decision.pros1) : decision.pros1;
            const cons1 = typeof decision.cons1 === 'string' ? JSON.parse(decision.cons1) : decision.cons1;
            const pros2 = typeof decision.pros2 === 'string' ? JSON.parse(decision.pros2) : decision.pros2;
            const cons2 = typeof decision.cons2 === 'string' ? JSON.parse(decision.cons2) : decision.cons2;

            // Clear current data
            decisions.option1.pros = [];
            decisions.option1.cons = [];
            decisions.option2.pros = [];
            decisions.option2.cons = [];
            pro1Counter = 0;
            con1Counter = 0;
            pro2Counter = 0;
            con2Counter = 0;

            // Populate form fields
            document.getElementById('option1Input').value = decision.option1Name;
            document.getElementById('option2Input').value = decision.option2Name;
            updateOptionLabels();

            // Add pros and cons
            pros1.forEach(pro => addProFieldWithValue(1, pro.text, pro.importance));
            cons1.forEach(con => addConFieldWithValue(1, con.text, con.importance));
            pros2.forEach(pro => addProFieldWithValue(2, pro.text, pro.importance));
            cons2.forEach(con => addConFieldWithValue(2, con.text, con.importance));

            // Scroll to top to see loaded decision
            window.scrollTo(0, 0);
            alert(`✅ Decision #${decisionId} loaded successfully!`);
        } else {
            alert('Failed to load decision');
        }
    } catch (error) {
        console.error('Load single decision error:', error);
        alert('❌ Error loading decision. Make sure the backend server is running.');
    }
}

/**
 * Share a decision by ID
 */
async function shareDecision(decisionId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/decisions/${decisionId}/share`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const result = await response.json();
            const shareUrl = result.share_url;
            
            // Copy to clipboard
            navigator.clipboard.writeText(shareUrl).then(() => {
                alert(`✅ Share link copied!\n\n${shareUrl}\n\nYou can now share this link with others to view your decision.`);
            }).catch(() => {
                alert(`✅ Share link generated!\n\n${shareUrl}\n\nCopy this link to share your decision.`);
            });
        } else {
            alert('❌ Failed to generate share link');
        }
    } catch (error) {
        console.error('Share decision error:', error);
        alert('❌ Error sharing decision. Make sure the backend server is running.');
    }
}

/**
 * Helper function to add pro field with value directly
 */

    
    const itemContent = document.createElement('div');
    itemContent.className = 'item-content';
    itemContent.innerHTML = `<strong>${text}</strong>`;
    
    const importance_badge = document.createElement('span');
    importance_badge.className = 'importance-badge importance-' + importance;
    importance_badge.textContent = importance + '/5';
    
    const itemRemove = document.createElement('button');
    itemRemove.className = 'btn-remove';
    itemRemove.textContent = '✕';
    itemRemove.onclick = function() { listItem.remove(); };
    
    listItem.appendChild(itemContent);
    listItem.appendChild(importance_badge);
    listItem.appendChild(itemRemove);
    list.appendChild(listItem);
    
    // Update data structure
    decisions[`option${optionNum}`].cons.push({
        text: text,
        importance: parseInt(importance)
    });
}

/* ============================================
   VOICE & ANXIETY RELIEF FUNCTIONS
   ============================================ */

/**
 * Read the two options aloud
 */
function readOptions() {
    const option1 = document.getElementById('option1Input').value.trim();
    const option2 = document.getElementById('option2Input').value.trim();
    
    if (!option1 || !option2) {
        alert('⚠️ Please enter both options first!');
        return;
    }
    
    // Stop any previous speech
    synth.cancel();
    
    const text = `Let me help you think through your decision. 
    Your first option is: ${option1}. 
    Your second option is: ${option2}. 
    Take a moment to think about each one.`;
    
    speak(text);
}

/**
 * Read all pros and cons aloud
 */
function readAnalysis() {
    const option1Name = document.getElementById('option1Input').value.trim() || 'Option 1';
    const option2Name = document.getElementById('option2Input').value.trim() || 'Option 2';
    
    if (decisions.option1.pros.length === 0 && decisions.option1.cons.length === 0 &&
        decisions.option2.pros.length === 0 && decisions.option2.cons.length === 0) {
        alert('⚠️ Add some pros and cons first!');
        return;
    }
    
    synth.cancel();
    
    let text = `Here is your analysis:\n\n`;
    
    // Option 1 analysis
    text += `For ${option1Name}:\n`;
    if (decisions.option1.pros.length > 0) {
        text += `Advantages: ${decisions.option1.pros.map(p => p.text).join(', ')}. \n`;
    }
    if (decisions.option1.cons.length > 0) {
        text += `Disadvantages: ${decisions.option1.cons.map(c => c.text).join(', ')}. \n`;
    }
    
    text += `\n`;
    
    // Option 2 analysis
    text += `For ${option2Name}:\n`;
    if (decisions.option2.pros.length > 0) {
        text += `Advantages: ${decisions.option2.pros.map(p => p.text).join(', ')}. \n`;
    }
    if (decisions.option2.cons.length > 0) {
        text += `Disadvantages: ${decisions.option2.cons.map(c => c.text).join(', ')}. \n`;
    }
    
    text += `\nTake your time processing this information.`;
    
    speak(text);
}

/**
 * Start a guided breathing exercise for anxiety relief
 */
function startBreathingExercise() {
    synth.cancel();
    
    // Introduction
    const introText = `Welcome to your two-minute calm breathing exercise. This will help you reduce anxiety and think more clearly. 
    Let's start. Find a comfortable position, and focus on my voice.`;
    
    speak(introText, () => {
        // Begin breathing cycle
        let cycleCount = 0;
        const maxCycles = 4; // 4 cycles of breathing in ~30 seconds each
        
        const breathingCycle = () => {
            if (cycleCount >= maxCycles) {
                // End message
                const endText = `Excellent. You're doing great. Take a moment to feel the calm and clarity. You're ready to make your decision.`;
                speak(endText);
                return;
            }
            
            const breatheInText = `Breathe in slowly through your nose for 4 counts. One... two... three... four.`;
            speak(breatheInText, () => {
                setTimeout(() => {
                    const holdText = `Hold your breath for 4 counts. One... two... three... four.`;
                    speak(holdText, () => {
                        setTimeout(() => {
                            const breatheOutText = `Breathe out slowly through your mouth for 4 counts. One... two... three... four.`;
                            speak(breatheOutText, () => {
                                setTimeout(() => {
                                    cycleCount++;
                                    breathingCycle();
                                }, 1000);
                            });
                        }, 500);
                    });
                }, 500);
            });
        };
        
        // Start breathing after 2 seconds
        setTimeout(breathingCycle, 2000);
    });
}

/**
 * Core speech function using Web Speech API
 */
function speak(text, callback) {
    // Cancel any existing utterance
    synth.cancel();
    
    // Create new utterance
    currentUtterance = new SpeechSynthesisUtterance(text);
    currentUtterance.rate = voiceSpeed;
    currentUtterance.pitch = 1;
    currentUtterance.volume = 1;
    
    // Use a calm voice if available
    const voices = synth.getVoices();
    const preferredVoice = voices.find(voice => 
        voice.name.includes('Google') || voice.name.includes('Samantha') || voice.name.includes('Victoria')
    ) || voices[0];
    
    if (preferredVoice) {
        currentUtterance.voice = preferredVoice;
    }
    
    // Handle completion
    if (callback) {
        currentUtterance.onend = callback;
    }
    
    currentUtterance.onerror = (event) => {
        console.error('Speech synthesis error:', event.error);
        alert('⚠️ Voice feature not available on this browser. Please use Chrome, Edge, or Safari.');
    };
    
    // Start speaking
    synth.speak(currentUtterance);
}

/**
 * Stop all voice playback
 */
function stopVoice() {
    synth.cancel();
    currentUtterance = null;
    alert('Audio stopped.');
}
