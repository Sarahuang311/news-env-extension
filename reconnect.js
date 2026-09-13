/* eslint-disable no-prototype-builtins */
/* eslint-disable no-undef */
// ^ Above are some defaults for eslinter for easier debugging, can be ignored.
/* 
    reconnect.js
    Content script that only runs on the development server and production server reconnect extension pages to connect
    the extension to participants' study website accounts. This is only run if the user specifically asks to reconnect
    the extension, and the extension is currently not registered.
*/
"use strict";


/* 
    Reconnect Function Listener:
    - Sets the ParticipantId value for an extension as it is loaded.
*/
function reconnectBtnListener(e) {
    let btn = e.composedPath()[0];
    let participant_id = btn.getAttribute('participant_id');
    let is_admin = btn.getAttribute('is_admin') === "True";
    if (participant_id) {
        chrome.storage.local.set({
            ParticipantId: participant_id,
            isAdmin: is_admin,
        });
        location.reload();
    }
}


/* 
    Reconnect Extension Function: 
    - NOTE: This function only runs if the ParticipantId has NOT been set yet in the current extension.
    - Also, this function is set to only run once the page has finished loading.
*/
function reconnectExtension() {
    chrome.storage.local.get(['ParticipantId'], items => {
        let extensionBtn = document.querySelector('#extension_connect_btn');
        if (!('ParticipantId' in items)) {
            extensionBtn.addEventListener('click', reconnectBtnListener);
            console.log('New registration!');
        }
        else {
            extensionBtn.classList.toggle('disabled-btn');
            extensionBtn.innerText = 'Extension Registered';
        }
    });
}

// Run it once script loads on page.
reconnectExtension();