const EXPERIMENTAL_SECTIONS = [
    {
        containerId: 'experimental-ui-grid',
        items: [
            {
                title: 'New user dashboard',
                description: 'Sidebar-based account page with newer profile and progress layout.',
                href: '/app/user.html',
                icon: 'fa-user',
                tag: 'new ui'
            },
            {
                title: 'Section starter page',
                description: 'Entry point for section content, with progress overview and navigation.',
                href: '/app/Lectii/section-starter.html',
                icon: 'fa-layer-group',
                tag: 'new ui'
            },
            {
                title: 'Solution viewer',
                description: 'New solution page design with improved code display and navigation.',
                href: '/app/Probleme/solution.html',
                icon: 'fa-lightbulb',
                tag: 'new ui'
            },
            {
                title: 'New lessons index',
                description: 'Updated lessons browser with the newer navigation shell.',
                href: '/app/Lectii/lessons.html',
                icon: 'fa-book',
                tag: 'new ui'
            },
            {
                title: 'New problems index',
                description: 'Problems listing with the newer card flow and sidebar.',
                href: '/app/Probleme/index.html',
                icon: 'fa-code',
                tag: 'new ui'
            },
            {
                title: 'New lesson detail',
                description: 'Lesson reading view paired with the newer shell and sidebar.',
                href: '/app/Lectii/lessonindiv.html',
                icon: 'fa-file-lines',
                tag: 'new ui'
            },
            {
                title: 'New problem detail',
                description: 'Problem detail page built for the alternate layout.',
                href: '/app/Probleme/problem2.html',
                icon: 'fa-terminal',
                tag: 'new ui'
            },
            {
                title: 'New lesson management',
                description: 'Management view for suggested lessons and review workflows.',
                href: '/app/Lectii/manage-lessons2.html',
                icon: 'fa-gears',
                tag: 'admin'
            },
            {
                title: 'Settings rewrite',
                description: 'Profile customization and preference controls in the new shell.',
                href: '/app/settings.html',
                icon: 'fa-sliders',
                tag: 'new ui'
            }
        ]
    },
    {
        containerId: 'experimental-templates-grid',
        items: [
            {
                title: 'Shared element registry',
                description: 'Top menus, sidebars, and reusable shell fragments.',
                href: '/app/elements.html',
                icon: 'fa-layer-group',
                tag: 'shell'
            },
            {
                title: 'Modal template pack',
                description: 'Base modal template definitions and modal variants.',
                href: '/app/Scripts/modal/modalTemplates.html',
                icon: 'fa-window-restore',
                tag: 'template'
            },
            {
                title: 'PDF builder template',
                description: 'HTML shell for the PDF builder helper.',
                href: '/app/Scripts/helper/pdfTemplate.html',
                icon: 'fa-file-pdf',
                tag: 'template'
            }
        ]
    },
    {
        containerId: 'experimental-tools-grid',
        items: [
            {
                title: 'Upload problems from xlsx',
                description: 'Tool for bulk uploading problems from specially formatted Excel files.',
                href: '/app/Scripts/testExcel.html',
                icon: 'fa-table',
                tag: 'test'
            },
            {
                title: 'Admin panel',
                description: 'Manage users, approve content. Currently limited to a few functions.',
                href: '/app/admin.html',
                icon: 'fa-gears',
                tag: 'admin'
            },
            {
                title: 'Upload lesson (v1)',
                description: 'Admin interface for uploading new lessons. Currently in use until next major iteration is ready.',
                href: '/app/Lectii/lesson-upload.html',
                icon: 'fa-file-upload',
                tag: 'admin'
            },
            {
                title: 'Manage lessons (v1)',
                description: 'Admin interface for reordering, editing, and managing lessons. Currently in use.',
                href: '/app/Lectii/manage-lessons.html',
                icon: 'fa-gears',
                tag: 'admin'
            },
            {
                title: 'Manage problems ',
                description: 'Experimental API endpoints for managing problems, tests, and solutions. Currently the only supported upload method; unofficially accessible to teachers.',
                href: '/app/Probleme/manage-problems2.html',
                icon: 'fa-gears',
                tag: 'admin'
            },
            {
                title: 'Legacy login flow (v1)',
                description: 'Old login page kept around for comparison and fallback checks.',
                href: '/app/login.html',
                icon: 'fa-right-to-bracket',
                tag: 'legacy'
            },
            {
                title: 'Legacy signup flow (v1)',
                description: 'Old signup page, useful when checking backwards compatibility.',
                href: '/app/signup.html',
                icon: 'fa-user-plus',
                tag: 'legacy'
            }
        ]
    }
];

function createExperimentCard(item) {
    const link = document.createElement('a');
    link.className = 'experiment-card card';
    link.href = item.href;

    const header = document.createElement('div');
    header.className = 'experiment-card-header';

    const iconWrap = document.createElement('div');
    iconWrap.className = 'experiment-card-icon';
    iconWrap.innerHTML = `<i class="fa-solid ${item.icon}"></i>`;

    const tag = document.createElement('span');
    tag.className = 'experiment-card-tag';
    tag.textContent = item.tag;

    header.appendChild(iconWrap);
    header.appendChild(tag);

    const body = document.createElement('div');
    body.className = 'experiment-card-body';

    const title = document.createElement('h3');
    title.textContent = item.title;

    const description = document.createElement('p');
    description.textContent = item.description;

    body.appendChild(title);
    body.appendChild(description);

    const footer = document.createElement('div');
    footer.className = 'experiment-card-footer';
    footer.innerHTML = '<span>Open page</span><i class="fa-solid fa-arrow-right"></i>';

    link.appendChild(header);
    link.appendChild(body);
    link.appendChild(footer);

    return link;
}

function renderSections() {
    EXPERIMENTAL_SECTIONS.forEach((section) => {
        const container = document.getElementById(section.containerId);
        if (!container) {
            return;
        }

        container.replaceChildren();
        section.items.forEach((item) => {
            container.appendChild(createExperimentCard(item));
        });
    });
}

async function ensureAccess() {
    if (!window.apiService) {
        return false;
    }

    if (!(await window.apiService.checkAuthentication(true))) {
        return false;
    }

    try {
        const isAdmin = await window.apiService.users.isCurrentAdmin();
        if (!isAdmin) {
            window.location.href = '/app/index.html';
            return false;
        }
    } catch (error) {
        console.error('Failed to verify admin access:', error);
        window.location.href = '/app/index.html';
        return false;
    }

    return true;
}

document.addEventListener('DOMContentLoaded', async () => {
    document.title = 'Experimental Hub - Codium';

    const allowed = await ensureAccess();
    if (!allowed) {
        return;
    }

    renderSections();
});
