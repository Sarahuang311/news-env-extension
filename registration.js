/* eslint-disable no-prototype-builtins */
/* eslint-disable no-undef */
// ^ Above are some defaults for eslinter for easier debugging, can be ignored.
/* 
    registration.js
    Content script that only runs on the development server and production server extension registration pages to connect
    the extension to participants' study website accounts.
*/
"use strict";


/* 
    Register Extension Function: On DOMContentLoaded, when the event happens and loads.
    - This function only runs on the ${SERVER_URL}/onboard/extension page.
    - It puts an H1 indicator right below the main__text of the page that indicates a reload
      when the extension is loaded onto the webpage.
    - NOTE: This function only runs if the ParticipantId has NOT been set yet in the current extension.
    - Also, this function is set to only run once the page has finished loading.
*/
function registerExtension() {
    chrome.storage.local.get(['ParticipantId'], items => {
        if (!('ParticipantId' in items)) {
    console.log('Registering StudyExt Extension...');
    let extensionInstallAlert = document.createElement('h1');
    extensionInstallAlert.innerText = 'Extension detected, installing now in 5 seconds...';
    extensionInstallAlert.className = 'main__header';
    document.querySelector('div.main__text').appendChild(extensionInstallAlert);
    setTimeout(() => {
        let userId = document.querySelector('input[type=text]#id_user_id');
        let isAdmin = document.querySelector('input[type=text]#id_is_admin');

        let experimentType = 1; // News
        let experimentTypeInput = document.querySelector('input[type=text]#id_experiment_type');
        if (experimentTypeInput != null && experimentTypeInput != undefined) {
            experimentTypeInput.value = experimentType;
        }

        let form = document.querySelector('form');

        if (userId != null && isAdmin != null) {
            chrome.storage.local.set({
                ParticipantId: userId.value,
                isAdmin: isAdmin.value,
            });
            form.submit();
        }
    }, 5000);
        }
    });
}

// Run it once script loads on page.
registerExtension();