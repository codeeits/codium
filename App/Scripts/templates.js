/*
 ____  ____  __  __  ____  __      __   ____  ____  ___     ____  ___ 
(_  _)( ___)(  \/  )(  _ \(  )    /__\ (_  _)( ___)/ __)   (_  _)/ __)
  )(   )__)  )    (  )___/ )(__  /(__)\  )(   )__) \__ \  .-_)(  \__ \
 (__) (____)(_/\/\_)(__)  (____)(__)(__)(__) (____)(___/()\____) (___/

Template system for creating reusable UI components, similar to Figma components.
*/

async function loadTemplates(url, templateId) {
    try {
        const res = await fetch(url);
        const text = await res.text();

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = text;

        const template = tempDiv.querySelector(`#${templateId}`);
        if (!template) throw new Error(`Template with ID '${templateId}' not found`);
    } catch (error) {
        console.error('Error loading templates:', error);
        throw error;
    }
}

loadTemplates('/app/templates.html', 'log-in-template').then(templateId => {
    console.log('Templates loaded successfully');
    console.log(templateId);
}).catch(err => {
    console.error('Failed to load templates:', err);
});