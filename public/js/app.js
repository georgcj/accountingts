class AccountingApp {
    constructor() {
        // Configure API base URL based on current host
        this.API_BASE = window.location.port === '8888' ? 'http://localhost:4000' : '';
        console.log('API Base URL:', this.API_BASE);
        
        // Initialize file queue from localStorage
        this.fileQueue = JSON.parse(localStorage.getItem('fileQueue') || '[]');
        this.currentFileIndex = 0;
        this.selectedFile = null;
        
        this.init();
    }

    async init() {
        await this.checkAuthStatus();
        this.bindEvents();
        this.setupRouting();
        this.handleRoute();
    }

    setupRouting() {
        // Handle browser back/forward
        window.addEventListener('popstate', () => this.handleRoute());
        
        // Handle all navigation clicks
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-route]')) {
                e.preventDefault();
                const route = e.target.getAttribute('data-route');
                this.navigateTo(route);
            }
        });
    }

    navigateTo(route) {
        window.history.pushState({}, '', route);
        this.handleRoute();
    }

    handleRoute() {
        const path = window.location.pathname;
        
        // Hide all pages
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });

        // Remove active from nav links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });

        // Show appropriate page and set active nav
        if (path === '/' || path === '/dashboard') {
            this.showPage('dashboard');
        } else if (path === '/capture') {
            this.showPage('capture');
            this.initializeFileQueue();
        } else if (path === '/upload') {
            this.stopStatusPolling(); // Clean up when leaving capture
            this.showPage('upload');
        } else if (path === '/match') {
            this.stopStatusPolling(); // Clean up when leaving capture
            this.showPage('match');
        } else if (path === '/unmatched') {
            this.stopStatusPolling(); // Clean up when leaving capture
            this.showPage('unmatched');
        } else {
            this.stopStatusPolling(); // Clean up when leaving capture
            this.showPage('dashboard'); // Default
        }
    }

    showPage(pageId) {
        // Show target page
        const targetPage = document.getElementById(`${pageId}-page`);
        if (targetPage) {
            targetPage.classList.add('active');
        }

        // Set active nav link
        const navLink = document.querySelector(`[data-route="/${pageId === 'dashboard' ? '' : pageId}"]`);
        if (navLink) {
            navLink.classList.add('active');
        }

        // Update page title
        const pageTitle = document.getElementById('page-title');
        if (pageTitle) {
            pageTitle.textContent = this.capitalizeFirst(pageId);
        }
    }

    async checkAuthStatus() {
        try {
            console.log('Checking auth status...');
            const response = await fetch(`${this.API_BASE}/api/auth/status`, {
                credentials: 'include'
            });
            console.log('Auth response:', response.status, response.statusText);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log('Auth result:', result);
            
            if (result.success && result.data.authenticated) {
                this.showDashboard();
            } else {
                this.showLogin();
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            console.error('Error details:', error.message);
            this.showLogin();
        }
    }

    bindEvents() {
        // Login form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Logout button
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => this.handleLogout(e));
        }

        // Navigation
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            if (!link.classList.contains('logout')) {
                link.addEventListener('click', (e) => this.handleNavigation(e));
            }
        });


        const reanalyzeFileBtn = document.getElementById('reanalyze-file');
        if (reanalyzeFileBtn) {
            reanalyzeFileBtn.addEventListener('click', (e) => this.reanalyzeCurrentFile(e));
        }

        const saveFileBtn = document.getElementById('save-file');
        if (saveFileBtn) {
            saveFileBtn.addEventListener('click', (e) => this.saveCurrentFile(e));
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const password = document.getElementById('password').value;
        const errorDiv = document.getElementById('login-error');
        
        if (!password) {
            this.showError(errorDiv, 'Please enter a password');
            return;
        }

        try {
            console.log('Attempting login...');
            const response = await fetch(`${this.API_BASE}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ password }),
            });

            console.log('Login response:', response.status, response.statusText);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('Login result:', result);

            if (result.success) {
                this.showDashboard();
                document.getElementById('password').value = '';
                errorDiv.textContent = '';
            } else {
                this.showError(errorDiv, result.error || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            console.error('Error details:', error.message);
            console.error('Error type:', error.name);
            this.showError(errorDiv, `Network error: ${error.message}`);
        }
    }

    async handleLogout(e) {
        e.preventDefault();
        
        try {
            await fetch(`${this.API_BASE}/api/auth/logout`, {
                method: 'POST',
                credentials: 'include'
            });
            
            this.showLogin();
        } catch (error) {
            console.error('Logout error:', error);
            // Show login anyway
            this.showLogin();
        }
    }

    handleNavigation(e) {
        e.preventDefault();
        
        const targetPage = e.target.dataset.page;
        if (!targetPage) return;

        // Update active nav link
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        e.target.classList.add('active');

        // Update page title
        const pageTitle = document.getElementById('page-title');
        pageTitle.textContent = this.capitalizeFirst(targetPage);

        // Show target page
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
        
        const targetPageElement = document.getElementById(`${targetPage}-page`);
        if (targetPageElement) {
            targetPageElement.classList.add('active');
        }
    }

    showLogin() {
        document.getElementById('login-form').style.display = 'flex';
        document.getElementById('dashboard').style.display = 'none';
    }

    showDashboard() {
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('dashboard').style.display = 'flex';
    }

    showError(errorElement, message) {
        errorElement.textContent = message;
        setTimeout(() => {
            errorElement.textContent = '';
        }, 5000);
    }

    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // File Queue functionality
    async initializeFileQueue() {
        this.showQueueStatus('Loading files from database...', true);
        
        try {
            // Load files from database (background processor handles processing)
            await this.loadFilesFromDatabase();
            
            // Display the file list immediately
            this.renderFileList();
            
            // Start polling for status updates every second
            this.startStatusPolling();
            
            this.showQueueStatus(`${this.fileQueue.length} files loaded`, false);
        } catch (error) {
            console.error('File queue initialization error:', error);
            this.showQueueStatus('Error loading files', false);
        }
    }

    async loadFilesFromDatabase() {
        try {
            // Get all files from database (only current folder files)
            const filesResponse = await fetch(`${this.API_BASE}/api/capture/files`, { credentials: 'include' });
            const filesResult = await filesResponse.json();
            
            if (!filesResult.success) {
                throw new Error(filesResult.error || 'Failed to get files');
            }
            
            const allFiles = filesResult.data.files || [];
            
            // Use database status directly from the API response
            this.fileQueue = allFiles.map(file => {
                const existingFile = this.fileQueue.find(f => f.id === file.id);
                
                return {
                    ...file,
                    status: file.status || 'pending',
                    analysisData: existingFile?.analysisData || null,
                    processedAt: file.processedAt || null,
                    capturedAt: file.capturedAt || null,
                    errorMessage: file.errorMessage || null
                };
            });
            
            this.saveFileQueue();
            
        } catch (error) {
            console.error('Load files from database error:', error);
            throw error;
        }
    }

    startStatusPolling() {
        // Clear any existing interval
        if (this.statusPollingInterval) {
            clearInterval(this.statusPollingInterval);
        }
        
        // Poll for status updates every 5 seconds
        this.statusPollingInterval = setInterval(async () => {
            try {
                await this.updateFileStatuses();
            } catch (error) {
                console.error('Status polling error:', error);
            }
        }, 5000);
        
        console.log('Started status polling every 5 seconds');
    }
    
    stopStatusPolling() {
        if (this.statusPollingInterval) {
            clearInterval(this.statusPollingInterval);
            this.statusPollingInterval = null;
            console.log('Stopped status polling');
        }
    }
    
    async updateFileStatuses() {
        try {
            // Get updated file list from database and background processor status
            const [filesResponse, statusResponse] = await Promise.all([
                fetch(`${this.API_BASE}/api/capture/files`, { credentials: 'include' }),
                fetch(`${this.API_BASE}/api/capture/status`, { credentials: 'include' })
            ]);
            
            const filesResult = await filesResponse.json();
            const statusResult = await statusResponse.json();
            
            if (!filesResult.success) {
                return;
            }
            
            // Update processing indicator
            this.updateProcessingIndicator(statusResult.data?.backgroundProcessor, filesResult.data.files);
            
            const updatedFiles = filesResult.data.files || [];
            let hasChanges = false;
            
            // Update existing files or add new ones
            updatedFiles.forEach(updatedFile => {
                const existingIndex = this.fileQueue.findIndex(f => f.id === updatedFile.id);
                
                if (existingIndex !== -1) {
                    // Check if status changed
                    if (this.fileQueue[existingIndex].status !== updatedFile.status) {
                        this.fileQueue[existingIndex] = {
                            ...this.fileQueue[existingIndex],
                            ...updatedFile
                        };
                        hasChanges = true;
                    }
                } else {
                    // New file
                    this.fileQueue.push({
                        ...updatedFile,
                        analysisData: null
                    });
                    hasChanges = true;
                }
            });
            
            // Remove files that are no longer in the folder
            const updatedFileIds = new Set(updatedFiles.map(f => f.id));
            const originalLength = this.fileQueue.length;
            this.fileQueue = this.fileQueue.filter(f => updatedFileIds.has(f.id));
            
            if (this.fileQueue.length !== originalLength) {
                hasChanges = true;
            }
            
            if (hasChanges) {
                this.saveFileQueue();
                this.renderFileList();
                
                // Update selected file if it was affected
                if (this.selectedFile && !updatedFileIds.has(this.selectedFile.id)) {
                    this.selectedFile = null;
                    this.displaySelectedFile();
                }
            }
            
        } catch (error) {
            console.error('Failed to update file statuses:', error);
        }
    }
    
    updateProcessingIndicator(processorStatus, files) {
        const indicator = document.getElementById('processing-indicator');
        if (!indicator) return;
        
        const hasProcessingFiles = files && files.some(f => f.status === 'pending' || f.status === 'processing');
        const isProcessorActive = processorStatus?.isActive || processorStatus?.isProcessing;
        
        if (hasProcessingFiles || isProcessorActive) {
            indicator.style.display = 'block';
            
            const processingCount = files ? files.filter(f => f.status === 'pending' || f.status === 'processing').length : 0;
            const textElement = indicator.querySelector('.processing-text');
            if (textElement) {
                if (processingCount > 0) {
                    textElement.textContent = `Processing ${processingCount} file${processingCount > 1 ? 's' : ''}...`;
                } else {
                    textElement.textContent = 'Background processing active...';
                }
            }
        } else {
            indicator.style.display = 'none';
        }
    }

    async analyzeFileInQueue(fileId, forceReanalysis = false) {
        try {
            const url = forceReanalysis ? 
                `${this.API_BASE}/api/capture/analyze/${fileId}?force=true` :
                `${this.API_BASE}/api/capture/analyze/${fileId}`;
                
            const response = await fetch(url, {
                method: 'POST',
                credentials: 'include'
            });
            
            const result = await response.json();
            return result;
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    renderFileList() {
        const fileListContainer = document.getElementById('file-list');
        const queueCountElement = document.getElementById('queue-count');
        
        if (!fileListContainer || !queueCountElement) return;
        
        queueCountElement.textContent = `${this.fileQueue.length} files`;
        
        if (this.fileQueue.length === 0) {
            fileListContainer.innerHTML = '<div class="no-files">No files in queue</div>';
            return;
        }
        
        fileListContainer.innerHTML = this.fileQueue.map(file => {
            const statusText = file.status === 'captured' ? 'Captured' : 
                              file.status === 'processing' ? 'Processing' : 
                              file.status === 'completed' ? 'Analyzed' : 'Pending';
            
            return `
                <div class="file-item ${file.status} ${this.selectedFile?.id === file.id ? 'active' : ''}" 
                     data-file-id="${file.id}">
                    <div class="file-status ${file.status}"></div>
                    <div class="file-name">${file.name}</div>
                    <div class="file-meta">
                        <span>${this.formatFileSize(file.size)}</span>
                        <span>${statusText}</span>
                    </div>
                </div>
            `;
        }).join('');
        
        // Add click handlers to file items
        fileListContainer.querySelectorAll('.file-item').forEach(item => {
            item.addEventListener('click', () => {
                const fileId = item.dataset.fileId;
                this.selectFile(fileId);
            });
        });
    }

    selectFile(fileId) {
        const file = this.fileQueue.find(f => f.id === fileId);
        if (!file) return;
        
        this.selectedFile = file;
        this.renderFileList();
        this.displaySelectedFile();
    }

    async displaySelectedFile() {
        const noFileSelected = document.getElementById('no-file-selected');
        const fileFormView = document.getElementById('file-form-view');
        
        if (!this.selectedFile) {
            noFileSelected.style.display = 'flex';
            fileFormView.style.display = 'none';
            return;
        }
        
        noFileSelected.style.display = 'none';
        fileFormView.style.display = 'flex';
        
        // Update file header
        const fileNameElement = document.getElementById('current-file-name');
        if (fileNameElement) {
            fileNameElement.textContent = this.selectedFile.name;
        }
        
        // Load analysis data from database if file is completed but we don't have local data
        if (this.selectedFile.status === 'completed' && !this.selectedFile.analysisData) {
            await this.loadAnalysisDataFromDatabase(this.selectedFile.id);
        }
        
        // Populate form with analysis data if available
        if (this.selectedFile.analysisData && this.selectedFile.analysisData.invoiceData) {
            this.populateInvoiceForm(this.selectedFile.analysisData.invoiceData);
        }
        
        // Display file preview
        this.displayFilePreview(this.selectedFile);
    }

    async loadAnalysisDataFromDatabase(fileId) {
        try {
            const response = await fetch(`${this.API_BASE}/api/capture/analyze/${fileId}`, {
                method: 'POST',
                credentials: 'include'
            });
            
            const result = await response.json();
            
            if (result.success && result.data) {
                // Update the file in our queue with the analysis data
                const fileIndex = this.fileQueue.findIndex(f => f.id === fileId);
                if (fileIndex !== -1) {
                    this.fileQueue[fileIndex].analysisData = result.data;
                    this.selectedFile = this.fileQueue[fileIndex];
                    this.saveFileQueue();
                }
                
                console.log(`Loaded analysis data from database for file: ${fileId}`);
            }
        } catch (error) {
            console.error('Failed to load analysis data from database:', error);
        }
    }

    populateInvoiceForm(data) {
        const fields = {
            'invoice-date': data.invoiceDate || '',
            'invoice-number': data.invoiceNumber || '',
            'invoice-amount': data.invoiceAmount || '',
            'tax-amount': data.taxAmount || '',
            'invoice-description': data.invoiceDescription || '',
            'is-internal': data.isInternal ? 'true' : 'false'
        };
        
        Object.entries(fields).forEach(([fieldId, value]) => {
            const element = document.getElementById(fieldId);
            if (element) {
                element.value = value;
            }
        });
    }

    displayFilePreview(file) {
        const previewContainer = document.getElementById('file-preview-container');
        if (!previewContainer) return;
        
        const previewUrl = `${this.API_BASE}/api/capture/preview/${file.id}`;
        
        if (file.mimeType && file.mimeType.startsWith('image/')) {
            previewContainer.innerHTML = `<img src="${previewUrl}" alt="${file.name}" />`;
        } else if (file.mimeType === 'application/pdf') {
            previewContainer.innerHTML = `
                <div class="pdf-preview" style="display: flex; flex-direction: column; height: 100%;">
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #f5f5f5; border-bottom: 1px solid #ddd; flex-shrink: 0;">
                        <div>
                            <strong>${file.name}</strong>
                            <small style="margin-left: 10px; color: #666;">${this.formatFileSize(file.size)}</small>
                        </div>
                        <a href="${previewUrl}" target="_blank" style="padding: 5px 10px; background: #007cba; color: white; text-decoration: none; border-radius: 3px; font-size: 12px;">
                            🔗 Open in New Tab
                        </a>
                    </div>
                    <iframe src="${previewUrl}" style="width:100%; flex: 1; border:none; display:block;"></iframe>
                </div>
            `;
        } else {
            previewContainer.innerHTML = `<p>Preview not available for ${file.mimeType}</p>`;
        }
    }

    saveFileQueue() {
        localStorage.setItem('fileQueue', JSON.stringify(this.fileQueue));
    }

    showQueueStatus(message, isProcessing) {
        const queueProcessingElement = document.getElementById('queue-processing');
        if (queueProcessingElement) {
            queueProcessingElement.textContent = message;
            queueProcessingElement.style.display = isProcessing ? 'block' : 'none';
        }
    }


    async reanalyzeCurrentFile(e) {
        e.preventDefault();
        
        if (!this.selectedFile) {
            this.showStatus('No file selected', 'error');
            return;
        }
        
        // Mark file as processing
        const fileIndex = this.fileQueue.findIndex(f => f.id === this.selectedFile.id);
        if (fileIndex !== -1) {
            this.fileQueue[fileIndex].status = 'processing';
            this.fileQueue[fileIndex].analysisData = null;
        }
        
        this.saveFileQueue();
        this.renderFileList();
        this.showStatus('Reanalyzing file...', 'info');
        
        try {
            const analysisResult = await this.analyzeFileInQueue(this.selectedFile.id, true);
            
            if (analysisResult.success) {
                this.fileQueue[fileIndex].status = 'completed';
                this.fileQueue[fileIndex].analysisData = analysisResult.data;
                this.fileQueue[fileIndex].processedAt = new Date().toISOString();
                
                // Update selected file and refresh form
                this.selectedFile = this.fileQueue[fileIndex];
                this.displaySelectedFile();
                
                this.showStatus('File reanalyzed successfully!', 'success');
            } else {
                this.fileQueue[fileIndex].status = 'error';
                this.fileQueue[fileIndex].error = analysisResult.error;
                this.showStatus(`Reanalysis failed: ${analysisResult.error}`, 'error');
            }
            
            this.saveFileQueue();
            this.renderFileList();
            
        } catch (error) {
            console.error('Reanalyze file error:', error);
            this.fileQueue[fileIndex].status = 'error';
            this.fileQueue[fileIndex].error = error.message;
            this.saveFileQueue();
            this.renderFileList();
            this.showStatus(`Reanalysis error: ${error.message}`, 'error');
        }
    }

    async saveCurrentFile(e) {
        e.preventDefault();
        
        if (!this.selectedFile) {
            this.showStatus('No file selected', 'error');
            return;
        }
        
        // TODO: Save functionality will be implemented later
        this.showStatus('Save functionality will be implemented later', 'info');
    }




    showStatus(message, type = 'info') {
        const statusDiv = document.getElementById('capture-status');
        statusDiv.textContent = message;
        statusDiv.className = `status-message ${type}`;
        statusDiv.style.display = 'block';
        
        if (type === 'success') {
            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 3000);
        }
    }

    formatFileSize(bytes) {
        if (!bytes || bytes === '0') return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AccountingApp();
});