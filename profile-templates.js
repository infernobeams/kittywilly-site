// Profile Generator Templates
// Template-based profile generation system inspired by VOX

const fs = require('fs');
const path = require('path');

const R = require('./lib/runtime');

const TEMPLATES_DIR = R.seededDirPath('storage', 'templates');
const PROFILES_DIR = R.seededDirPath('storage', 'profiles');

class ProfileTemplates {
    constructor() {
        this.templates = {};
        this.loadTemplates();
    }

    loadTemplates() {
        try {
            if (!fs.existsSync(TEMPLATES_DIR)) {
                fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
                this.createDefaultTemplates();
            }

            const files = fs.readdirSync(TEMPLATES_DIR);
            files.forEach(file => {
                if (file.endsWith('.json')) {
                    const templatePath = path.join(TEMPLATES_DIR, file);
                    const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
                    this.templates[template.name] = template;
                }
            });

            console.log(`[TEMPLATES] Loaded ${Object.keys(this.templates).length} templates`);
        } catch (error) {
            console.error('[TEMPLATES] Error loading templates:', error.message);
        }
    }

    createDefaultTemplates() {
        const defaultTemplates = [
            {
                name: 'basic',
                displayName: 'Basic Profile',
                description: 'Simple profile with basic stats',
                fields: {
                    realUsername: '',
                    fakeUsername: '',
                    friends: 100,
                    followers: 500,
                    followings: 50,
                    about: 'New to Roblox!',
                    joinDate: '1/1/2020'
                }
            },
            {
                name: 'rich',
                displayName: 'Rich Player',
                description: 'Profile with high stats for wealthy appearance',
                fields: {
                    realUsername: '',
                    fakeUsername: '',
                    friends: 500,
                    followers: 10000,
                    followings: 200,
                    about: 'Roblox veteran with lots of Robux',
                    joinDate: '1/1/2015'
                }
            },
            {
                name: 'gamer',
                displayName: 'Pro Gamer',
                description: 'Gamer-focused profile',
                fields: {
                    realUsername: '',
                    fakeUsername: '',
                    friends: 300,
                    followers: 2000,
                    followings: 100,
                    about: 'Professional gamer, FPS main',
                    joinDate: '6/1/2018'
                }
            },
            {
                name: 'developer',
                displayName: 'Developer',
                description: 'Developer/creator profile',
                fields: {
                    realUsername: '',
                    fakeUsername: '',
                    friends: 200,
                    followers: 5000,
                    followings: 50,
                    about: 'Game developer, scripter, builder',
                    joinDate: '3/1/2017'
                }
            }
        ];

        defaultTemplates.forEach(template => {
            const templatePath = path.join(TEMPLATES_DIR, `${template.name}.json`);
            fs.writeFileSync(templatePath, JSON.stringify(template, null, 2));
        });
    }

    getTemplate(name) {
        return this.templates[name] || this.templates['basic'];
    }

    getAllTemplates() {
        return Object.values(this.templates);
    }

    generateProfile(templateName, customFields = {}) {
        const template = this.getTemplate(templateName);
        const profile = {
            ...template.fields,
            ...customFields,
            generatedAt: new Date().toISOString(),
            template: templateName
        };

        return profile;
    }

    saveProfile(profile) {
        try {
            if (!fs.existsSync(PROFILES_DIR)) {
                fs.mkdirSync(PROFILES_DIR, { recursive: true });
            }

            const filename = `${profile.fakeUsername}_${Date.now()}.json`;
            const profilePath = path.join(PROFILES_DIR, filename);
            fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2));

            return { success: true, filename, path: profilePath };
        } catch (error) {
            console.error('[TEMPLATES] Error saving profile:', error.message);
            return { success: false, error: error.message };
        }
    }

    createCustomTemplate(name, displayName, fields) {
        const template = {
            name,
            displayName,
            description: 'Custom template',
            fields
        };

        const templatePath = path.join(TEMPLATES_DIR, `${name}.json`);
        fs.writeFileSync(templatePath, JSON.stringify(template, null, 2));
        
        this.templates[name] = template;
        return { success: true };
    }

    deleteTemplate(name) {
        if (name === 'basic') {
            return { success: false, error: 'Cannot delete basic template' };
        }

        try {
            const templatePath = path.join(TEMPLATES_DIR, `${name}.json`);
            if (fs.existsSync(templatePath)) {
                fs.unlinkSync(templatePath);
                delete this.templates[name];
                return { success: true };
            }
            return { success: false, error: 'Template not found' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = ProfileTemplates;
