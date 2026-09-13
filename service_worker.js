/* eslint-disable no-prototype-builtins */
/* eslint-disable no-undef */
// ^ Above are some defaults for eslinter for easier debugging, can be ignored.
/* 
    service_worker.js
    Main JS file for the extension, runs as a background asynchronous script page during browsing.
    Whenever it is activated via a listener, the functions below execute, capturing link traversal
    across all websites, executing interventions on select websites, and collecting links on select websites
    as executed by the backend server the extension communicates with.
*/
"use strict";




/* 
    DEBUG PARAMETERS
    Note: These are just some simple flags / helper functions in debugging. Feel free to change / remove, etc.
    ALSO, here are some helpful reference pages for some stuff that was helpful during development:
        Template Literals - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals
        CORS Policy - https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
        Checking Browser Compatibility - https://caniuse.com/
        Chrome Developer Home - https://developer.chrome.com/docs/extensions/
        Manifest v3 - https://developer.chrome.com/docs/extensions/mv3/intro/
*/
// Base URL to point to the server, configured centrally in config.js.
importScripts('config.js');

// For Debugging, should be false for production release error printing.
// DEBUG: true
// PRODUCTION: false
const PRINT_DEBUG = false;

// Log wrapper for debugging
// Note: pass in item as the text to print, and ln for line number, default ? if not passed
function log(item) {
    if (PRINT_DEBUG) {
        console.log(item);
    }
}

// Listener function that  returns the values of the flags to any running content scripts.
// Relevant Docs: https://developer.chrome.com/docs/extensions/mv3/messaging/
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if ('getDebugParams' in req) {
        log(`Debug parameters requested by Tab ${sender.tab.id} (${sender.tab.url})!`);
        sendResponse({
            SERVER_URL: SERVER_URL,
            PRINT_DEBUG: PRINT_DEBUG
        });
    }
});




/* 
    UTILITY FUNCTIONS:
*/
// Wrapper function for doing POST fetch requests and retrieving JSON.
// Relevant Docs:   https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
function post(endpoint, data, callback_func) {
    log(data);
    fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    }).then(r => {
        if (!r.ok) {
            log('Error in POST');
            log(r);
            throw new Error('Network response failed');
        } else {
            return r.json();
        }
    }).then(res => {
        log('Response data:');
        log(res);
        if (callback_func) {
            callback_func(res);
        }
    }).catch(err => {
        log('ERROR');
        log(err);
    });
}




/* 
   OFFBOARD USER FUNCTION
*/
function checkOffboardUser(r) {
    // If the OFFBOARD_USER flag is set and has been sent, remove their participant id, ending their enrollment
    if ('OFFBOARD_USER' in r) {
        log('OFFBOARD_USER flag present, ending user data collection!');
        chrome.storage.local.remove('ParticipantId');
        chrome.storage.local.set({
            UserOffboarded: true
        });
    }
}




/*
    ALERT MANAGEMENT FUNCTIONS
*/
// Set Badge Alert (yellow, !)
// See: https://developer.chrome.com/docs/extensions/reference/action/
function setBadgeAlert() {
    chrome.action.setBadgeBackgroundColor({
        color: '#fefe22'
    });
    chrome.action.setBadgeText({
        text: '!'
    });
}

// Clear Badge Alert (clear, no text)
// See: https://developer.chrome.com/docs/extensions/reference/action/
function clearBadgeAlert() {
    chrome.action.setBadgeBackgroundColor({
        color: 'white'
    });
    chrome.action.setBadgeText({
        text: ''
    });
}

/*
    Timed server updates listener function:
    Get Participant Alerts & Messages from server update, set badge alert if updated, can add other behavior as needed.
    NOTE: Also has a switch that allows offboarding of users, if OFFBOARD_USER switch present in response.
    See the docs: 
        https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
        https://developer.chrome.com/docs/extensions/reference/storage/

*/
function getServerUpdate() {
    // Only call if registered participant
    chrome.storage.local.get(['ParticipantId', 'UserOffboarded'], items => {
        log('Checking server for update...');
        if ('ParticipantId' in items) {
            const updateEndpoint = `${SERVER_URL}/extension/update/`;
            post(updateEndpoint, {
                ParticipantId: items.ParticipantId
            }, r => {
                chrome.storage.local.set({
                    ParticipantAlert: r.ParticipantAlert,
                    ParticipantAlertMessage: r.ParticipantAlertMessage,
                    ParticipantAlertUrl: r.ParticipantAlertUrl
                });
                // If there is an alert, set the badge. Otherwise, clear the badge in case it is not clear.
                if (r.ParticipantAlert) {
                    setBadgeAlert();
                } else {
                    clearBadgeAlert();
                }
                // Call and checkOffboardUser
                checkOffboardUser(r);
                // If check true visibility is set, run the more expensive truly visible links check for intersection observers
                if ('COLLECT_LINKS_TRUE_VISIBILITY' in r) {
                    log('COLLECT_LINKS_TRUE_VISIBILITY flag present, sets collect links flag!');
                    chrome.storage.local.set({
                        CollectLinksTrueVisibility: true
                    });
                } else {
                    chrome.storage.local.set({
                        CollectLinksTrueVisibility: false
                    });
                }
            });
        } else if ('UserOffboarded' in items) {
            clearBadgeAlert();
        } else {
            setBadgeAlert();
        }
    });
}

// Now register a Chrome Alarm to check for updates every 10 minutes.
// https://developer.chrome.com/docs/extensions/reference/alarms/
chrome.alarms.create('getServerUpdateAlarm', {
    periodInMinutes: 10
});

// On the alarm, call the get server update function.
chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name == 'getServerUpdateAlarm') {
        getServerUpdate(); 
    }
});




/*
    URL RECORD MANAGEMENT FUNCTIONS
*/
/*
    Function that sends a new URL record to the backend, only if ParticipantId set.
    Takes a record object parameter, with the components: 
        {url: 'url', currTabId: int tabId, prevTabId: 'prevTabId' | false, transition: 'transition'}
    See the following documentation for more info:
        https://developer.chrome.com/docs/extensions/reference/storage/
*/
function postNewUrl(record) {
    // Array of requests for storage api
    let storage_items = ['ParticipantId'];
    // If the record is part of an old link chain, then get the previous tab record
    if (record.prevTabId) {
        storage_items.push(`TabRecord${record.prevTabId}`);
    }

    // Now actually request all of key values from storage api
    chrome.storage.local.get(storage_items, items => {
        // Only continue if participant registered
        if ('ParticipantId' in items) {
            // If registered add id to data and prev record id if applicable
            record.ParticipantId = items.ParticipantId;
            if (record.prevTabId && `TabRecord${record.prevTabId}` in items) {
                record.previousRecord = items[`TabRecord${record.prevTabId}`].recordId;
            } else {
                record.previousRecord = false;
            }

            // Log new record and post it to the backend
            log('NEW RECORD POST');
            const newRecordUrlPoint = `${SERVER_URL}/extension/start-url/`;
            post(newRecordUrlPoint, record, res => {
                const newTabKey = `TabRecord${record.currTabId}`;
                let newRecord = {
                    [newTabKey]: {
                        prevTabId: record.prevTabId,
                        tabId: record.currTabId,
                        ParticipantId: items.ParticipantId,
                        url: record.url,
                        transition: record.transition,
                        recordId: res.recordId,
                    }
                };
                log('WRITING NEW RECORD');
                log(newRecord);
                chrome.storage.local.set(newRecord);
                
                // Send a message to the tabs indicating that the record is updated.
                chrome.storage.local.get(['ParticipantId', `${newTabKey}`], items => {
                    chrome.tabs.sendMessage(record.currTabId, {
                        ParticipantId: items.ParticipantId,
                        TabRecord: items[`${newTabKey}`]
                    });
                });
            });
        }
    });
}

/*
    Function that closes a previous URL record to the backend, only if ParticipantId set.
    Takes a record object parameter, with the components: 
        {url: 'url', currTabId: int tabId, prevTabId: 'prevTabId' | false, transition: 'transition'}
    See the following documentation for more info:
        https://developer.chrome.com/docs/extensions/reference/storage/
*/
function runCloseOldUrl(tabId) {
    // Get the tab key
    let tabKey = `TabRecord${tabId}`;
    // Only post data, don't remove the record
    chrome.storage.local.get(['ParticipantId', tabKey], items => {
        if ('ParticipantId' in items && tabKey in items && 'recordId' in items[tabKey]) {
            let record = {
                ParticipantId: items.ParticipantId,
                recordId: items[tabKey].recordId,
            }
            const endpoint = `${SERVER_URL}/extension/end-url/`;
            post(endpoint, record, () => {
                log('-----------------------------------------');
                log('Record Close Old URL!')
                log('-----------------------------------------');
            });
        }
    });
}

/*
    Listener for chrome.tabs.onUpdated:
    Called when a tab updates its URL. This happens both when a new web navigation happens (hence
    adding tabUpdate alongside webNav for the record), and also on websites that use clientside logic or
    javascript to adjust the URL in the window, since the URL changes, in which case this is also recorded.
    For more, see:  https://developer.chrome.com/docs/extensions/reference/tabs/
                    https://developer.chrome.com/docs/extensions/reference/history/
                    https://developer.chrome.com/docs/extensions/reference/storage/
*/
function newUrlListener(tabId, changeInfo, tab) {
    // First, check if the tab actually changed URLs
    if ('url' in changeInfo) {

        // Run the close old URL check
        runCloseOldUrl(tabId);

        // If so, use history API to grab the record for the last visit to that URL and parse URL
        chrome.history.getVisits({
            url: changeInfo.url
        }, allVisits => {
            let parsedUrl = new URL(changeInfo.url);
            const lastVisit = allVisits.pop();

            // There are now a couple cases
            // 1) We're on a chrome URL or new tab page, this is the same as starting a new link chain
            if (parsedUrl.protocol.includes('chrome')) {
                log('-----------------------------------------');
                log('Chrome URL / New Tab Page: New Link Chain');
                postNewUrl({
                    url: parsedUrl.href,
                    transition: 'auto_toplevel',
                    currTabId: tabId,
                    prevTabId: false
                });
                log('-----------------------------------------');
            }
            // 2) You click a link (transitionType == 'link'). Next step is try to retrieve the record for the current tabId.
            else if (lastVisit.transition == 'link') {
                chrome.storage.local.get([`TabRecord${tabId}`], items => {
                    // 2a) If tab doesn't have previous record and referringVisitId == 0 and openerTabId in tab
                    // then new link opened in a new tab from a previous tab given by openerTabId, and continues that chain
                    if (!(`TabRecord${tabId}` in items) && lastVisit.referringVisitId == 0 && 'openerTabId' in tab) {
                        log('-----------------------------------------');
                        log('Link navigation, referringVisitId is 0 and no TabRecord exists: Ongoing link chain');
                        postNewUrl({
                            url: parsedUrl.href,
                            transition: lastVisit.transition,
                            currTabId: tabId,
                            prevTabId: tab.openerTabId
                        });
                        log('-----------------------------------------');
                    }
                    // 2b) If tab fails in any of the above cases, just treat this as continuing the chain with current tab
                    else {
                        log('-----------------------------------------');
                        log('Link navigation, continues current tab chain: Ongoing link chain');
                        postNewUrl({
                            url: parsedUrl.href,
                            transition: 'auto_toplevel',
                            currTabId: tabId,
                            prevTabId: tabId
                        });
                        log('-----------------------------------------');
                    }
                });
            }
            // 3) Some other non link navigation happened.
            else {
                log('-----------------------------------------');
                log('Non link navigation: New Link Chain');
                postNewUrl({
                    url: parsedUrl.href,
                    transition: 'auto_toplevel',
                    currTabId: tabId,
                    prevTabId: false
                });
                log('-----------------------------------------');
            }
        });
    }
}

// Register the listener for new URL visits
// See https://developer.chrome.com/docs/extensions/reference/tabs/
chrome.tabs.onUpdated.addListener(newUrlListener);

/* 
    Function that takes a specific tab and URL record, and then sends a signal to the backend confirming that
    the user's time on this website has ended. A helper function called every time there is a new navigation, unless
    it starts from scratch (i.e. a new tab).
    For more, see:
        https://developer.chrome.com/docs/extensions/reference/tabs/
        https://developer.chrome.com/docs/extensions/reference/storage/
*/
function closeTabRecord(tabId, callback_func) {
    // Retrieve the record, confirm it's there, and then delete the record.
    let tabKey = `TabRecord${tabId}`;
    chrome.storage.local.get(['ParticipantId', tabKey], items => {
        if ('ParticipantId' in items) {
            let record = {
                ParticipantId: items.ParticipantId,
                recordId: items[tabKey].recordId,
            }
            const endRecordEndpoint = `${SERVER_URL}/extension/end-url/`;
            post(endRecordEndpoint, record, callback_func);
        }
    });
}

/*
    Listener for chrome.tabs.onRemoved:
    Called when a tab is closed to clean up its chrome.storage.local record and send the study web app a post notification
    indicating the time at which browsing on the current tab stopped (based on the closing of the tab).
    For more, see:  
        https://developer.chrome.com/docs/extensions/reference/tabs/
        https://developer.chrome.com/docs/extensions/reference/storage/
*/
function closeTabUrlListener(tabId, removeInfo) {
    closeTabRecord(tabId, () => {
        log('-----------------------------------------');
        log(`Tab ${tabId} closed!`);
        log(removeInfo);
        chrome.storage.local.remove(`TabRecord${tabId}`);
        log('-----------------------------------------');
    });
}

// Register the listener for closing URL visits
// For more see:    https://developer.chrome.com/docs/extensions/reference/tabs/
chrome.tabs.onRemoved.addListener(closeTabUrlListener);

function closeTabs(windowInfo) {
    for (const tabInfo of windowInfo.tabs) {
        runCloseOldUrl(tabInfo.id);
    }
}

function closeWindowListener(windowId) {
    chrome.windows.get(
        windowId,
        { populate: true }
    ).then(closeTabs);
}

// Register the listener for closing Windows.
chrome.windows.onRemoved.addListener(closeWindowListener);

/*
    INTERVENTIONS
*/
function execTwitterIntervention(tabId, tab, server_res) {
    // Just check what the intervention was, if any
    log(`Tab ${tabId} (${tab.title}) twitter intervention run!`);
    if (server_res.apply_intervention) {
        log('Twitter Intervention!');
        chrome.storage.local.set({
            TwitterInterventionType: server_res.intervention,
            TwitterInterventionMessage: server_res.intervention_message
        });
        chrome.scripting.executeScript({
            target: {
                tabId: tabId
            },
            files: ['twitterIntervention.js']
        });
    } else {
        log('No Intervention!');
    }
}

/* 
    Page Link Collector Execution Function:
    Called whenever a new tab is loaded or created, and when old tabs are replaced with new browsing. First
    checks the backend based on the current URL of the tab to verify whether the tab should be scraped or not.
    If the track is on the whitelist, then injects and executes the page links script.
    For more, see:
        https://developer.chrome.com/docs/extensions/reference/scripting/
*/
function execCollectLinks(tabId, tab, server_res) {
    if (server_res.collect_links) {
        log(`Tab ${tabId} (${tab.title}) collect links intervention run!`);
        chrome.scripting.executeScript({
            target: {
                tabId: tabId
            },
            files: ['collectLinks.js']
        });
        chrome.storage.local.get(['ParticipantId', `TabRecord${tabId}`], items => {
            chrome.tabs.sendMessage(tabId, {
                ParticipantId: items.ParticipantId,
                TabRecord: items[`TabRecord${tabId}`]
            });
        });
    }
}

function execCollectTweets(tabId, tab, server_res) {
    if (server_res.collect_tweets) {
        log(`Tab ${tabId} (${tab.title}) collect tweets intervention run!`);
        chrome.scripting.executeScript({
            target: {
                tabId: tabId
            },
            files: ['collectTweets.js']
        });
        chrome.storage.local.get(['ParticipantId', `TabRecord${tabId}`], items => {
            chrome.tabs.sendMessage(tabId, {
                ParticipantId: items.ParticipantId,
                TabRecord: items[`TabRecord${tabId}`]
            });
        });
    }
}

/*
    Actions Listener for chrome.tabs.onUpdated:
    This collects all interventions or dynamic actions that might be run on a website
    based on its identity while a user is browsing, and collects them together so that
    the server is not overloaded with too many requests. One request is made to the $SERVER_URL/extension/actions
    endpoint, and then the results of this call along with with tab data are then passed to 
    the separate individual intervention functions.
    For more, see:
        https://developer.chrome.com/docs/extensions/reference/scripting/
        https://developer.chrome.com/docs/extensions/reference/tabs/
        https://developer.chrome.com/docs/extensions/reference/storage/

*/
function actionListener(tabId, changeInfo, tab) {
    // Only run all action scripts once, on final page load, and only on non-chrome URLs
    if ('status' in changeInfo && changeInfo.status == 'complete' && !tab.url.startsWith('chrome')) {
        chrome.storage.local.get(['ParticipantId'], items => {
            // Run on registered participants only
            if ('ParticipantId' in items) {
                // Now request the backend
                let actionEndpoint = `${SERVER_URL}/extension/action/`;
                let parsedUrl = new URL(tab.url);
                if (parsedUrl.hostname.startsWith('www.')) {
                    parsedUrl.cleanUrl = parsedUrl.hostname.slice(4);
                } else {
                    parsedUrl.cleanUrl = parsedUrl.hostname;
                }
                let record = {
                    ParticipantId: items.ParticipantId,
                    url: tab.url,
                    TLD: parsedUrl.cleanUrl,
                    changeInfo: changeInfo
                };

                // Send all info to backend, and then exec the interventions
                post(actionEndpoint, record, server_res => {
                    // Now call each intervention function
                    //execVisualIntervention(tabId, tab, server_res);
                    execTwitterIntervention(tabId, tab, server_res);
                    execCollectLinks(tabId, tab, server_res);
                    execCollectTweets(tabId, tab, server_res);
                    checkOffboardUser(server_res);
                });
            }
        });
    }
}

// Register the Action Listener
// See: https://developer.chrome.com/docs/extensions/reference/tabs/
chrome.tabs.onUpdated.addListener(actionListener);