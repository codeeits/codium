// Solution to automatically generate modals so we don't hardcode them. This is more dynamic and maintainable.
// Assuming we have a modal template in our HTML like this:
/*
<div id="modal-template" class="modal hidden" data-modal-type="">
    <div class="modal-content">
        <span class="close-button">&times;</span>
        <h2 class="modal-title"></h2>
        <p class="modal-body"></p>
    </div>
</div>

all info should be passed in a structured way, for example:
openModal({
    type: 'delete-confirmation',
    title: 'Confirm Deletion',
    body: 'Are you sure you want to delete this item?',
    onConfirm: () => { /* deletion logic here *\/ },
    onCancel: () => { /* cancellation logic here *\/ }
});

// eg modal for editing profile info:
openModal({
    type: 'edit-profile',
    title: 'Edit Profile',
    body: `
        <form id="edit-profile-form">
            <label for="username">Username:</label>
            <input type="text" id="username" name="username" value="${currentUsername}">
            <label for="email">Email:</label>
            <input type="email" id="email" name="email" value="${currentEmail}">
            <button type="submit">Save Changes</button>
        </form>
    `,
    onConfirm: () => {
        const form = document.getElementById('edit-profile-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const updatedUsername = form.username.value;
            const updatedEmail = form.email.value;
            // Logic to save profile changes
        });
    },
    onCancel: () => {
        // Logic to handle cancellation if needed
    }
});
*/