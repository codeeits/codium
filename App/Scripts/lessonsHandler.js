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

        // upload file

        const fileInput = document.getElementById("lessonFile");
        const fileS = fileInput.files[0];
        const fileLength = fileS.size;
        const fileName = fileS.name;

        console.log(`Uploading file: ${fileName} (${fileLength} bytes)`);
        toastsLoader.showToast(`Uploading file: ${fileName}`, 'info');

        const fileData = new FormData();
        fileData.append("file", fileS);

        try {
            const response = await fetch("/api/upload?location=lessons", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${authToken}`
                },
                body: fileData,
            });

            if (!response.ok) {
                toastsLoader.showToast(`Upload failed with status: ${response.status}`, 'danger');
                throw new Error(`Upload failed with status: ${response.status}`);
            }

            const result = await response.json();
            const fileID = result.file_id;
            formData.content_id = fileID;

            // Update UI elements if they exist
            const nameLabel = document.getElementById("fileName");
            if (nameLabel) {
                nameLabel.textContent = fileName;
            }
            
            const sizeLabel = document.getElementById("fileSize");
            if (sizeLabel) {
                sizeLabel.textContent = `${(fileLength / 1024).toFixed(2)} KB`;
            }

        } catch (error) {
            console.error("File upload failed:", error);
            return;
        }
        
        toastsLoader.showToast(`File uploaded successfully.`, "confirm");
        console.log("File uploaded successfully.");

        try {
            const response = await fetch("/api/lessons", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${authToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Lesson creation failed with status ${response.status}: ${errorText}`);
            }

            console.log("Lesson uploaded successfully.");
            const responseData = await response.json();
            console.log(responseData);
            toastsLoader.showToast(`Lesson uploaded successfully. ID: ${responseData.lesson.ID}`, "confirm");

            if(fileInfo) {
                fileInfo.style.display = "none";
            }
            form.reset();

        } catch (error) {
            console.error("Lesson upload failed:", error);
            toastsLoader.showToast(`Lesson upload failed: ${error.message}`, "danger");
            return;
        }

    })
})