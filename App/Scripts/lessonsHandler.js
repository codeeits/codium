/*

 __    ____  ___  ___  _____  _  _  ___  _   _    __    _  _  ____  __    ____  ____     ____  ___ 
(  )  ( ___)/ __)/ __)(  _  )( \( )/ __)( )_( )  /__\  ( \( )(  _ \(  )  ( ___)(  _ \   (_  _)/ __)
 )(__  )__) \__ \\__ \ )(_)(  )  ( \__ \ ) _ (  /(__)\  )  (  )(_) ))(__  )__)  )   /  .-_)(  \__ \
(____)(____)(___/(___/(_____)(_)\_)(___/(_) (_)(__)(__)(_)\_)(____/(____)(____)(_)\_)()\____) (___/

*/

const isAdmin = localStorage.getItem('isAdmin') === 'true';
if (!isAdmin) {
    window.location.href = 'index.html';
}

document.addEventListener("DOMContentLoaded", function() {

    const uploadModal = document.getElementById("uploadLessonModal");
    const form = document.getElementById("lessonUploadForm");
    const fileInput = document.getElementById("lessonFile");

    // Show file info when file is selected
    fileInput.addEventListener("change", function(e) {
        const file = e.target.files[0];
        const nameLabel = document.getElementById("fileName");
        const sizeLabel = document.getElementById("fileSize");
        const fileInfo = document.getElementById("fileInfo");

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
            class: parseInt(document.getElementById("lessonClass").value),
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
            
            form.reset();

        } catch (error) {
            console.error("Lesson upload failed:", error);
            return;
        }

    })
})