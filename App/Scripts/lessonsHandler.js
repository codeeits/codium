/*

 __    ____  ___  ___  _____  _  _  ___  _   _    __    _  _  ____  __    ____  ____     ____  ___ 
(  )  ( ___)/ __)/ __)(  _  )( \( )/ __)( )_( )  /__\  ( \( )(  _ \(  )  ( ___)(  _ \   (_  _)/ __)
 )(__  )__) \__ \\__ \ )(_)(  )  ( \__ \ ) _ (  /(__)\  )  (  )(_) ))(__  )__)  )   /  .-_)(  \__ \
(____)(____)(___/(___/(_____)(_)\_)(___/(_) (_)(__)(__)(_)\_)(____/(____)(____)(_)\_)()\____) (___/
Handles lesson uploads made by admins.
*/

document.addEventListener("DOMContentLoaded", function() {

    // ------------------------------
    // THE PAGE WHERE YOU SEE THE LESSONS
    // ------------------------------

        const isAdmin = localStorage.getItem('isAdmin') === 'true';
        console.log(`Is Admin: ${isAdmin}`);
        if (!isAdmin) {
            const uploadBtn = document.getElementById("openUploadModal");
            const currentPage = window.location.pathname;
            if (uploadBtn) {
                uploadBtn.style.display = "none";
            } else {
                window.location.href = "user.html";
            }
        } else {
            toastsLoader.showToast('auth!', 'confirm');
        }
    
    // ------------------------------
    // LESSON UPLOAD HANDLER MODAL
    // ------------------------------

    const uploadModal = document.getElementById("uploadLessonModal");
    const form = document.getElementById("lessonUploadForm");
    const fileInput = document.getElementById("lessonFile");
    const fileInfo = document.getElementById("fileInfo");
    const clearForm = document.getElementById("clearForm");

    let prevLess = null;
    let nextLess = null;

    //clear form funct

    clearForm.addEventListener("click", function(){

        form.reset();
        if (fileInfo) {
            fileInfo.style.display = "none";
        }

    });
    // Show file info when file is selected
    fileInput.addEventListener("change", function(e) {
        const file = e.target.files[0];
        const nameLabel = document.getElementById("fileName");
        const sizeLabel = document.getElementById("fileSize");

        if (file && nameLabel && sizeLabel && fileInfo) {
            nameLabel.textContent = file.name;
            sizeLabel.textContent = `${(file.size / 1024).toFixed(2)} KB`;
            fileInfo.style.display = "block";
        } else if (fileInfo) {
            fileInfo.style.display = "none";
        }
    });

    form.addEventListener("submit", async function(e) {
        e.preventDefault();

        const authToken = localStorage.getItem('authToken');

        const formData = {
            title: document.getElementById("lessonTitle").value,
            description: document.getElementById("lessonDescription").value,
            class: parseInt(document.getElementById("modalLessonClass").value),
            section: parseInt(document.getElementById("lessonSection").value),
            number: 1,
            module: parseInt(document.getElementById("lessonModule").value),
        }

        // upload file and create lesson

        const fileInput = document.getElementById("lessonFile");
        const fileS = fileInput.files[0];
        const fileLength = fileS.size;
        const fileName = fileS.name;

        console.log(`Uploading file: ${fileName} (${fileLength} bytes)`);
        toastsLoader.showToast(`Uploading file: ${fileName}`, 'info');

        let responseData;
        try {

            // GET LAST LESSON IN SECTION TO SET PREVIOUS LESSON ID
            let lastLesson = await window.apiService.getLessonsByFlags(
                formData.class, 
                formData.section, 
                formData.module
            );
            lastLesson = JSON.parse(lastLesson);
            lastLesson = lastLesson.length > 0 ? lastLesson[lastLesson.length - 1] : null;
            let lastLessonID = lastLesson ? lastLesson.lesson.ID : null;
            console.log(`Last lesson in section:`, lastLesson);

            // UPLOAD THE LESSON
            responseData = await window.apiService.uploadLesson(formData, fileS);
            responseData = JSON.parse(responseData);
            
            console.log("Lesson uploaded successfully.");
            console.log(responseData);
            toastsLoader.showToast(`Lesson uploaded successfully. ID: ${responseData.lesson.ID}`, "confirm");
            
            // Check if this is the first lesson in the section and assign section_starter if needed
            try {
                const existingLessons = await window.apiService.getLessonsByFlags(
                    formData.class, 
                    formData.section, 
                    formData.module
                );
                
                const lessonsData = JSON.parse(existingLessons);
                console.log(`Existing lessons in section ${formData.section}:`, lessonsData);
                if (lessonsData.length === 1) {
                    console.log(`This is the first lesson in section ${formData.section}, setting as section starter`);
                    await window.apiService.updateLessonSectionStarter(responseData.lesson.ID, formData.section);
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

            // Update UI elements if they exist
            const nameLabel = document.getElementById("fileName");
            if (nameLabel) {
                nameLabel.textContent = fileName;
            }
            
            const sizeLabel = document.getElementById("fileSize");
            if (sizeLabel) {
                sizeLabel.textContent = `${(fileLength / 1024).toFixed(2)} KB`;
            }

            if(fileInfo) {
                fileInfo.style.display = "none";
            }

        } catch (error) {
            console.error("Lesson upload failed:", error);
            toastsLoader.showToast(`Lesson upload failed: ${error.message}`, "danger");
            return;
        }

        try {
            if(!prevLess || !nextLess) {
                console.log('No lesson order update needed.');
            } else {
                prevLess = document.getElementById("debugPrevLesson").value.trim();
                nextLess = document.getElementById("debugNextLesson").value.trim();
            }
            // Convert empty strings to null
            prevLess = prevLess === "" ? null : prevLess;
            nextLess = nextLess === "" ? null : nextLess;
            
            console.log('Updating lesson order:', {
                lessonId: responseData.lesson.ID,
                prevLess: prevLess,
                nextLess: nextLess
            });
            
            await window.apiService.updateLessonOrder(responseData.lesson.ID, prevLess, nextLess);
            toastsLoader.showToast(`Lesson order updated successfully.`, "confirm");
        } catch (error) {
            console.warn("Updating lesson order failed:", error);
            toastsLoader.showToast(`Updating lesson order failed: ${error.message}`, "warning");
            return;
        }

        // Reset form only after everything is done
        form.reset();

    })
})