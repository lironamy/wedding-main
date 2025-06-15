# Manual Testing Plan: AI Wedding Photo App

This document outlines the manual testing plan for the AI Wedding Photo Application. It covers key functionalities from the perspective of both the Main User (Bride/Groom) and Guest Users.

**Testing Environment Checklist:**
*   [ ] Deployed application (staging or local environment).
*   [ ] Access to MongoDB for verification.
*   [ ] Access to Cloudinary account for verification.
*   [ ] Configured Twilio account with WhatsApp sender and test phone numbers.
*   [ ] `.env` file correctly configured with all API keys and settings.
*   [ ] Sample images (clear selfies, group wedding photos, non-image files, photos without clear faces).
*   [ ] Multiple browser profiles or incognito windows for simulating different users.

---

## I. Main User (Bride/Groom) Workflow

1.  **Authentication & Initial Setup:**
    *   [ ] **Registration:** Successfully register a new main user account (`userType: 'bride/groom'`). Verify user document creation in MongoDB.
    *   [ ] **Login (Valid):** Log in with the newly created (or existing valid) main user credentials. Verify session establishment (e.g., cookie, redirect to dashboard).
    *   [ ] **Login (Invalid Credentials):** Attempt login with an incorrect password. Verify appropriate error message.
    *   [ ] **Login (Non-existent User):** Attempt login with an email that is not registered. Verify appropriate error message.
    *   [ ] **Logout:** Successfully log out from an active session. Verify session termination and redirect (e.g., to login page).

2.  **Dashboard - Wedding Photo Upload (`/dashboard` - "העלאת תמונות חתונה" Tab):**
    *   [ ] **Navigation:** Successfully navigate to the "העלאת תמונות חתונה" (Upload Wedding Photos) tab on the dashboard.
    *   [ ] **Valid Upload (Multiple Images):** Upload a batch of 5-10 valid JPG/PNG images.
        *   [ ] Observe file selection UI and indication of files chosen.
        *   [ ] Observe any client-side validation for file types if implemented.
        *   [ ] Observe upload initiation and feedback (e.g., "מעלה X קבצים...").
        *   [ ] Observe clear success message upon completion, including the number of files uploaded.
        *   [ ] Verify uploaded image previews are displayed (if this feature is fully implemented).
    *   [ ] **Valid Upload (Single Image):** Upload a single valid JPG/PNG image. Verify success.
    *   [ ] **Invalid File Type Upload:** Attempt to upload non-image files (e.g., .txt, .pdf, .zip). Observe user-friendly error message and that the files are not uploaded.
    *   [ ] **Empty Submission:** Click the upload button without selecting any files. Observe user-friendly message prompting file selection.
    *   [ ] **Backend Verification (Cloudinary):** Manually check the Cloudinary account (if accessible during testing) to confirm that uploaded images are present in the correct folder (e.g., `wedding_photos`).
    *   [ ] **Backend Verification (MongoDB):**
        *   [ ] Verify that a `Photo` document is created in MongoDB for each successfully uploaded image.
        *   [ ] Confirm `uploader` field matches the logged-in main user's ID.
        *   [ ] Confirm `imageUrl` and `cloudinaryPublicId` store the correct Cloudinary details.
        *   [ ] Confirm `isProcessed` is `false` and `detectedFaces` is empty for newly uploaded photos.

3.  **Dashboard - Contacts Management & Initial Invitations (`/dashboard` - "אנשי קשר והזמנות" Tab):**
    *   [ ] **Navigation:** Successfully navigate to the "אנשי קשר והזמנות" (Contacts & Invitations) tab.
    *   [ ] **Valid JSON Upload:**
        *   [ ] Paste a valid JSON list of 2-3 contacts (each with `name` and `phoneNumber` in E.164 format) into the textarea.
        *   [ ] Click "העלה רשימת אנשי קשר" (Upload Contact List).
        *   [ ] Observe success message indicating counts of contacts added, updated, or skipped.
        *   [ ] **MongoDB Verification:** Verify `Contact` documents are created with correct `name`, `phoneNumber`, a unique `invitationToken`, and `invitationSent: false`.
    *   [ ] **Invalid JSON Format:** Paste malformed JSON (e.g., missing comma, incorrect brackets). Click "העלה רשימת אנשי קשר". Observe user-friendly error message about JSON format.
    *   [ ] **JSON with Missing Fields:** Paste JSON where some contacts lack `name` or `phoneNumber`. Observe feedback on failed/skipped contacts.
    *   [ ] **Duplicate Phone Numbers:** Upload a list containing a phone number already in the system (once with `invitationSent: false`, once with `invitationSent: true`).
        *   [ ] Verify update logic (if not yet invited, name might update).
        *   [ ] Verify skip logic (if already invited).
    *   [ ] **Send Initial Invitations:**
        *   [ ] Ensure there are contacts with `invitationSent: false`.
        *   [ ] Click "שלח הזמנות להעלאת סלפי" (Send Invitations to Upload Selfie).
        *   [ ] Observe feedback message (e.g., "שולח הזמנות...").
        *   [ ] Observe completion message with counts of sent/failed messages.
        *   [ ] **Twilio & WhatsApp Verification:**
            *   [ ] Verify test phone numbers receive the WhatsApp invitation message.
            *   [ ] Confirm the message content is correct and includes a unique link: `yourdomain.com/guest-photos/[invitationToken]`.
            *   [ ] Verify the `invitationToken` in the link matches the one stored in the `Contact` document for that phone number.
        *   [ ] **MongoDB Verification:** Verify `Contact` documents for successfully notified contacts are updated to `invitationSent: true`.

4.  **Dashboard - Wedding Photo Processing (`/dashboard` - "עיבוד תמונות חתונה" Tab):**
    *   [ ] **Prerequisites:** Ensure some wedding photos have been uploaded and some guests have uploaded selfies (see Guest Workflow II.1).
    *   [ ] **Navigation:** Successfully navigate to the "עיבוד תמונות חתונה" (Process Wedding Photos) tab.
    *   [ ] **Trigger Processing:** Click "התחל עיבוד תמונות חתונה" (Start Wedding Photo Processing).
        *   [ ] Observe feedback message indicating processing has started.
        *   [ ] (Wait for processing to complete - this might take time) Observe completion message with counts of photos processed and faces matched.
    *   [ ] **MongoDB Verification (`Photo` documents):**
        *   [ ] For processed photos, verify `isProcessed` is set to `true`.
        *   [ ] If faces were detected, verify `detectedFaces` array is populated. Each entry should have `faceDescriptorInPhoto`.
        *   [ ] If a detected face was matched to a guest (who has a `faceEncoding`), verify `matchedUser` (User ID) is correctly populated in the relevant `detectedFaces` entry.
        *   [ ] Verify `notifiedGuests` array is initially empty or does not contain users for new matches yet.

5.  **Dashboard - Notify Guests for New Photos (`/dashboard` - "אנשי קשר והזמנות" Tab):**
    *   [ ] **Prerequisites:** Wedding photos have been processed (Step I.4), and some guests have been matched to faces in these photos.
    *   [ ] **Trigger Notifications:** Click "שלח התראות על תמונות חדשות לאורחים" (Notify Guests about New Photos).
        *   [ ] Observe feedback message (e.g., "שולח התראות...").
        *   [ ] Observe completion message with counts of notifications sent/failed.
    *   [ ] **Twilio & WhatsApp Verification:**
        *   [ ] Verify relevant guest test phone numbers receive a WhatsApp notification about new photos.
        *   [ ] Confirm the message content is correct and includes a link to `/my-photos`.
    *   [ ] **MongoDB Verification (`Photo` documents):**
        *   [ ] For each photo where a guest was matched and notified, verify that guest's ID is added to the `notifiedGuests` array for that `Photo` document.

---

## II. Guest User Workflow

1.  **Invitation and Selfie Upload (`/guest-photos/[token]`):**
    *   [ ] **Receive Invitation:** Successfully receive a WhatsApp invitation with a unique link from Main User (Step I.3).
    *   [ ] **Valid Token Navigation:** Click the link. Verify navigation to the correct `app/guest-photos/[token]` page. The token should be visible in the URL.
    *   [ ] **Selfie Upload (Clear Face):**
        *   [ ] Select a clear selfie image (JPG/PNG). Observe preview if implemented.
        *   [ ] Click "העלה סלפי ובדוק התאמות" (Upload Selfie & Check Matches).
        *   [ ] Observe upload progress/pending state.
        *   [ ] Observe success message indicating selfie uploaded and face detected (e.g., "סלפי הועלה בהצלחה! אנחנו נאבד אותו ונחפש את התמונות שלך.").
    *   [ ] **Backend Verification (Cloudinary):** Manually check Cloudinary to confirm selfie image is uploaded (e.g., to `guest_selfies` folder).
    *   [ ] **Backend Verification (MongoDB - `User` document):**
        *   [ ] Verify a `User` document for the guest is created (if first time) or updated. This might be linked via the `Contact` entry associated with the token.
        *   [ ] Confirm `selfiePath` stores the Cloudinary URL of the selfie.
        *   [ ] Confirm `faceEncoding` array is populated with numerical data.
        *   [ ] Confirm `isVerified` (or similar field indicating selfie processing success) is `true`.
        *   [ ] Confirm `Contact` document's `guestUser` field is linked to this new/updated guest `User` ID.
    *   [ ] **Selfie Upload (No Clear Face):** Attempt to upload an image where no face is clearly visible (e.g., a landscape, a very blurry photo). Observe user-friendly error message (e.g., "לא הצלחנו לזהות פנים בתמונה...").
    *   [ ] **Selfie Upload (Multiple Faces):** Attempt to upload an image with multiple clear faces. Observe behavior (API is designed for single face, so it might pick one or error; verify consistent feedback).
    *   [ ] **Invalid File Type:** Attempt to upload a non-image file (e.g., .txt, .pdf). Observe user-friendly error message.
    *   [ ] **Invalid/Expired Token:** Attempt to navigate to `/guest-photos/[token]` with a deliberately incorrect or already used token. Observe appropriate error page or message.

2.  **Viewing Matched Photos (`/my-photos`):**
    *   [ ] **Notification (Optional):** Guest receives a WhatsApp notification that new photos featuring them are available (from Main User step I.5).
    *   [ ] **Login (if applicable):**
        *   [ ] If the selfie upload process doesn't auto-login, or if the session expired, guest may need to log in. (Note: Current implementation details of guest login post-selfie-upload are not fully specified, adapt this step as needed. Assume for now `useAuth` handles guest sessions if `User` doc exists).
        *   [ ] If login is required, test with valid and invalid guest credentials.
    *   [ ] **Navigation:** Navigate to the `/my-photos` page (either via link in notification or directly if logged in).
    *   [ ] **Photo Display:**
        *   [ ] Verify that all photos where the guest was correctly matched (and processed) are displayed in the gallery.
        *   [ ] Verify that photos where the guest was *not* matched are *not* displayed.
        *   [ ] Check image loading and presentation quality.
    *   [ ] **Download Photos:**
        *   [ ] Click the download button for a single photo. Verify the image is downloaded correctly with a reasonable filename.
        *   [ ] (If multi-select/download all is implemented) Test this functionality.
    *   [ ] **No Photos Found:** If a guest has no matched photos (either no matches or photos not processed yet), verify a user-friendly message is displayed (e.g., "No photos found featuring you yet...").
    *   [ ] **Logout:** Successfully log out from the guest session. Verify redirect (e.g., to login or home page).

---

## III. General Checks

1.  **Responsiveness:**
    *   [ ] **Main Dashboard:** Check `/dashboard` and its tabs on Desktop, Tablet (portrait/landscape), and Mobile views. Verify layout adapts and all controls are usable.
    *   [ ] **Guest Selfie Upload:** Check `/guest-photos/[token]` on various screen sizes.
    *   [ ] **Guest My Photos:** Check `/my-photos` gallery on various screen sizes.
    *   [ ] **Login/Register Pages:** Check auth pages on various screen sizes.

2.  **Error Handling & User Feedback:**
    *   [ ] **Form Validations:** Test all forms with empty required fields, invalid data types (e.g., incorrect email format, short password if rules exist), and excessively long inputs. Verify clear, field-specific error messages.
    *   [ ] **API Errors (Simulated):**
        *   [ ] If possible, use browser developer tools to simulate network errors or non-OK API responses (e.g., 500, 403) for key API calls (photo uploads, contact uploads, processing triggers, fetching photos).
        *   [ ] Observe if the UI displays a user-friendly error message and allows for recovery (e.g., a "try again" button) rather than crashing or showing raw error data.
    *   [ ] **Loading States:** Verify that all actions involving API calls show clear loading indicators (e.g., spinners on buttons, page overlays) to inform the user the system is working. Ensure indicators disappear on completion/error.
    *   [ ] **Success Messages:** Confirm positive actions result in clear, concise success messages.

3.  **Security & Access Control (Basic Checks):**
    *   [ ] **Authenticated Routes:**
        *   [ ] Attempt to access `/dashboard` directly without being logged in as a main user. Verify redirection to login.
        *   [ ] Attempt to access `/my-photos` directly without being logged in as a guest. Verify redirection to login.
        *   [ ] Attempt to access API endpoints for authenticated actions (e.g., POST to `/api/photos/upload-wedding-photos`) without a valid token (e.g., using Postman or cURL). Verify 401/403 responses.
    *   [ ] **Role-Based Access:**
        *   [ ] As a logged-in guest, attempt to access main user dashboard functionalities (e.g., try to navigate to dashboard tabs for contact upload). Verify access is denied or page is not available.
        *   [ ] As a logged-in main user, attempt to access guest-specific pages like `/my-photos` or the selfie upload page with a token. Verify appropriate handling (e.g., redirect or error message "This page is for guests").
    *   [ ] **Token Usage:**
        *   [ ] Ensure the selfie upload page (`/guest-photos/[token]`) is only functional with a valid, unexpired token that corresponds to a `Contact`.
        *   [ ] (Considered) Test if one guest's token can be used to upload a selfie for another contact (it shouldn't, as the token is tied to a specific contact).
    *   [ ] **Photo Access:** Critically verify that a guest logged into `/my-photos` can *only* see photos they are matched in, and not photos of other guests or all wedding photos.

4.  **Usability & Consistency:**
    *   [ ] **Navigation:** Check if navigation between pages is intuitive. Are breadcrumbs or clear back buttons needed anywhere?
    *   [ ] **Terminology:** Ensure button labels, titles, and instructional text are clear, concise, and consistent across the application (especially for Hebrew text).
    *   [ ] **Styling:** Check for overall visual consistency (fonts, colors, component styles) based on Shadcn UI and Tailwind CSS usage.
    *   [ ] **Performance (Subjective):** Note any pages or actions that seem unusually slow, even with a small amount of data.

---

This testing plan should be updated as new features are added or existing ones are modified. Each test case should be marked as passed or failed during execution, with details provided for any failures.The manual testing plan has been successfully generated.
