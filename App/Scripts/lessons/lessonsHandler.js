/*
 __    ____  ___  ___  _____  _  _  ___  _   _    __    _  _  ____  __    ____  ____     ____  ___ 
(  )  ( ___)/ __)/ __)(  _  )( \( )/ __)( )_( )  /__\  ( \( )(  _ \(  )  ( ___)(  _ \   (_  _)/ __)
 )(__  )__) \__ \\__ \ )(_)(  )  ( \__ \ ) _ (  /(__)\  )  (  )(_) ))(__  )__)  )   /  .-_)(  \__ \
(____)(____)(___/(___/(_____)(_)\_)(___/(_) (_)(__)(__)(_)\_)(____/(____)(____)(_)\_)()\____) (___/

Handles lesson uploads made by admins.
*/

document.addEventListener("DOMContentLoaded", async function() {

    const debugMode = true; // SET THIS TO ENABLE LOGS!

    // ------------------------------
    
    const currentUser = await window.apiService.users.getCurrentUser();
    /*
    if (currentUser === null) {
        // Not logged in
        window.location.href = 'login.html';
        return;
    }

    if (!currentUser.IsAdmin) {
        // Logged in but not admin
        window.location.href = 'user.html';
        return;  
    }
    */
    const userData = typeof currentUser === 'string' ? JSON.parse(currentUser) : currentUser;
    const userId = userData?.ID;

    if(debugMode) console.info("[DEBUG] Current User:", userData);
    
    // ------------------------------
    // LESSON UPLOAD HANDLER MODAL
    // ------------------------------
    
    document.addEventListener("codium:lesson-upload-submit", async function(e) {
        const formElement = e.detail.formElement;

        let prevLess = null;
        let nextLess = null;

        const formData = {
            title: formElement.querySelector("#lessonTitle").value,
            description: formElement.querySelector("#lessonDescription").value,
            class: parseInt(formElement.querySelector("#modalLessonClass").value),
            section: parseInt(formElement.querySelector("#lessonSection").value),
            number: 1,
            module: parseInt(formElement.querySelector("#lessonModule").value),
        }

        // upload file and create lesson
        const fileInput = formElement.querySelector("#lessonFile");
        const fileS = fileInput.files[0];
        const fileLength = fileS.size;
        const fileName = fileS.name;

        console.log(`Uploading file: ${fileName} (${fileLength} bytes)`);
        toastsLoader.showToast(`Uploading file: ${fileName}`, 'info');

        let responseData;
        try {

            // GET LAST LESSON IN SECTION TO SET PREVIOUS LESSON ID
            let lastLesson = await window.apiService.lessons.getLessonsByFlags(
                formData.class, 
                formData.section, 
                formData.module
            );
            lastLesson = lastLesson.length > 0 ? lastLesson[lastLesson.length - 1] : null;
            let lastLessonID = lastLesson ? lastLesson.lesson.ID : null;
            console.log(`Last lesson in section:`, lastLesson);

            // UPLOAD THE LESSON
            responseData = await window.apiService.lessons.uploadLesson(formData, fileS);
            
            console.log("Lesson uploaded successfully.");
            console.log(responseData);
            toastsLoader.showToast(`Lesson uploaded successfully. ID: ${responseData.lesson.ID}`, "confirm");
            
            // Check if this is the first lesson in the section and assign section_starter if needed
            try {
                const existingLessons = await window.apiService.lessons.getLessonsByFlags(
                    formData.class, 
                    formData.section, 
                    formData.module
                );
                
                const lessonsData = existingLessons;
                console.log(`Existing lessons in section ${formData.section}:`, lessonsData);
                if (lessonsData.length === 1) {
                    console.log(`This is the first lesson in section ${formData.section}, setting as section starter`);
                    await window.apiService.lessons.updateLessonSectionStarter(responseData.lesson.ID, formData.section);
                    toastsLoader.showToast(`Lesson set as section ${formData.section} starter`, "confirm");
                } else {
                    // assign PreviousLessonID to current lesson
                    prevLess = lastLessonID;
                    toastsLoader.showToast(`Lesson PreviousLessonID set to ${lastLessonID}`, "info");
                }
            } catch (error) {
                console.error("Failed to check/update section starter:", error);
                toastsLoader.showToast("Warning: Could not check section starter status", "warning");
            }

        } catch (error) {
            console.error("Lesson upload failed:", error);
            toastsLoader.showToast(`Lesson upload failed: ${error.message}`, "danger");
            return;
        }

        try {
            // Get debug form values if they exist
            const debugPrevInput = formElement.querySelector("#debugPrevLesson");
            const debugNextInput = formElement.querySelector("#debugNextLesson");
            
            if (debugPrevInput && debugNextInput) {
                const debugPrev = debugPrevInput.value.trim();
                const debugNext = debugNextInput.value.trim();
                
                // Only override if debug values are provided
                if (debugPrev) prevLess = debugPrev;
                if (debugNext) nextLess = debugNext;
            }
            
            // Convert empty strings to null
            prevLess = prevLess === "" ? null : prevLess;
            nextLess = nextLess === "" ? null : nextLess;
            
            // Check if we need to update lesson order
            if (!prevLess && !nextLess) {
                console.log('No lesson order update needed.');
                toastsLoader.showToast('No lesson order update needed.', 'info');
            } else {
                console.log('Updating lesson order:', {
                    lessonId: responseData.lesson.ID,
                    prevLess: prevLess,
                    nextLess: nextLess
                });
                
                await window.apiService.lessons.updateLessonOrder(responseData.lesson.ID, prevLess, nextLess);
                toastsLoader.showToast(`Lesson order updated successfully.`, "confirm");
            }
        } catch (error) {
            console.warn("Updating lesson order failed:", error);
            toastsLoader.showToast(`Updating lesson order failed: ${error.message}`, "warning");
            return;
        }

    });
});