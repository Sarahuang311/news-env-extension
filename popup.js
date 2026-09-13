/* eslint-disable no-prototype-builtins */
/* eslint-disable no-undef */
// ^ Above are some defaults for eslinter for easier debugging, can be ignored.
"use strict";

/*
    popup.js - Activated when user clicks on popup window. This js file:
    - Populates div.main__status with alert.svg or checkmark.svg depending on actions needed
      by the participants.
    - If an action is needed, provides link to complete action and brief message text
      identifying the action needed.
    - NOTE: Message must be <4 words to display properly in box.
    - ParticipantId: UUID for Participant, if not set, redirects to onboarding flow.
    - ParticipantAlert: Bool indicating whether current Participant has outstanding surveys / other actions.
    - ParticipantAlertMessage: <4 words (preferably 2) that explain action needed (ie Survey Alert)
    - ParticipantAlertUrl: URL for completing action.
    
    See the following references:
        https://developer.chrome.com/docs/extensions/reference/storage/
        https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model
*/
chrome.storage.local.get(
    [
        'ParticipantId',
        'ParticipantAlert',
        'ParticipantAlertUrl',
        'ParticipantAlertMessage',
        'UserOffboarded',
    ], 
    items => {
        // Setup elements for manipulation
        let alertIcon = document.querySelector('.main__status > img.main__icon');
        let alertLink = document.querySelector('.main > a:first-child');
        let alertMessage = document.querySelector('span.main__status--message');

        // Populate the static links from the configured server URL (see config.js).
        document.getElementById('header-link').href = SERVER_URL;
        document.getElementById('settings-link').href = SERVER_URL;
        document.getElementById('contact-link').href = `${SERVER_URL}/contact`;

        // 1) Check if participant is registered. If not, direct them to registration.
        if (!('ParticipantId' in items) && !('UserOffboarded' in items)) {
            alertIcon.src = 'img/alert.svg';
            alertLink.href = `${SERVER_URL}/onboard/redirect_prolific/`;
            alertMessage.innerText = 'Please Register';
        }
        else if ('UserOffboarded' in items) {
            alertMessage.innerText = 'Experiment Ended';
        }
        // 2) Check if there is an active participant alert. If there is, relay the alert message.
        else if ('ParticipantAlert' in items && items.ParticipantAlert) {
            alertIcon.src = 'img/alert.svg';
            alertLink.href = items.ParticipantAlertUrl;
            alertMessage.innerText = items.ParticipantAlertMessage;
        } 
        // 3) If no such alert is detected or happening, just relay that there are no updates.
        else {
            alertLink.target = '';
            alertLink.style['pointer-events'] = 'none';
            alertMessage.innerText = 'No Updates';
        }
});