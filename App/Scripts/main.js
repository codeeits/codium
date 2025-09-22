async function loadTopMenu(variant = 'default') {
    try {
        const response = await fetch('elements.html');
        const menuHTML = await response.text();
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = menuHTML;
        
        const menuVariant = tempDiv.querySelector(`#top-menu-${variant}`);
        
        if (menuVariant) {
            const menuClone = menuVariant.cloneNode(true);
            menuClone.id = 'top-menu';
            menuClone.classList.remove('menu-variant');
            
            document.getElementById('top-menu-container').innerHTML = menuClone.outerHTML;
            console.log(`Loaded menu variant: ${variant}`);
            
        } else {
            console.warn(`Menu variant '${variant}' not found, loading default`);
            loadTopMenu('default');
        }
    } catch (error) {
        console.error('Error loading top menu:', error);
    }
}

function getMenuVariant() {

    const metaTag = document.querySelector('meta[name="menu-variant"]');
    if (metaTag) {
        return metaTag.getAttribute('content');
    }
    
    return 'default';
}

document.addEventListener('DOMContentLoaded', function() {
    const variant = getMenuVariant();
    loadTopMenu(variant);
});