// content.js
// This script runs on the MUGEN betting website (SaltyBet).

console.log("SaltyScope: Content script loaded!");

// --- Configuration ---
const BETTING_BUTTON_SELECTOR_1 = 'input#player1.betbuttonred';
const BETTING_BUTTON_SELECTOR_2 = 'input#player2.betbuttonblue';
const WAGER_INPUT_SELECTOR = 'input#wager'; // Selector for the betting input field
const BALANCE_ELEMENT_SELECTOR = 'span#balance.dollar'; // Selector for the user's cash balance
const RED_TEXT_NAME_SELECTOR = 'span.redtext'; // Selector for fighter 1 name when betting is disabled
const BLUE_TEXT_NAME_SELECTOR = 'span.bluetext'; // Selector for fighter 2 name when betting is disabled
const ODDS_SPAN_SELECTOR = 'span#odds.dynamic-view'; // Selector for the parent of red/blue text
const FOOTER_ALERT_SELECTOR = 'div#footer-alert.purpletext.alerttext'; // Selector for mode detection
const TARGET_ELEMENT_FOR_OBSERVER_SELECTOR = 'body'; // Refine this if a more specific container is available

// --- Global Variables ---
let currentFighter1 = { name: null, elo: 'N/A', tierElo: 'N/A', tier: 'N/A' };
let currentFighter2 = { name: null, elo: 'N/A', tierElo: 'N/A', tier: 'N/A' };
let isBettingOpen = false; // Track if betting is currently open
let isFetchingData = false; // Prevent multiple API calls for the same match
let lastStatusMessage = "Waiting for match..."; // Store the last detailed status message
let currentMatchMode = 'Matchmaking'; // Default match mode
let currentMatchTier = 'N/A'; // Default match tier

// Betting Preferences (will be loaded from storage/popup)
let bettingMode = 'elo'; // 'elo', 'tiered-elo', 'xp-bet', 'disabled'
let maxBetValue = 100;   // Numeric value for max bet
let maxBetType = 'percentage'; // '%' or '$'
let allInThresholdValue = 1000; // Numeric value for all-in threshold
let allInThresholdType = 'dollar'; // '%' or '$' for all-in threshold
let upsetMode = false; // Flag for upset betting mode
let allInTournamentMode = false; // Flag for all-in during tournament mode
let betOneDollarExhibitionMode = false; // Flag for $1 bet during exhibition mode

// --- API Configuration ---
const SALTY_BOY_API_BASE_URL = 'https://salty-boy.com/api/fighter/?name=';
const RANDOM_ORG_API_URL = 'https://www.random.org/integers/?num=1&min=1&max=2&col=1&base=10&format=plain&rnd=new';

// --- Helper Functions ---

/**
 * Reads the current cash balance from the page.
 * @returns {number} The current cash balance, or 0 if not found/invalid.
 */
function getCurrentBalance() {
    const balanceElement = document.querySelector(BALANCE_ELEMENT_SELECTOR);
    if (balanceElement) {
        const balanceText = balanceElement.textContent.replace(/[^0-9.]/g, ''); // Remove non-numeric chars except dot
        const balance = parseFloat(balanceText);
        if (!isNaN(balance)) {
            console.log(`SaltyScope: Current balance detected: $${balance}`);
            return balance;
        }
    }
    console.warn("SaltyScope: Could not read current balance from page.");
    return 0;
}

/**
 * Saves the current match data and status message to Chrome's local storage.
 */
function saveMatchDataToStorage() {
    chrome.storage.local.set({
        saltyScopeFighter1: currentFighter1,
        saltyScopeFighter2: currentFighter2,
        saltyScopeIsBettingOpen: isBettingOpen,
        saltyScopeLastStatusMessage: lastStatusMessage,
        saltyScopeMatchMode: currentMatchMode,
        saltyScopeMatchTier: currentMatchTier
    }, () => {
        if (chrome.runtime.lastError) {
            console.error("SaltyScope: Error saving match data to local storage:", chrome.runtime.lastError);
        } else {
            console.log("SaltyScope: Match data and status saved to local storage.");
        }
    });
}

/**
 * Saves the current betting preferences to Chrome's local storage.
 */
function saveBettingPrefsToStorage() {
    chrome.storage.local.set({
        bettingMode: bettingMode,
        maxBetValue: maxBetValue,
        maxBetType: maxBetType,
        allInThresholdValue: allInThresholdValue,
        allInThresholdType: allInThresholdType,
        upsetMode: upsetMode,
        allInTournamentMode: allInTournamentMode,
        betOneDollarExhibitionMode: betOneDollarExhibitionMode
    }, () => {
        if (chrome.runtime.lastError) {
            console.error("SaltyScope: Error saving betting preferences to local storage:", chrome.runtime.lastError);
        } else {
            console.log("SaltyScope: Betting preferences saved to local storage.");
        }
    });
}

/**
 * Loads betting preferences from Chrome's local storage on startup.
 */
function loadBettingPrefsFromStorage() {
    chrome.storage.local.get([
        'bettingMode', 'maxBetValue', 'maxBetType',
        'allInThresholdValue', 'allInThresholdType', 'upsetMode', 'allInTournamentMode', 'betOneDollarExhibitionMode'
    ], (result) => {
        if (result.bettingMode) {
            bettingMode = result.bettingMode;
            console.log(`SaltyScope: Loaded bettingMode: ${bettingMode}`);
        }
        if (result.maxBetValue !== undefined) {
            maxBetValue = result.maxBetValue;
            console.log(`SaltyScope: Loaded maxBetValue: ${maxBetValue}`);
        }
        if (result.maxBetType) {
            maxBetType = result.maxBetType;
            console.log(`SaltyScope: Loaded maxBetType: ${maxBetType}`);
        }
        if (result.allInThresholdValue !== undefined) {
            allInThresholdValue = result.allInThresholdValue;
            console.log(`SaltyScope: Loaded allInThresholdValue: ${allInThresholdValue}`);
        }
        if (result.allInThresholdType) {
            allInThresholdType = result.allInThresholdType;
            console.log(`SaltyScope: Loaded allInThresholdType: ${allInThresholdType}`);
        }
        if (result.upsetMode !== undefined) {
            upsetMode = result.upsetMode;
            console.log(`SaltyScope: Loaded upsetMode: ${upsetMode}`);
        }
        if (result.allInTournamentMode !== undefined) {
            allInTournamentMode = result.allInTournamentMode;
            console.log(`SaltyScope: Loaded allInTournamentMode: ${allInTournamentMode}`);
        }
        if (result.betOneDollarExhibitionMode !== undefined) {
            betOneDollarExhibitionMode = result.betOneDollarExhibitionMode;
            console.log(`SaltyScope: Loaded betOneDollarExhibitionMode: ${betOneDollarExhibitionMode}`);
        }
    });
}

/**
 * Sends fighter information to the extension popup.
 * Now includes match tier and mode.
 */
function sendFighterInfoToPopup() {
    console.log("SaltyScope: Preparing to send fighter info to popup. Current state:");
    console.log("  Fighter 1:", JSON.stringify(currentFighter1));
    console.log("  Fighter 2:", JSON.stringify(currentFighter2));
    console.log("  Betting Open:", isBettingOpen);
    console.log("  Status Message:", lastStatusMessage);
    console.log("  Match Mode:", currentMatchMode);
    console.log("  Match Tier:", currentMatchTier);


    chrome.runtime.sendMessage({
        type: "UPDATE_FIGHTER_INFO",
        fighter1: currentFighter1,
        fighter2: currentFighter2,
        bettingOpen: isBettingOpen,
        statusMessage: lastStatusMessage,
        matchMode: currentMatchMode,
        matchTier: currentMatchTier
    })
    .then(response => {
        console.log("SaltyScope: Message to popup sent successfully (if listener exists).");
    })
    .catch(error => {
        if (error.message.includes("Could not establish connection. Receiving end does not exist.")) {
            // console.log("SaltyScope: Popup not open, could not send fighter info (expected if popup is closed).");
        } else {
            console.error("SaltyScope: Error sending message to popup:", error);
        }
    });
}

/**
 * Sends a betting status update message to the extension popup.
 * Also updates the global lastStatusMessage and saves to storage.
 * @param {string} message - The status message to display.
 * @param {boolean} bettingOpen - True if betting is open, false otherwise.
 */
function sendBettingStatusToPopup(message, bettingOpen) {
    console.log("SaltyScope: Attempting to send betting status to popup:", { message, bettingOpen });
    lastStatusMessage = message; // Update global status message
    isBettingOpen = bettingOpen; // Ensure global betting state is in sync
    saveMatchDataToStorage(); // Save the updated status and betting state

    chrome.runtime.sendMessage({
        type: "BETTING_STATUS_UPDATE",
        message: message,
        bettingOpen: bettingOpen
    })
    .then(response => {
        console.log("SaltyScope: Betting status message sent successfully (if listener exists).");
    })
    .catch(error => {
        if (error.message.includes("Could not establish connection. Receiving end does not exist.")) {
            // console.log("SaltyScope: Popup not open, could not send betting status (expected if popup is closed).");
        } else {
            console.error("SaltyScope: Error sending message to popup:", error);
        }
    });
}

/**
 * Cleans a fighter name string by removing common extraneous characters.
 * This includes numbers, pipe characters, and non-breaking spaces,
 * based on the formats observed in button values and span text.
 * @param {string} nameText - The raw text content from the DOM element or button value.
 * @returns {string} The cleaned fighter name.
 */
function cleanFighterName(nameText) {
    // Regex to remove:
    // 1. "NUMBER | " (e.g., "29 | ") at the start
    // 2. " | NUMBER" (e.g., " | 23") at the end
    // 3. Non-breaking spaces (\u00A0)
    let cleanedName = nameText.replace(/^\s*\d+\s*\|\s*|\s*\|\s*\d+\s*|\u00A0/g, '').trim();
    return cleanedName;
}

/**
 * Detects the current match mode (Matchmaking, Tournament, Exhibition).
 * @returns {string} The detected match mode.
 */
function detectMatchMode() {
    const footerAlert = document.querySelector(FOOTER_ALERT_SELECTOR);
    if (footerAlert && footerAlert.textContent !== null) {
        const text = footerAlert.textContent.trim();

        // Tournament mode detection
        if (text.includes("Tournament mode start!") ||
            text.match(/\d+\s*characters are left in the bracket!/i) ||
            text.includes("FINAL ROUND!")) {
            return 'Tournament';
        }

        // Matchmaking mode detection (new check)
        if (text.match(/\d+\s*more matches until the next tournament!/i)) {
            return 'Matchmaking';
        }

        // If not Tournament and not the new Matchmaking pattern, assume Exhibition
        // This covers cases where the text might be empty or other exhibition-related messages.
        return 'Exhibition';
    }
    return 'Matchmaking'; // Default to Matchmaking if element not found or textContent is null
}


/**
 * Extracts fighter names from the betting buttons and checks if betting is open.
 * Updates global fighter variables and triggers API calls if new fighters are detected.
 * Also updates bettingOpen status.
 */
function extractFighterNamesAndBettingStatus() {
    const player1Button = document.querySelector(BETTING_BUTTON_SELECTOR_1);
    const player2Button = document.querySelector(BETTING_BUTTON_SELECTOR_2);
    const redTextSpan = document.querySelector(RED_TEXT_NAME_SELECTOR);
    const blueTextSpan = document.querySelector(BLUE_TEXT_NAME_SELECTOR);

    let newName1 = null;
    let newName2 = null;
    let buttonsFound = false;

    // Detect match mode first
    currentMatchMode = detectMatchMode();
    console.log(`SaltyScope: Detected Match Mode: ${currentMatchMode}`);

    if (player1Button && player2Button) {
        buttonsFound = true;
        const newIsBettingOpen = !player1Button.disabled && !player2Button.disabled;

        if (newIsBettingOpen) {
            // Betting is open, get names from buttons and CLEAN them
            if (player1Button.value.trim() !== '' && player2Button.value.trim() !== '') {
                newName1 = cleanFighterName(player1Button.value);
                newName2 = cleanFighterName(player2Button.value);
                console.log(`SaltyScope: Betting OPEN. Names from buttons (cleaned): P1='${newName1}', P2='${newName2}'`);
            } else {
                console.log("SaltyScope: Betting open, but button values are empty. Will re-evaluate on next DOM change.");
            }
        } else {
            // Betting is closed (match in progress), get names from spans
            if (redTextSpan && blueTextSpan && redTextSpan.textContent.trim() !== '' && blueTextSpan.textContent.trim() !== '') {
                newName1 = cleanFighterName(redTextSpan.textContent);
                newName2 = cleanFighterName(blueTextSpan.textContent);
                console.log(`SaltyScope: Betting CLOSED. Names from spans (cleaned): P1='${newName1}', P2='${newName2}'`);
            } else {
                console.log("SaltyScope: Betting closed, but red/blue name spans found with empty or whitespace content. Will re-evaluate on next DOM change.");
            }
        }

        // --- Handle Betting State Change ---
        if (newIsBettingOpen !== isBettingOpen) {
            isBettingOpen = newIsBettingOpen; // Update global state
            if (isBettingOpen) {
                console.log("SaltyScope: Betting just opened.");
                sendBettingStatusToPopup("Betting Open!", true);
            } else {
                console.log("SaltyScope: Betting just closed.");
                sendBettingStatusToPopup("Betting Closed.", false);
                // Reset fighter data when betting closes
                currentFighter1 = { name: null, elo: 'N/A', tierElo: 'N/A', tier: 'N/A' };
                currentFighter2 = { name: null, elo: 'N/A', tierElo: 'N/A', tier: 'N/A' };
                currentMatchTier = 'N/A'; // Clear tier on match end
                sendFighterInfoToPopup(); // Update popup with cleared data
                saveMatchDataToStorage(); // Save cleared state
            }
        }

        // --- Handle Fighter Name Change / Initial Detection ---
        if (newName1 && newName2) { // Ensure we have valid names from whichever source
            const namesChanged = (newName1 !== currentFighter1.name || newName2 !== currentFighter2.name);
            // Check if ELOs are not numerical (meaning they are 'N/A', 'Fetching...', or 'Not Found')
            const needsRefetch = (isNaN(parseFloat(currentFighter1.elo)) || isNaN(parseFloat(currentFighter2.elo)));

            // Special handling for "Team A" / "Team B" in Exhibition mode
            const isTeamExhibition = currentMatchMode === 'Exhibition' &&
                                     ((newName1 === 'Team A' && newName2 === 'Team B') ||
                                      (newName1 === 'Team B' && newName2 === 'Team A'));

            if (namesChanged || (needsRefetch && !isFetchingData)) {
                if (namesChanged) {
                    console.log(`SaltyScope: New fighters detected: ${newName1} vs ${newName2}. Resetting data.`);
                    currentFighter1 = { name: newName1, elo: 'Fetching...', tierElo: 'Fetching...', tier: 'N/A' };
                    currentFighter2 = { name: newName2, elo: 'Fetching...', tierElo: 'Fetching...', tier: 'N/A' };
                    currentMatchTier = 'N/A'; // Reset tier until fetched
                } else if (needsRefetch) {
                    console.log(`SaltyScope: Same fighters (${newName1} vs ${newName2}) but need re-fetch (ELO missing/error).`);
                    currentFighter1.elo = 'Fetching...';
                    currentFighter1.tierElo = 'Fetching...';
                    currentFighter2.elo = 'Fetching...';
                    currentFighter2.tierElo = 'Fetching...';
                }

                if (!isFetchingData) {
                    isFetchingData = true;
                    sendFighterInfoToPopup();
                    // If it's a Team Exhibition, directly decide bet without API fetch
                    if (isTeamExhibition) {
                        console.log("SaltyScope: Detected Team Exhibition. Bypassing Salty-Boy API for coin flip.");
                        decideAndPlaceBet(true); // Pass true to indicate coin flip
                    } else {
                        fetchFighterData(newName1, newName2);
                    }
                }
            } else if (newName1 === currentFighter1.name && newName2 === currentFighter2.name && !isFetchingData) {
                // If names are the same, and data is already fetched, just ensure popup is up-to-date
                sendFighterInfoToPopup();
            }
        } else { // No valid fighter names found from any source
            if (currentFighter1.name || currentFighter2.name) {
                console.log("SaltyScope: No fighter names found from any source. Resetting current fighter data.");
                currentFighter1 = { name: null, elo: 'N/A', tierElo: 'N/A', tier: 'N/A' };
                currentFighter2 = { name: null, elo: 'N/A', tierElo: 'N/A', tier: 'N/A' };
                currentMatchTier = 'N/A'; // Clear tier
                sendFighterInfoToPopup();
                saveMatchDataToStorage();
            }
        }
    }

    if (!buttonsFound) {
        // This block handles cases where the betting buttons themselves might not be in the DOM yet.
        // In such scenarios, if we had previous match data, we should clear it and indicate waiting.
        if (isBettingOpen || currentFighter1.name || currentFighter2.name) {
            console.log("SaltyScope: Betting buttons not found, assuming no match or page loading.");
            sendBettingStatusToPopup("Waiting for match...", false);
            currentFighter1 = { name: null, elo: 'N/A', tierElo: 'N/A', tier: 'N/A' };
            currentFighter2 = { name: null, elo: 'N/A', tierElo: 'N/A', tier: 'N/A' };
            currentMatchTier = 'N/A'; // Clear tier
            isBettingOpen = false;
            isFetchingData = false;
            sendFighterInfoToPopup();
        }
    }
}

/**
 * Fetches fighter data (e.g., ELO, Tier ELO) from the API.
 * @param {string} fighterName
 * @returns {Promise<object|null>} A promise that resolves with fighter data or null if not found/error.
 */
async function getFighterDataFromAPI(fighterName) {
    try {
        const encodedFighterName = encodeURIComponent(fighterName);
        const url = `${SALTY_BOY_API_BASE_URL}${encodedFighterName}`;
        console.log(`SaltyScope: Fetching data for: ${fighterName} from ${url}`);
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.results && data.results.length > 0) {
            const fighterData = data.results[0];
            return {
                elo: fighterData.elo || 'N/A',
                tierElo: fighterData.tier_elo || 'N/A',
                tier: fighterData.tier || 'N/A'
            };
        } else {
            console.warn(`SaltyScope: No results found for fighter: ${fighterName}`);
            return null;
        }
    } catch (error) {
        console.error(`SaltyScope: Error fetching data for ${fighterName}:`, error);
        return null;
    }
}

/**
 * Orchestrates fetching data for both fighters and updates global state and popup.
 * @param {string} name1 - Name of fighter 1.
 * @param {string} name2 - Name of fighter 2.
 */
async function fetchFighterData(name1, name2) {
    // Check if the names being fetched are still the current names
    // This prevents updating old match data if a new match started during fetch
    if (name1 !== currentFighter1.name || name2 !== currentFighter2.name) {
        console.log("SaltyScope: Skipping fetch data, new match detected during previous fetch.");
        isFetchingData = false; // Reset flag
        return;
    }

    sendBettingStatusToPopup(`Fetching data for ${name1} and ${name2}...`, isBettingOpen);

    const [data1, data2] = await Promise.all([
        getFighterDataFromAPI(name1),
        getFighterDataFromAPI(name2)
    ]);

    // Ensure we are still working with the same fighters before updating global state
    if (name1 !== currentFighter1.name || name2 !== currentFighter2.name) {
        console.log("SaltyScope: Data fetched, but fighters have changed. Not updating global state.");
        isFetchingData = false; // Reset flag
        return;
    }

    // Update currentFighter1
    if (data1) {
        currentFighter1.elo = data1.elo;
        currentFighter1.tierElo = data1.tierElo;
        currentFighter1.tier = data1.tier;
    } else {
        currentFighter1.elo = 'Not Found';
        currentFighter1.tierElo = 'Not Found';
        currentFighter1.tier = 'N/A';
    }

    // Update currentFighter2
    if (data2) {
        currentFighter2.elo = data2.elo;
        currentFighter2.tierElo = data2.tierElo;
        currentFighter2.tier = data2.tier;
    } else {
        currentFighter2.elo = 'Not Found';
        currentFighter2.tierElo = 'Not Found';
        currentFighter2.tier = 'N/A';
    }

    // Set match tier (assuming both fighters are in the same tier for a given match)
    currentMatchTier = currentFighter1.tier !== 'N/A' ? currentFighter1.tier : (currentFighter2.tier !== 'N/A' ? currentFighter2.tier : 'N/A');
    if (currentMatchTier === 'N/A') {
        console.warn("SaltyScope: Could not determine match tier from fighter data.");
    }


    isFetchingData = false; // Reset flag after fetch completes
    console.log("SaltyScope: Data fetch completed. Sending final fighter info to popup."); // Added log
    // Send updated ELOs and tiers to popup *after* both API calls have completed
    sendFighterInfoToPopup(); // This also saves to storage via sendFighterInfoToPopup's internal call

    if (currentFighter1.elo !== 'Not Found' && currentFighter2.elo !== 'Not Found') {
        sendBettingStatusToPopup("Data fetched. Ready to bet!", isBettingOpen);
        decideAndPlaceBet();
    } else {
        sendBettingStatusToPopup("Could not fetch data for one or both fighters.", isBettingOpen);
    }
}

/**
 * Fetches a random number (1 or 2) from random.org.
 * @returns {Promise<number|null>} A promise that resolves with 1 or 2, or null on error.
 */
async function getRandomCoinFlip() {
    try {
        console.log("SaltyScope: Fetching random number from random.org for coin flip.");
        const response = await fetch(RANDOM_ORG_API_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const randomNumber = parseInt(await response.text(), 10);
        if (!isNaN(randomNumber) && (randomNumber === 1 || randomNumber === 2)) {
            return randomNumber;
        } else {
            console.error("SaltyScope: Invalid response from random.org:", randomNumber);
            return null;
        }
    } catch (error) {
        console.error("SaltyScope: Error fetching random number:", error);
        return null;
    }
}


/**
 * Decides which fighter to bet on and places the bet.
 * This function is called after fighter data is successfully fetched, or directly for coin-flip scenarios.
 * @param {boolean} [forceCoinFlip=false] - If true, forces a coin flip decision, bypassing ELO.
 */
async function decideAndPlaceBet(forceCoinFlip = false) {
    // --- Disabled Betting Mode ---
    if (bettingMode === 'disabled') {
        console.log("SaltyScope: Betting mode is 'Disabled'. Skipping bet.");
        sendBettingStatusToPopup("Betting Disabled.", false); // Should be red, so bettingOpen is false
        return;
    }

    if (!isBettingOpen) {
        console.log("SaltyScope: Betting is not open. Cannot place bet.");
        sendBettingStatusToPopup("Betting Closed. Cannot bet.", false);
        return;
    }

    if (!currentFighter1.name || !currentFighter2.name) {
        console.log("SaltyScope: Fighter names not available. Cannot place bet.");
        sendBettingStatusToPopup("Fighter names incomplete. Cannot bet.", true);
        return;
    }

    const currentBalance = getCurrentBalance();
    if (currentBalance === 0) {
        console.log("SaltyScope: Current balance is 0. Cannot place bet.");
        sendBettingStatusToPopup("Balance is 0. Cannot bet.", true);
        return;
    }

    let betAmount = 0;
    let shouldAllIn = false;
    let winningFighter = null;

    // --- Coin Flip Logic for Team A/Team B in Exhibition (Highest Precedence) ---
    const isTeamExhibition = currentMatchMode === 'Exhibition' &&
                             ((currentFighter1.name === 'Team A' && currentFighter2.name === 'Team B') ||
                              (currentFighter1.name === 'Team B' && currentFighter2.name === 'Team A'));

    if (forceCoinFlip && isTeamExhibition) {
        sendBettingStatusToPopup(`Exhibition Team Match: Flipping coin...`, true);
        const coinResult = await getRandomCoinFlip();
        if (coinResult === 1) {
            winningFighter = currentFighter1;
            console.log("SaltyScope: Coin flip result: Fighter 1 (Team A/B)");
        } else if (coinResult === 2) {
            winningFighter = currentFighter2;
            console.log("SaltyScope: Coin flip result: Fighter 2 (Team A/B)");
        } else {
            console.error("SaltyScope: Failed to get valid coin flip result. Skipping bet.");
            sendBettingStatusToPopup("Coin flip failed. Skipping bet.", true);
            return;
        }
        betAmount = 1; // Default to $1 for coin flip matches
        shouldAllIn = false; // Coin flip overrides all-in logic
        console.log(`SaltyScope: Betting $1 on ${winningFighter.name} (Coin Flip).`);
    } else if (betOneDollarExhibitionMode && currentMatchMode === 'Exhibition') {
        // --- Bet $1 During Exhibition Mode Logic ---
        betAmount = 1; // Always bet $1 for Exhibition mode
        shouldAllIn = false; // This overrides any all-in logic
        console.log(`SaltyScope: Bet $1 During Exhibition Mode is ON. Betting $1.`);
        sendBettingStatusToPopup(`Exhibition $1 Bet: Betting $1!`, true);
    } else if (allInTournamentMode && currentMatchMode === 'Tournament') {
        // --- All-In During Tournament Mode Logic ---
        shouldAllIn = true;
        betAmount = currentBalance;
        console.log(`SaltyScope: All-In During Tournament Mode is ON. Betting ALL IN: $${betAmount}`);
        sendBettingStatusToPopup(`Tournament All-In: Betting ALL IN ($${betAmount})...`, true);
    } else {
        // --- Original All-In Threshold Logic ---
        let thresholdValue = allInThresholdValue;
        if (allInThresholdType === 'percentage') {
            thresholdValue = (allInThresholdValue / 100) * currentBalance;
        }

        if (currentBalance <= thresholdValue) {
            shouldAllIn = true;
            betAmount = currentBalance; // Bet 100% of current balance
            console.log(`SaltyScope: Balance ($${currentBalance}) is below or equal to All-In Threshold ($${thresholdValue.toFixed(2)}). Betting ALL IN: $${betAmount}`);
            sendBettingStatusToPopup(`Balance low! Betting ALL IN ($${betAmount})...`, true);
        }
    }

    // If winningFighter is not determined by coin flip, use ELO/Tier ELO
    if (!winningFighter) {
        if (currentFighter1.elo === 'N/A' || currentFighter2.elo === 'N/A' ||
            currentFighter1.elo === 'Not Found' || currentFighter2.elo === 'Not Found') {
            console.log("SaltyScope: Fighter data incomplete for ELO-based bet. Cannot place bet.");
            sendBettingStatusToPopup("Fighter data incomplete. Cannot bet.", true);
            return;
        }

        let fighter1Stat, fighter2Stat;
        if (bettingMode === 'elo' || bettingMode === 'xp-bet') { // XP Bet also uses ELO for decision
            fighter1Stat = parseFloat(currentFighter1.elo);
            fighter2Stat = parseFloat(currentFighter2.elo);
        } else { // tiered-elo
            fighter1Stat = parseFloat(currentFighter1.tierElo);
            fighter2Stat = parseFloat(currentFighter2.tierElo);
        }

        if (isNaN(fighter1Stat) || isNaN(fighter2Stat)) {
            console.error("SaltyScope: Invalid ELO/Tier ELO values for betting calculation.");
            sendBettingStatusToPopup("Invalid ELOs. Cannot bet.", true);
            return;
        }

        if (fighter1Stat > fighter2Stat) {
            winningFighter = currentFighter1;
        } else if (fighter2Stat > fighter1Stat) {
            winningFighter = currentFighter2;
        } else {
            console.log("SaltyScope: Fighters have equal stats. Skipping bet.");
            sendBettingStatusToPopup("Fighters equal. Skipping bet.", true);
            return;
        }

        // --- Upset Mode Logic ---
        if (upsetMode) {
            console.log("SaltyScope: Upset Mode is ON. Inverting betting decision.");
            winningFighter = (winningFighter === currentFighter1) ? currentFighter2 : currentFighter1;
            sendBettingStatusToPopup(`Upset Mode: Betting on ${winningFighter.name} (the underdog)!`, true);
        }

        // --- XP Bet Logic (if not already set by Exhibition or All-In) ---
        if (bettingMode === 'xp-bet' && betAmount === 0) { // Only apply if betAmount hasn't been set by Exhibition or All-In
            betAmount = 1; // Always bet $1 for XP mode
            console.log("SaltyScope: XP Bet mode active. Betting $1.");
            shouldAllIn = false; // XP bet overrides all-in logic
        } else if (!shouldAllIn && betAmount === 0) { // Only calculate confidence-based bet if not going all-in and not already set
            // --- NEW CONFIDENCE ALGORITHM (ELO-based) ---
            // Calculate expected win probability for fighter1 based on ELO difference
            const eloDifference = fighter1Stat - fighter2Stat;
            const expectedWinProbFighter1 = 1 / (1 + Math.pow(10, (-eloDifference / 400)));
            const expectedWinProbFighter2 = 1 - expectedWinProbFighter1; // Probability for fighter 2

            // Confidence is the absolute difference in win probabilities
            const confidence = Math.abs(expectedWinProbFighter1 - expectedWinProbFighter2);
            console.log(`SaltyScope: ELO Difference: ${eloDifference}, Expected Win Prob (F1): ${expectedWinProbFighter1.toFixed(3)}, Confidence: ${confidence.toFixed(3)}`);

            if (maxBetType === 'percentage') {
                betAmount = Math.round((maxBetValue / 100) * currentBalance * confidence);
                console.log(`SaltyScope: Calculated bet amount: ${maxBetValue}% of balance ($${currentBalance}) * confidence (${confidence.toFixed(3)}) = $${betAmount}`);
            } else { // dollar
                betAmount = Math.round(maxBetValue * confidence);
                console.log(`SaltyScope: Calculated bet amount: $${maxBetValue} * confidence (${confidence.toFixed(3)}) = $${betAmount}`);
            }
        }
    }


    // Ensure betAmount is at least 1, as SaltyBet requires a minimum bet.
    betAmount = Math.max(1, betAmount);
    // Ensure betAmount does not exceed current balance
    betAmount = Math.min(betAmount, currentBalance);

    console.log(`SaltyScope: Final bet amount: ${betAmount} on ${winningFighter.name}`);
    sendBettingStatusToPopup(`Betting ${betAmount} on ${winningFighter.name}!`, true);

    // --- Interact with the page to place the bet ---
    const wagerInput = document.querySelector(WAGER_INPUT_SELECTOR);
    const betButton = (winningFighter === currentFighter1) ?
                      document.querySelector(BETTING_BUTTON_SELECTOR_1) :
                      document.querySelector(BETTING_BUTTON_SELECTOR_2);

    if (wagerInput && betButton) {
        wagerInput.value = betAmount; // Set the bet amount
        console.log(`SaltyScope: Set wager input to: ${betAmount}`);

        // Simulate a click event on the button
        const clickEvent = new MouseEvent('click', {
            view: window,
            bubbles: true,
            cancelable: true
        });
        betButton.dispatchEvent(clickEvent);
        console.log(`SaltyScope: Clicked bet button for ${winningFighter.name}.`);
        sendBettingStatusToPopup(`Bet placed: ${betAmount} on ${winningFighter.name}!`, true);

        // Optionally, disable further betting until next match
        isBettingOpen = false; // Assume bet placed, wait for next match cycle
        saveMatchDataToStorage(); // Save updated state
    } else {
        console.error("SaltyScope: Could not find wager input or bet button to place bet.");
        sendBettingStatusToPopup("Error placing bet: UI elements not found.", true);
    }
}


/**
 * Main function to initiate observation and process fighter names.
 */
function startObservingBettingPage() {
    // Load betting preferences immediately on startup
    loadBettingPrefsFromStorage();

    const targetNode = document.querySelector(TARGET_ELEMENT_FOR_OBSERVER_SELECTOR);

    if (!targetNode) {
        console.error(`SaltyScope: Target element for observer not found: ${TARGET_ELEMENT_FOR_OBSERVER_SELECTOR}`);
        console.error("Please inspect the webpage and update TARGET_ELEMENT_FOR_OBSERVER_SELECTOR in content.js if 'body' is not sufficient.");
        return;
    }

    // Options for the observer (which changes to look for)
    const config = { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'value', 'class'], characterData: true };

    // Callback function to execute when mutations are observed
    const callback = (mutationsList, observer) => {
        let relevantChangeDetected = false;
        for (const mutation of mutationsList) {
            // Check for changes on betting buttons (disabled state or value)
            if (mutation.type === 'attributes' &&
                (mutation.target.matches(BETTING_BUTTON_SELECTOR_1) || mutation.target.matches(BETTING_BUTTON_SELECTOR_2))) {
                relevantChangeDetected = true;
                break;
            }
            // Check for added/removed nodes that match betting buttons or footer alert
            if (mutation.type === 'childList' && (
                Array.from(mutation.addedNodes).some(node => node.matches && (node.matches(BETTING_BUTTON_SELECTOR_1) || node.matches(BETTING_BUTTON_SELECTOR_2) || node.matches(FOOTER_ALERT_SELECTOR))) ||
                Array.from(mutation.removedNodes).some(node => node.matches && (node.matches(BETTING_BUTTON_SELECTOR_1) || node.matches(BETTING_BUTTON_SELECTOR_2) || node.matches(FOOTER_ALERT_SELECTOR)))
            )) {
                relevantChangeDetected = true;
                break;
            }
            // Check for text content changes in the footer alert (for mode detection)
            if (mutation.type === 'characterData' && mutation.target.parentNode && mutation.target.parentNode.matches(FOOTER_ALERT_SELECTOR)) {
                relevantChangeDetected = true;
                break;
            }
        }

        if (relevantChangeDetected) {
            console.log("SaltyScope: Relevant DOM change detected. Re-evaluating betting state and fighters.");
            extractFighterNamesAndBettingStatus(); // This will handle sending updates to popup and triggering API calls
        }
    };

    // Create an observer instance linked to the callback function
    const observer = new MutationObserver(callback);

    // Start observing the target node for configured mutations
    observer.observe(targetNode, config);

    console.log(`SaltyScope: Started observing for changes on element: ${TARGET_ELEMENT_FOR_OBSERVER_SELECTOR}`);
}

/**
 * Waits for a specific DOM element to have non-empty text content.
 * @param {string} selector - The CSS selector for the element.
 * @param {number} maxAttempts - Maximum number of attempts.
 * @param {number} interval - Interval between attempts in ms.
 * @returns {Promise<boolean>} Resolves true if content found, false otherwise.
 */
function waitForElementAndContent(selector, maxAttempts = 50, interval = 100) {
    return new Promise((resolve) => {
        let attempts = 0;
        const checkInterval = setInterval(() => {
            const element = document.querySelector(selector);
            // For input elements, check .value. For others, check .textContent.
            const content = element ? (element.tagName === 'INPUT' ? element.value : element.textContent) : '';

            if (element && content.trim() !== '') {
                clearInterval(checkInterval);
                resolve(true);
            } else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                resolve(false);
            }
            attempts++;
        }, interval);
    });
}


// --- Initial Script Execution ---
// This function will be called immediately when the content script is injected.
// It tries to find the betting buttons and extract fighter names.
async function initializeAndObserve() {
    if (document.body.dataset.saltyScopeInitialized) {
        console.log("SaltyScope: Content script already initialized. Skipping.");
        return;
    }
    document.body.dataset.saltyScopeInitialized = 'true';
    console.log("SaltyScope: Initializing content script and starting initial checks.");

    loadBettingPrefsFromStorage(); // Load preferences first

    // Wait for EITHER the betting buttons to have values OR the odds span to have content
    const [buttonsReady, oddsSpanReady] = await Promise.all([
        waitForElementAndContent(BETTING_BUTTON_SELECTOR_1, 50, 100), // Check P1 button value
        waitForElementAndContent(ODDS_SPAN_SELECTOR, 50, 100)        // Check odds span text content
    ]);

    if (buttonsReady || oddsSpanReady) {
        console.log("SaltyScope: Initial fighter info elements found. Extracting initial fighter info.");
        extractFighterNamesAndBettingStatus();
    } else {
        console.warn("SaltyScope: Neither buttons nor odds span populated within timeout. Relying on MutationObserver for initial data.");
    }

    // Start the MutationObserver to listen for subsequent changes.
    startObservingBettingPage();
}

// --- Listen for messages from popup.js ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("SaltyScope Content Script: Received message from popup:", request.type);
    if (request.type === "REQUEST_FIGHTER_INFO") {
        // When popup requests info, send the current state
        sendFighterInfoToPopup();
        sendResponse({ status: "info_sent" });
    } else if (request.type === "UPDATE_BETTING_PREFS") {
        console.log(`SaltyScope: Betting preferences updated from popup.`);
        bettingMode = request.bettingMode;
        maxBetValue = request.maxBetValue;
        maxBetType = request.maxBetType;
        allInThresholdValue = request.allInThresholdValue;
        allInThresholdType = request.allInThresholdType;
        upsetMode = request.upsetMode;
        allInTournamentMode = request.allInTournamentMode;
        betOneDollarExhibitionMode = request.betOneDollarExhibitionMode;
        saveBettingPrefsToStorage(); // Save updated preferences
        sendResponse({ status: "prefs_updated" });
    } else if (request.type === "REBET") {
        console.log("SaltyScope Content Script: REBET command received. Attempting to re-process bet.");
        decideAndPlaceBet(); // Re-run the betting logic
        sendResponse({ status: "rebet_attempted" });
    }
    return true; // Indicate that you will send a response asynchronously.
});

// Execute the initialization function immediately when the script loads
initializeAndObserve();
