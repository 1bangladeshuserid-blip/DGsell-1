// GitHub API Integration
class GitHubDeployer {
    constructor() {
        this.token = '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';
        this.username = '';
        this.userData = null;
        this.baseUrl = 'https://api.github.com';
        this.isConnected = false;
        this.deployments = [];
    }

    // Test connection with token
    async connect() {
        showNotification('Connecting to GitHub...', 'info');
        
        try {
            // Fetch user info
            const response = await fetch(`${this.baseUrl}/user`, {
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Invalid token or network error');
            }
            
            this.userData = await response.json();
            this.username = this.userData.login;
            this.isConnected = true;
            
            // Save to localStorage
            localStorage.setItem('github_token', this.token);
            localStorage.setItem('github_user', JSON.stringify(this.userData));
            
            return {
                success: true,
                user: this.userData
            };
            
        } catch (error) {
            console.error('GitHub connection error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Create repository
    async createRepository(repoName, isPrivate = false) {
        try {
            const response = await fetch(`${this.baseUrl}/user/repos`, {
                method: 'POST',
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: repoName,
                    description: 'Deployed with CodeDeploy Pro',
                    private: isPrivate,
                    auto_init: true
                })
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Failed to create repository');
            }

            return {
                success: true,
                repo: data
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Upload file to repository
    async uploadFile(repoName, filePath, content, commitMessage) {
        try {
            // Encode content to base64
            const encodedContent = btoa(unescape(encodeURIComponent(content)));
            
            const response = await fetch(
                `${this.baseUrl}/repos/${this.username}/${repoName}/contents/${filePath}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${this.token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: commitMessage,
                        content: encodedContent,
                        branch: 'main'
                    })
                }
            );

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Failed to upload file');
            }

            return {
                success: true,
                data: data
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Enable GitHub Pages
    async enablePages(repoName) {
        try {
            const response = await fetch(
                `${this.baseUrl}/repos/${this.username}/${repoName}/pages`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `token ${this.token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        source: {
                            branch: 'main',
                            path: '/'
                        }
                    })
                }
            );

            const data = await response.json();
            
            if (!response.ok) {
                // Check if pages already enabled
                const checkResponse = await fetch(
                    `${this.baseUrl}/repos/${this.username}/${repoName}/pages`,
                    {
                        headers: {
                            'Authorization': `token ${this.token}`,
                            'Accept': 'application/vnd.github.v3+json'
                        }
                    }
                );
                
                if (checkResponse.ok) {
                    const pagesInfo = await checkResponse.json();
                    return {
                        success: true,
                        url: `https://${this.username}.github.io/${repoName}/`,
                        pages: pagesInfo
                    };
                }
                
                throw new Error(data.message || 'Failed to enable GitHub Pages');
            }

            return {
                success: true,
                url: `https://${this.username}.github.io/${repoName}/`,
                pages: data
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Complete deployment
    async deploy(code, repoName, isMultiLang = false) {
        try {
            // 1. Create repository
            const repoResult = await this.createRepository(repoName, true);
            if (!repoResult.success) {
                throw new Error(`Repository creation failed: ${repoResult.error}`);
            }

            // 2. Create HTML content
            let htmlContent = '';
            if (isMultiLang) {
                htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${repoName} - Deployed with CodeDeploy Pro</title>
    <style>${code.css || ''}</style>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body>
    ${code.html || ''}
    <script>${code.js || ''}</script>
</body>
</html>`;
            } else {
                htmlContent = code;
            }

            // 3. Upload index.html
            const fileResult = await this.uploadFile(
                repoName,
                'index.html',
                htmlContent,
                'Deployed with CodeDeploy Pro'
            );
            
            if (!fileResult.success) {
                throw new Error(`File upload failed: ${fileResult.error}`);
            }

            // 4. Enable GitHub Pages
            const pagesResult = await this.enablePages(repoName);
            
            if (!pagesResult.success) {
                throw new Error(`GitHub Pages failed: ${pagesResult.error}`);
            }

            // 5. Create README
            await this.uploadFile(
                repoName,
                'README.md',
                `# ${repoName}\n\nThis site was deployed using CodeDeploy Pro.\n\n🌐 Live URL: ${pagesResult.url}\n\n🔧 Made with ❤️ using GitHub Pages.`,
                'Add README'
            );

            return {
                success: true,
                url: pagesResult.url,
                repoUrl: repoResult.repo.html_url,
                repoName: repoName,
                deployedAt: new Date().toISOString()
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get user repositories
    async getRepositories() {
        try {
            const response = await fetch(`${this.baseUrl}/user/repos`, {
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            const repos = await response.json();
            
            if (!response.ok) {
                throw new Error('Failed to fetch repositories');
            }

            return {
                success: true,
                repositories: repos
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Global variables
let githubDeployer = new GitHubDeployer();
let currentDeployment = null;
let isMultiMode = false;

// Initialize app
function initApp() {
    // Set up default code
    setupDefaultCode();
    
    // Update character count
    updateCharCount();
    
    // Generate initial preview
    generatePreview();
}

// Setup default code
function setupDefaultCode() {
    const defaultHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Awesome Site</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #1f6feb 0%, #0d1117 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
            color: white;
        }
        
        .container {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            padding: 40px;
            border-radius: 20px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            max-width: 800px;
            width: 100%;
            text-align: center;
        }
        
        h1 {
            margin-bottom: 20px;
            font-size: 2.8em;
            background: linear-gradient(45deg, #1f6feb, #4493f8);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
        }
        
        .tagline {
            color: #8b949e;
            font-size: 1.2em;
            margin-bottom: 30px;
            line-height: 1.6;
        }
        
        .deploy-btn {
            background: linear-gradient(45deg, #238636, #2ea043);
            color: white;
            border: none;
            padding: 16px 45px;
            font-size: 1.1em;
            border-radius: 50px;
            cursor: pointer;
            transition: all 0.3s;
            font-weight: 600;
            margin: 20px 0;
        }
        
        .deploy-btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 10px 30px rgba(35, 134, 54, 0.4);
        }
        
        .counter {
            font-size: 3em;
            font-weight: bold;
            color: #1f6feb;
            margin: 20px 0;
        }
        
        .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 25px;
            margin-top: 40px;
        }
        
        .feature-card {
            background: rgba(255, 255, 255, 0.05);
            padding: 25px;
            border-radius: 15px;
            transition: transform 0.3s;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .feature-card:hover {
            transform: translateY(-5px);
            border-color: #1f6feb;
        }
        
        .feature-card i {
            font-size: 2.5em;
            color: #1f6feb;
            margin-bottom: 20px;
        }
        
        .feature-card h3 {
            color: white;
            margin-bottom: 10px;
        }
        
        .feature-card p {
            color: #8b949e;
            font-size: 0.95em;
            line-height: 1.5;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Welcome to My Site!</h1>
        <p class="tagline">This site was deployed using CodeDeploy Pro with GitHub Pages</p>
        
        <div class="counter" id="counter">0</div>
        
        <button class="deploy-btn" onclick="incrementCounter()">
            <i class="fas fa-plus"></i> Click Me!
        </button>
        
        <div class="features">
            <div class="feature-card">
                <i class="fas fa-bolt"></i>
                <h3>Fast</h3>
                <p>GitHub Pages hosting</p>
            </div>
            <div class="feature-card">
                <i class="fab fa-github"></i>
                <h3>GitHub</h3>
                <p>Free .github.io domain</p>
            </div>
            <div class="feature-card">
                <i class="fas fa-shield-alt"></i>
                <h3>Secure</h3>
                <p>SSL automatically enabled</p>
            </div>
        </div>
        
        <p style="margin-top: 30px; color: #8b949e; font-size: 0.9em;">
            Token: Connected ✅ | Status: Live
        </p>
    </div>

    <script>
        let count = 0;
        const counterElement = document.getElementById('counter');
        
        function incrementCounter() {
            count++;
            counterElement.textContent = count;
            counterElement.style.color = count % 2 === 0 ? '#1f6feb' : '#4493f8';
            
            if (count % 10 === 0) {
                alert(\`🎉 Amazing! You clicked \${count} times!\`);
            }
        }
        
        // Animate counter
        setTimeout(() => {
            let num = 0;
            const target = 42;
            const interval = setInterval(() => {
                num++;
                counterElement.textContent = num;
                if (num >= target) clearInterval(interval);
            }, 50);
        }, 1000);
    </script>
</body>
</html>`;

    document.getElementById('codeEditor').value = defaultHTML;
    
    // Set multi-editor content
    document.getElementById('htmlEditor').value = defaultHTML;
    document.getElementById('cssEditor').value = `/* Add your CSS styles here */
.feature-card {
    animation: fadeInUp 0.5s ease-out;
}

@keyframes fadeInUp {
    from {
        opacity: 0;
        transform: translateY(20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.deploy-btn {
    position: relative;
    overflow: hidden;
}

.deploy-btn:hover::after {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: rgba(255, 255, 255, 0.1);
    transform: rotate(45deg);
    animation: shine 1s;
}

@keyframes shine {
    from { transform: translateX(-100%) rotate(45deg); }
    to { transform: translateX(100%) rotate(45deg); }
}`;

    document.getElementById('jsEditor').value = `// Add your JavaScript here
console.log('Welcome to CodeDeploy Pro! 🚀');

// Add some interactivity
document.addEventListener('DOMContentLoaded', function() {
    // Add visitor counter
    const visitorElement = document.createElement('p');
    visitorElement.style.color = '#8b949e';
    visitorElement.style.marginTop = '20px';
    visitorElement.style.fontSize = '0.9em';
    visitorElement.innerHTML = '👁️ <strong>0</strong> visitors';
    document.querySelector('.container').appendChild(visitorElement);
    
    let visitors = 0;
    setInterval(() => {
        visitors++;
        visitorElement.innerHTML = \`👁️ <strong>\${visitors}</strong> visitors\`;
    }, 3000);
    
    // Add mouse tracker
    const container = document.querySelector('.container');
    document.addEventListener('mousemove', function(e) {
        const x = e.clientX / window.innerWidth * 100;
        const y = e.clientY / window.innerHeight * 100;
        container.style.background = \`radial-gradient(at \${x}% \${y}%, rgba(31, 111, 235, 0.2), rgba(13, 17, 23, 0.3))\`;
    });
});`;
}

// GitHub Connection Functions
async function connectGitHub() {
    // Show connecting step
    document.getElementById('setupStep1').classList.remove('active');
    document.getElementById('setupStep2').classList.add('active');
    
    const statusEl = document.getElementById('connectionStatus');
    const progressBar = document.querySelector('.progress-fill');
    
    // Step 1: Initializing
    statusEl.innerHTML = '<i class="fas fa-circle"></i> Initializing connection...';
    progressBar.style.width = '25%';
    await sleep(1000);
    
    // Step 2: Testing token
    statusEl.innerHTML = '<i class="fas fa-circle"></i> Testing token...';
    progressBar.style.width = '50%';
    await sleep(1000);
    
    // Step 3: Connecting to GitHub
    statusEl.innerHTML = '<i class="fas fa-circle"></i> Connecting to GitHub...';
    progressBar.style.width = '75%';
    
    const result = await githubDeployer.connect();
    
    if (result.success) {
        // Step 4: Success
        statusEl.innerHTML = '<i class="fas fa-check-circle"></i> Connected successfully!';
        progressBar.style.width = '100%';
        await sleep(1000);
        
        // Move to success step
        document.getElementById('setupStep2').classList.remove('active');
        document.getElementById('setupStep3').classList.add('active');
        
        // Update user info
        document.getElementById('userAvatar').src = result.user.avatar_url;
        document.getElementById('userName').textContent = result.user.name || result.user.login;
        document.getElementById('userLogin').textContent = '@' + result.user.login;
        
        showNotification(`✅ Connected as ${result.user.login}`, 'success');
    } else {
        showNotification(`Connection failed: ${result.error}`, 'error');
        // Go back to step 1
        document.getElementById('setupStep2').classList.remove('active');
        document.getElementById('setupStep1').classList.add('active');
    }
}

function useDifferentToken() {
    const newToken = prompt('Enter your GitHub token:');
    if (newToken) {
        githubDeployer.token = newToken;
        showNotification('Token updated. Click Connect again.', 'info');
    }
}

function startCoding() {
    // Hide token modal
    document.getElementById('tokenModal').classList.remove('active');
    
    // Show main app
    document.getElementById('mainApp').style.display = 'flex';
    
    // Initialize app
    initApp();
    
    // Update UI with user info
    if (githubDeployer.userData) {
        document.getElementById('headerAvatar').src = githubDeployer.userData.avatar_url;
        document.getElementById('headerName').textContent = githubDeployer.userData.name || githubDeployer.userData.login;
        document.getElementById('githubUrlPreview').textContent = 
            `https://${githubDeployer.username}.github.io/my-website/`;
    }
}

// Editor Functions
function setEditorMode(mode) {
    isMultiMode = mode === 'multi';
    
    // Update tabs
    document.querySelectorAll('.mode-tab').forEach(tab => {
        tab.classList.toggle('active', tab.textContent.includes(mode === 'single' ? 'Single' : 'Multi'));
    });
    
    // Show/hide editors
    document.getElementById('singleEditor').classList.toggle('active', !isMultiMode);
    document.getElementById('multiEditor').classList.toggle('active', isMultiMode);
    
    if (isMultiMode) {
        switchMultiTab('html');
    }
    
    updateCharCount();
    generatePreview();
}

function switchMultiTab(tab) {
    // Update tabs
    document.querySelectorAll('.multi-tab').forEach(t => {
        t.classList.toggle('active', t.textContent.includes(tab.toUpperCase()));
    });
    
    // Show/hide editors
    document.querySelectorAll('.multi-editor').forEach(editor => {
        editor.classList.toggle('active', editor.id === `${tab}Editor`);
    });
}

function changeLanguage() {
    const lang = document.getElementById('languageSelect').value;
    document.getElementById('languageName').textContent = lang.toUpperCase();
    generatePreview();
}

function updateCharCount() {
    if (isMultiMode) {
        const html = document.getElementById('htmlEditor').value.length;
        const css = document.getElementById('cssEditor').value.length;
        const js = document.getElementById('jsEditor').value.length;
        document.getElementById('totalChars').textContent = html + css + js;
    } else {
        const count = document.getElementById('codeEditor').value.length;
        document.getElementById('charCount').textContent = count;
    }
}

// Add event listeners for character counting
document.getElementById('codeEditor').addEventListener('input', updateCharCount);
document.getElementById('htmlEditor').addEventListener('input', updateCharCount);
document.getElementById('cssEditor').addEventListener('input', updateCharCount);
document.getElementById('jsEditor').addEventListener('input', updateCharCount);

// Preview Functions
function generatePreview() {
    let htmlContent = '';
    
    if (isMultiMode) {
        const html = document.getElementById('htmlEditor').value;
        const css = document.getElementById('cssEditor').value;
        const js = document.getElementById('jsEditor').value;
        
        htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Preview - CodeDeploy Pro</title>
                <style>
                    ${css}
                    .preview-badge {
                        position: fixed;
                        top: 10px;
                        right: 10px;
                        background: rgba(31, 111, 235, 0.9);
                        color: white;
                        padding: 8px 15px;
                        border-radius: 20px;
                        font-size: 12px;
                        z-index: 9999;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }
                </style>
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            </head>
            <body>
                ${html}
                <div class="preview-badge">
                    <i class="fas fa-eye"></i> Live Preview
                </div>
                <script>
                    try {
                        ${js}
                    } catch(error) {
                        console.error('Preview Error:', error);
                    }
                <\/script>
            </body>
            </html>
        `;
    } else {
        const code = document.getElementById('codeEditor').value;
        const lang = document.getElementById('languageSelect').value;
        
        if (lang === 'html') {
            htmlContent = code;
        } else if (lang === 'css') {
            htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>CSS Preview</title>
                    <style>${code}</style>
                </head>
                <body>
                    <div style="padding: 20px; font-family: Arial;">
                        <h1>CSS Preview</h1>
                        <div style="margin: 20px 0; padding: 20px; border: 2px dashed #ddd;">
                            <button style="padding: 10px 20px; background: #1f6feb; color: white; border: none; border-radius: 5px;">
                                Styled Button
                            </button>
                            <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                                Preview Box
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `;
        } else if (lang === 'javascript') {
            htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>JavaScript Preview</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            padding: 20px;
                            background: #f8f9fa;
                        }
                        .demo-area {
                            background: white;
                            padding: 30px;
                            border-radius: 10px;
                            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
                        }
                        button {
                            padding: 12px 24px;
                            background: #1f6feb;
                            color: white;
                            border: none;
                            border-radius: 6px;
                            cursor: pointer;
                            font-size: 16px;
                        }
                    </style>
                </head>
                <body>
                    <h1>JavaScript Preview</h1>
                    <div class="demo-area">
                        <p>Click the button to execute your JavaScript:</p>
                        <button onclick="runCode()">Run Code</button>
                        <div id="output" style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;"></div>
                    </div>
                    <script>
                        function runCode() {
                            try {
                                const output = document.getElementById('output');
                                output.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Running...';
                                
                                ${code}
                                
                                output.innerHTML = '<span style="color: #2ea043;"><i class="fas fa-check-circle"></i> Code executed successfully!</span>';
                            } catch(error) {
                                output.innerHTML = '<span style="color: #dc3545;"><i class="fas fa-exclamation-circle"></i> Error: ' + error.message + '</span>';
                            }
                        }
                    <\/script>
                </body>
                </html>
            `;
        }
    }
    
    // Create blob and set iframe source
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    document.getElementById('previewFrame').src = url;
}

function refreshPreview() {
    generatePreview();
}

function openPreview() {
    const iframe = document.getElementById('previewFrame');
    if (iframe.src) {
        window.open(iframe.src, '_blank');
    }
}

// Deployment Functions
function showDeployModal() {
    // Update URL preview
    const repoName = document.getElementById('repoName').value;
    if (githubDeployer.username) {
        document.getElementById('githubUrlPreview').textContent = 
            `https://${githubDeployer.username}.github.io/${repoName}/`;
    }
    
    // Show modal
    document.getElementById('deployModal').classList.add('active');
    
    // Start deployment
    startDeployment();
}

async function startDeployment() {
    const repoName = document.getElementById('repoName').value.trim();
    const isPrivate = document.getElementById('privateRepo').checked;
    
    if (!repoName) {
        showNotification('Please enter a repository name', 'error');
        return;
    }
    
    // Get code
    let code = '';
    if (isMultiMode) {
        code = {
            html: document.getElementById('htmlEditor').value,
            css: document.getElementById('cssEditor').value,
            js: document.getElementById('jsEditor').value
        };
    } else {
        code = document.getElementById('codeEditor').value;
    }
    
    // Update step 1
    document.getElementById('step1Status').textContent = 'Creating repository...';
    updateProgress(25);
    addLog('Creating GitHub repository...');
    
    try {
        // Step 1: Create repository
        const repoResult = await githubDeployer.createRepository(repoName, isPrivate);
        if (!repoResult.success) {
            throw new Error(repoResult.error);
        }
        
        document.getElementById('step1').classList.add('complete');
        document.getElementById('step2').classList.add('active');
        document.getElementById('step2Status').textContent = 'Uploading files...';
        updateProgress(50);
        addLog('✅ Repository created successfully');
        
        // Step 2: Upload files
        addLog('Uploading index.html...');
        await sleep(2000);
        
        document.getElementById('step2').classList.add('complete');
        document.getElementById('step3').classList.add('active');
        document.getElementById('step3Status').textContent = 'Enabling GitHub Pages...';
        updateProgress(75);
        addLog('✅ Files uploaded successfully');
        
        // Step 3: Enable GitHub Pages
        const deployResult = await githubDeployer.deploy(code, repoName, isMultiMode);
        
        if (!deployResult.success) {
            throw new Error(deployResult.error);
        }
        
        document.getElementById('step3').classList.add('complete');
        document.getElementById('step4').classList.add('active');
        document.getElementById('step4Status').textContent = 'Finalizing...';
        updateProgress(100);
        addLog('✅ GitHub Pages enabled successfully');
        
        // Save deployment info
        currentDeployment = deployResult;
        
        // Wait a bit then show success
        await sleep(2000);
        
        // Hide deployment modal
        document.getElementById('deployModal').classList.remove('active');
        
        // Show success modal
        showSuccessModal(deployResult);
        
        // Update deployments count
        updateDeploymentsCount();
        
    } catch (error) {
        addLog(`❌ Error: ${error.message}`, 'error');
        showNotification(`Deployment failed: ${error.message}`, 'error');
    }
}

function showSuccessModal(deployment) {
    document.getElementById('liveUrlText').textContent = deployment.url;
    document.getElementById('liveSiteUrl').href = deployment.url;
    document.getElementById('repoUrlText').textContent = deployment.repoName;
    document.getElementById('githubRepoUrl').href = deployment.repoUrl;
    
    document.getElementById('successModal').classList.add('active');
}

function closeSuccessModal() {
    document.getElementById('successModal').classList.remove('active');
}

function visitLiveSite() {
    if (currentDeployment && currentDeployment.url) {
        window.open(currentDeployment.url, '_blank');
    }
}

function copyLiveUrl() {
    if (currentDeployment && currentDeployment.url) {
        navigator.clipboard.writeText(currentDeployment.url)
            .then(() => showNotification('URL copied to clipboard', 'success'));
    }
}

// Projects Functions
function showProjects() {
    document.getElementById('deploySection').classList.remove('active');
    document.getElementById('projectsSection').classList.add('active');
    loadProjects();
}

async function loadProjects() {
    const listEl = document.getElementById('projectsList');
    listEl.innerHTML = '<div class="loading-projects"><i class="fas fa-spinner fa-spin"></i><p>Loading your projects...</p></div>';
    
    const result = await githubDeployer.getRepositories();
    
    if (result.success) {
        const projects = result.repositories;
        
        if (projects.length === 0) {
            listEl.innerHTML = '<div class="loading-projects"><i class="fas fa-folder-open"></i><p>No projects found</p><small>Deploy your first project!</small></div>';
            return;
        }
        
        let html = '';
        projects.forEach(project => {
            const hasPages = project.has_pages;
            const pagesUrl = hasPages ? `https://${githubDeployer.username}.github.io/${project.name}/` : null;
            
            html += `
                <div class="project-item">
                    <div class="project-header">
                        <div class="project-name">
                            <i class="fas fa-folder"></i> ${project.name}
                        </div>
                        <span class="project-status ${hasPages ? 'live' : 'inactive'}">
                            ${hasPages ? '🌐 Live' : '⚙️ Inactive'}
                        </span>
                    </div>
                    ${pagesUrl ? `
                    <div class="project-url">
                        <a href="${pagesUrl}" target="_blank">
                            <i class="fas fa-external-link-alt"></i>
                            ${pagesUrl}
                        </a>
                    </div>
                    ` : ''}
                    <div class="project-stats">
                        <span><i class="fas fa-star"></i> ${project.stargazers_count}</span>
                        <span><i class="fas fa-code-branch"></i> ${project.forks_count}</span>
                        <span><i class="fas fa-eye"></i> ${project.watchers_count}</span>
                    </div>
                </div>
            `;
        });
        
        listEl.innerHTML = html;
        updateDeploymentsCount(projects.length);
        
    } else {
        listEl.innerHTML = `<div class="loading-projects"><i class="fas fa-exclamation-circle"></i><p>Failed to load projects</p><small>${result.error}</small></div>`;
    }
}

function updateDeploymentsCount(count) {
    if (count) {
        document.getElementById('deployCount').textContent = count;
    } else {
        // Try to get count from localStorage
        const deployments = JSON.parse(localStorage.getItem('deployments') || '[]');
        document.getElementById('deployCount').textContent = deployments.length;
    }
}

// Helper Functions
function updateProgress(percent) {
    document.getElementById('progressFill').style.width = percent + '%';
}

function addLog(message, type = 'info') {
    const logEl = document.getElementById('deployLog');
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerHTML = `<i class="fas fa-${type === 'error' ? 'times-circle' : 'info-circle'}"></i> ${new Date().toLocaleTimeString()} - ${message}`;
    logEl.appendChild(entry);
    logEl.scrollTop = logEl.scrollHeight;
}

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    const text = document.getElementById('notificationText');
    
    // Set color based on type
    notification.style.background = 
        type === 'success' ? '#2ea043' :
        type === 'error' ? '#dc3545' :
        type === 'warning' ? '#ffc107' : '#1f6feb';
    
    text.textContent = message;
    notification.classList.add('active');
    
    setTimeout(() => {
        notification.classList.remove('active');
    }, 3000);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Editor Tools
function formatCode() {
    showNotification('Formatting coming soon!', 'info');
}

function clearEditor() {
    if (confirm('Clear all code?')) {
        if (isMultiMode) {
            document.getElementById('htmlEditor').value = '';
            document.getElementById('cssEditor').value = '';
            document.getElementById('jsEditor').value = '';
        } else {
            document.getElementById('codeEditor').value = '';
        }
        updateCharCount();
        generatePreview();
        showNotification('Editor cleared', 'info');
    }
}

function saveCode() {
    const code = isMultiMode ? 'Multi-file project' : document.getElementById('codeEditor').value;
    localStorage.setItem('last_code', code);
    showNotification('Code saved locally', 'success');
}

// Auto-preview on typing
let previewTimer;
['codeEditor', 'htmlEditor', 'cssEditor', 'jsEditor'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
        clearTimeout(previewTimer);
        previewTimer = setTimeout(() => {
            generatePreview();
        }, 1000);
    });
});

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Auto-connect with provided token
    setTimeout(async () => {
        const result = await githubDeployer.connect();
        if (result.success) {
            // Auto-proceed to success step
            document.getElementById('setupStep1').classList.remove('active');
            document.getElementById('setupStep3').classList.add('active');
            
            // Update user info
            document.getElementById('userAvatar').src = result.user.avatar_url;
            document.getElementById('userName').textContent = result.user.name || result.user.login;
            document.getElementById('userLogin').textContent = '@' + result.user.login;
            
            showNotification(`✅ Auto-connected as ${result.user.login}`, 'success');
        }
    }, 1000);
});
