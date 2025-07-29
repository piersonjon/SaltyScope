// popup.js
// This script runs when the extension popup is opened.

document.addEventListener('DOMContentLoaded', () => {
    const fighter1NameElem = document.querySelector('#fighter1Info .fighter-name');
    const fighter1EloDisplayElem = document.querySelector('#fighter1Info .fighter-elo-display');

    const fighter2NameElem = document.querySelector('#fighter2Info .fighter-name');
    const fighter2EloDisplayElem = document.querySelector('#fighter2Info .fighter-elo-display');

    const matchTierElem = document.getElementById('matchTier');
    const matchModeElem = document.getElementById('matchMode');

    const bettingStatusElem = document.getElementById('bettingStatus');
    const bettingModeSelect = document.getElementById('bettingMode');
    const maxBetValueInput = document.getElementById('maxBetValue');
    const maxBetTypeSelect = document.getElementById('maxBetType');
    const allInThresholdValueInput = document.getElementById('allInThresholdValue');
    const allInThresholdTypeSelect = document.getElementById('allInThresholdType');
    const upsetModeCheckbox = document.getElementById('upsetModeCheckbox');
    const rebetButton = document.getElementById('rebetButton');
    const allInTournamentModeCheckbox = document.getElementById('allInTournamentModeCheckbox');
    const betOneDollarExhibitionModeCheckbox = document.getElementById('betOneDollarExhibitionModeCheckbox'); // New

    console.log("SaltyScope Popup: DOM loaded.");

    /**
     * Updates the popup UI with provided fighter and betting status information.
     * @param {object} fighter1 - Fighter 1 data.
     * @param {object} fighter2 - Fighter 2 data.
     * @param {boolean} bettingOpen - Current betting status.
     * @param {string} [statusMessage] - Optional status message to display.
     * @param {string} [matchTier] - Current match tier.
     * @param {string} [matchMode] - Current match mode (Matchmaking, Tournament, Exhibition).
     */
    function updatePopupUI(fighter1, fighter2, bettingOpen, statusMessage, matchTier, matchMode) {
        console.log("SaltyScope Popup: updatePopupUI called with:", { fighter1, fighter2, bettingOpen, statusMessage, matchTier, matchMode });

        // --- Update Fighter 1 Info ---
        if (fighter1NameElem) fighter1NameElem.textContent = `Fighter 1: ${fighter1.name || 'N/A'}`;
        if (fighter1EloDisplayElem) fighter1EloDisplayElem.textContent = `ELO: ${fighter1.elo || 'N/A'} | Tier ELO: ${fighter1.tierElo || 'N/A'}`;
        else console.warn("SaltyScope Popup: Fighter 1 elements not found in DOM.");

        // --- Update Fighter 2 Info ---
        if (fighter2NameElem) fighter2NameElem.textContent = `Fighter 2: ${fighter2.name || 'N/A'}`;
        if (fighter2EloDisplayElem) fighter2EloDisplayElem.textContent = `ELO: ${fighter2.elo || 'N/A'} | Tier ELO: ${fighter2.tierElo || 'N/A'}`;
        else console.warn("SaltyScope Popup: Fighter 2 elements not found in DOM.");

        // --- Update Match Tier and Mode ---
        if (matchTierElem) matchTierElem.textContent = matchTier || 'N/A';
        if (matchModeElem) matchModeElem.textContent = matchMode || 'N/A';

        // --- Update Betting Status ---
        if (bettingStatusElem) {
            bettingStatusElem.textContent = statusMessage || (bettingOpen ? "Betting Open!" : "Betting Closed.");
            bettingStatusElem.style.color = bettingOpen ? '#27ae60' : '#e74c3c';
        } else {
            console.warn("SaltyScope Popup: Betting status element not found in DOM.");
        }

        // Clear fighter info if betting closed or waiting for match and names are null
        if (!bettingOpen && (!fighter1.name || !fighter2.name)) {
            if (fighter1NameElem) fighter1NameElem.textContent = `Fighter 1: N/A`;
            if (fighter1EloDisplayElem) fighter1EloDisplayElem.textContent = `ELO: N/A | Tier ELO: N/A`;

            if (fighter2NameElem) fighter2NameElem.textContent = `Fighter 2: N/A`;
            if (fighter2EloDisplayElem) fighter2EloDisplayElem.textContent = `ELO: N/A | Tier ELO: N/A`;

            // Clear match tier and mode too
            if (matchTierElem) matchTierElem.textContent = 'N/A';
            if (matchModeElem) matchModeElem.textContent = 'N/A';
        }
    }

    // Load saved preferences
    chrome.storage.local.get([
        'bettingMode', 'maxBetValue', 'maxBetType',
        'allInThresholdValue', 'allInThresholdType', 'upsetMode', 'allInTournamentMode', 'betOneDollarExhibitionMode', // New key
        'saltyScopeFighter1', 'saltyScopeFighter2', 'saltyScopeIsBettingOpen', 'saltyScopeLastStatusMessage',
        'saltyScopeMatchMode', 'saltyScopeMatchTier'
    ], (result) => {
        console.log("SaltyScope Popup: Loaded preferences from storage:", result);
        if (bettingModeSelect) {
            bettingModeSelect.value = result.bettingMode || 'elo';
            console.log(`SaltyScope Popup: Loaded bettingMode from storage: ${bettingModeSelect.value}`);
        } else {
            console.warn("SaltyScope Popup: Betting mode select element not found in DOM.");
        }

        // Load Max Bet config
        if (maxBetValueInput) {
            maxBetValueInput.value = result.maxBetValue !== undefined ? result.maxBetValue : 100;
            console.log(`SaltyScope Popup: Loaded maxBetValue from storage: ${maxBetValueInput.value}`);
        } else {
            console.warn("SaltyScope Popup: Max Bet Value input element not found in DOM.");
        }
        if (maxBetTypeSelect) {
            maxBetTypeSelect.value = result.maxBetType || 'percentage';
            console.log(`SaltyScope Popup: Loaded maxBetType from storage: ${maxBetTypeSelect.value}`);
        } else {
            console.warn("SaltyScope Popup: Max Bet Type select element not found in DOM.");
        }

        // Load All-In Threshold config
        if (allInThresholdValueInput) {
            allInThresholdValueInput.value = result.allInThresholdValue !== undefined ? result.allInThresholdValue : 1000;
            console.log(`SaltyScope Popup: Loaded allInThresholdValue from storage: ${allInThresholdValueInput.value}`);
        } else {
            console.warn("SaltyScope Popup: All-In Threshold Value input element not found in DOM.");
        }
        if (allInThresholdTypeSelect) {
            allInThresholdTypeSelect.value = result.allInThresholdType || 'dollar';
            console.log(`SaltyScope Popup: Loaded allInThresholdType from storage: ${allInThresholdTypeSelect.value}`);
        } else {
            console.warn("SaltyScope Popup: All-In Threshold Type select element not found in DOM.");
        }

        // Load Upset Mode config
        if (upsetModeCheckbox) {
            upsetModeCheckbox.checked = result.upsetMode || false;
            console.log(`SaltyScope Popup: Loaded upsetMode from storage: ${upsetModeCheckbox.checked}`);
        } else {
            console.warn("SaltyScope Popup: Upset Mode checkbox element not found in DOM.");
        }

        // Load All-In Tournament Mode config
        if (allInTournamentModeCheckbox) {
            allInTournamentModeCheckbox.checked = result.allInTournamentMode || false;
            console.log(`SaltyScope Popup: Loaded allInTournamentMode from storage: ${allInTournamentModeCheckbox.checked}`);
        } else {
            console.warn("SaltyScope Popup: All-In Tournament Mode checkbox element not found in DOM.");
        }

        // Load Bet $1 During Exhibition Mode config (New)
        if (betOneDollarExhibitionModeCheckbox) {
            betOneDollarExhibitionModeCheckbox.checked = result.betOneDollarExhibitionMode || false;
            console.log(`SaltyScope Popup: Loaded betOneDollarExhibitionMode from storage: ${betOneDollarExhibitionModeCheckbox.checked}`);
        } else {
            console.warn("SaltyScope Popup: Bet $1 During Exhibition Mode checkbox element not found in DOM.");
        }

        // Display saved match data immediately
        if (result.saltyScopeFighter1 && result.saltyScopeFighter2) {
            console.log("SaltyScope Popup: Loading match data from storage.");
            updatePopupUI(
                result.saltyScopeFighter1,
                result.saltyScopeFighter2,
                result.saltyScopeIsBettingOpen || false,
                result.saltyScopeLastStatusMessage || (result.saltyScopeIsBettingOpen ? "Betting Open (from storage)" : "Betting Closed (from storage)"),
                result.saltyScopeMatchTier,
                result.saltyScopeMatchMode
            );
        } else {
            console.log("SaltyScope Popup: No match data found in storage.");
            if (bettingStatusElem) {
                bettingStatusElem.textContent = "Waiting for match...";
                bettingStatusElem.style.color = '#7f8c8d';
            }
        }

        // Request initial fighter info from content.js after loading from storage
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0]) {
                console.log("SaltyScope Popup: Requesting initial fighter info from content script.");
                chrome.tabs.sendMessage(tabs[0].id, { type: "REQUEST_FIGHTER_INFO" })
                .then(response => console.log("SaltyScope Popup: Content script responded to initial request:", response))
                .catch(error => console.error("SaltyScope Popup: Error requesting initial fighter info:", error));
            }
        });
    });

    // Save preferences when changed and send to content script
    const saveAndSendPrefs = () => {
        const selectedMode = bettingModeSelect ? bettingModeSelect.value : 'elo';
        const maxBet = maxBetValueInput ? parseFloat(maxBetValueInput.value) : 100;
        const maxBetType = maxBetTypeSelect ? maxBetTypeSelect.value : 'percentage';
        const allInThreshold = allInThresholdValueInput ? parseFloat(allInThresholdValueInput.value) : 1000;
        const allInThresholdType = allInThresholdTypeSelect ? allInThresholdTypeSelect.value : 'dollar';
        const upsetMode = upsetModeCheckbox ? upsetModeCheckbox.checked : false;
        const allInTournamentMode = allInTournamentModeCheckbox ? allInTournamentModeCheckbox.checked : false;
        const betOneDollarExhibitionMode = betOneDollarExhibitionModeCheckbox ? betOneDollarExhibitionModeCheckbox.checked : false; // New

        chrome.storage.local.set({
            bettingMode: selectedMode,
            maxBetValue: isNaN(maxBet) ? 100 : maxBet,
            maxBetType: maxBetType,
            allInThresholdValue: isNaN(allInThreshold) ? 1000 : allInThreshold,
            allInThresholdType: allInThresholdType,
            upsetMode: upsetMode,
            allInTournamentMode: allInTournamentMode,
            betOneDollarExhibitionMode: betOneDollarExhibitionMode // New
        }, () => {
            if (chrome.runtime.lastError) {
                console.error("SaltyScope Popup: Error saving preferences:", chrome.runtime.lastError);
                return;
            }
            console.log(`SaltyScope Popup: Preferences saved: Mode=${selectedMode}, MaxBet=${maxBet}, Type=${maxBetType}, AllInThreshold=${allInThreshold}, AllInType=${allInThresholdType}, UpsetMode=${upsetMode}, AllInTournamentMode=${allInTournamentMode}, BetOneDollarExhibitionMode=${betOneDollarExhibitionMode}`);
            chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                if (tabs[0]) {
                    console.log("SaltyScope Popup: Sending UPDATE_BETTING_PREFS message to content script.");
                    chrome.tabs.sendMessage(tabs[0].id, {
                        type: "UPDATE_BETTING_PREFS",
                        bettingMode: selectedMode,
                        maxBetValue: isNaN(maxBet) ? 100 : maxBet,
                        maxBetType: maxBetType,
                        allInThresholdValue: isNaN(allInThreshold) ? 1000 : allInThreshold,
                        allInThresholdType: allInThresholdType,
                        upsetMode: upsetMode,
                        allInTournamentMode: allInTournamentMode,
                        betOneDollarExhibitionMode: betOneDollarExhibitionMode // New
                    })
                    .then(response => console.log("SaltyScope Popup: Content script responded to prefs update:", response))
                    .catch(error => console.error("SaltyScope Popup: Error sending prefs update message:", error));
                }
            });
        });
    };

    if (bettingModeSelect) bettingModeSelect.addEventListener('change', saveAndSendPrefs);
    if (maxBetValueInput) maxBetValueInput.addEventListener('change', saveAndSendPrefs);
    if (maxBetTypeSelect) maxBetTypeSelect.addEventListener('change', saveAndSendPrefs);
    if (allInThresholdValueInput) allInThresholdValueInput.addEventListener('change', saveAndSendPrefs);
    if (allInThresholdTypeSelect) allInThresholdTypeSelect.addEventListener('change', saveAndSendPrefs);
    if (upsetModeCheckbox) upsetModeCheckbox.addEventListener('change', saveAndSendPrefs);
    if (allInTournamentModeCheckbox) allInTournamentModeCheckbox.addEventListener('change', saveAndSendPrefs);
    if (betOneDollarExhibitionModeCheckbox) betOneDollarExhibitionModeCheckbox.addEventListener('change', saveAndSendPrefs); // New listener

    // Re-Bet Button Listener
    if (rebetButton) {
        rebetButton.addEventListener('click', () => {
            console.log("SaltyScope Popup: Re-Bet button clicked. Sending REBET message to content script.");
            chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, { type: "REBET" })
                    .then(response => console.log("SaltyScope Popup: Content script responded to REBET:", response))
                    .catch(error => console.error("SaltyScope Popup: Error sending REBET message:", error));
                }
            });
        });
    }

    // Listen for messages from content.js
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log("SaltyScope Popup: Message received from content script:", request);
        if (request.type === "UPDATE_FIGHTER_INFO") {
            console.log("SaltyScope Popup: Updating fighter info in UI from live data.");
            console.log("SaltyScope Popup: Received Fighter 1 data:", request.fighter1);
            console.log("SaltyScope Popup: Received Fighter 2 data:", request.fighter2);
            updatePopupUI(request.fighter1, request.fighter2, request.bettingOpen, request.statusMessage, request.matchTier, request.matchMode);
        } else if (request.type === "BETTING_STATUS_UPDATE") {
            console.log("SaltyScope Popup: Updating betting status in UI from live data.");
            if (bettingStatusElem) {
                bettingStatusElem.textContent = request.message;
                bettingStatusElem.style.color = request.bettingOpen ? '#27ae60' : '#e74c3c';
            }
            if (!request.bettingOpen && request.message.includes("Waiting for match")) {
                 updatePopupUI(
                    { name: null, elo: 'N/A', tierElo: 'N/A', tier: 'N/A' },
                    { name: null, elo: 'N/A', tierElo: 'N/A', tier: 'N/A' },
                    false,
                    request.message,
                    'N/A',
                    'N/A'
                );
            }
        }
        sendResponse({ status: "message_received", timestamp: Date.now() });
    });
});
