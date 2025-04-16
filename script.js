document.addEventListener('DOMContentLoaded', function() {
    // Theme toggle functionality
    const themeToggle = document.getElementById('themeToggle');
    const body = document.body;
    
    // Check for saved theme preference or use dark mode as default
    const savedTheme = localStorage.getItem('theme') || 'dark';
    body.classList.toggle('light-mode', savedTheme === 'light');
    updateThemeButton();
    
    themeToggle.addEventListener('click', function() {
        body.classList.toggle('light-mode');
        const currentTheme = body.classList.contains('light-mode') ? 'light' : 'dark';
        localStorage.setItem('theme', currentTheme);
        updateThemeButton();
    });
    
    function updateThemeButton() {
        const isLightMode = body.classList.contains('light-mode');
        themeToggle.innerHTML = isLightMode ? 
            '<i class="fas fa-sun"></i> Light Mode' : 
            '<i class="fas fa-moon"></i> Dark Mode';
    }
    
    // Port preset buttons functionality
    document.querySelectorAll('.port-preset').forEach(button => {
        button.addEventListener('click', function() {
            document.getElementById('server-port').value = this.dataset.port;
        });
    });
    
    // Form submission with Discord webhook integration
    const subdomainForm = document.getElementById('subdomainForm');
    const responseMessage = document.getElementById('responseMessage');
    
    subdomainForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Get form data
        const formData = {
            subdomain: document.getElementById('subdomain-name').value.trim().toLowerCase(),
            serverAddress: document.getElementById('server-address').value.trim(),
            serverPort: document.getElementById('server-port').value.trim(),
            email: document.getElementById('email').value.trim(),
            timestamp: new Date().toLocaleString()
        };
        
        // Validate subdomain format
        if (!/^[a-z0-9-]+$/.test(formData.subdomain)) {
            showResponse('error', 'Subdomain can only contain lowercase letters, numbers, and hyphens');
            return;
        }
        
        // Validate subdomain length
        if (formData.subdomain.length < 3 || formData.subdomain.length > 32) {
            showResponse('error', 'Subdomain must be between 3 and 32 characters');
            return;
        }
        
        // Validate server address (basic validation)
        if (formData.serverAddress.length < 2) {
            showResponse('error', 'Please enter a valid server address');
            return;
        }
        
        // Validate port if provided
        if (formData.serverPort && !/^\d{1,5}$/.test(formData.serverPort)) {
            showResponse('error', 'Port must be a number between 1 and 65535');
            return;
        }
        
        // Show loading state
        const submitBtn = subdomainForm.querySelector('.submit-btn');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
        
        // Send to Discord webhook
        sendToDiscord(formData);
    });
    
    function sendToDiscord(data) {
        // Replace with your actual Discord webhook URL
        const webhookUrl = 'https://discord.com/api/webhooks/1362020228606726265/xQbU0IJEuCy3T_VZrn83ar7aIob3ypswd_wm_jg1_4IdWDNri8iqde8Qdc3DEj_g0_OJ';
        
        // Create full connection string
        const connectionString = data.serverPort 
            ? `${data.subdomain}.mcdomain.net:${data.serverPort}`
            : `${data.subdomain}.mcdomain.net`;
        
        // Create Discord embed
        const embed = {
            title: 'New Subdomain Request',
            color: 0x7289DA, // Discord blurple
            fields: [
                {
                    name: 'Subdomain',
                    value: `${data.subdomain}.mcdomain.net`,
                    inline: true
                },
                {
                    name: 'Points to',
                    value: data.serverAddress + (data.serverPort ? `:${data.serverPort}` : ''),
                    inline: true
                },
                {
                    name: 'Full Connection',
                    value: `\`${connectionString}\``,
                    inline: false
                },
                {
                    name: 'Email',
                    value: data.email || 'Not provided',
                    inline: true
                }
            ],
            timestamp: new Date().toISOString(),
            footer: {
                text: 'Subdomain Request • ' + data.timestamp
            }
        };
        
        // Create payload
        const payload = {
            embeds: [embed],
            username: 'Subdomain Creator',
            avatar_url: 'https://i.imgur.com/J1wY1Qy.png'
        };
        
        // Send to Discord
        fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to send to Discord');
            }
            return response;
        })
        .then(() => {
            showResponse('success', 
                `Subdomain created! Players can connect using:<br><code>${connectionString}</code>`);
            subdomainForm.reset();
        })
        .catch(error => {
            console.error('Error:', error);
            showResponse('error', 'Failed to create subdomain. Please try again later.');
        })
        .finally(() => {
            const submitBtn = subdomainForm.querySelector('.submit-btn');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create Subdomain';
        });
    }
    
    function showResponse(type, message) {
        responseMessage.innerHTML = message;
        responseMessage.className = 'response-message ' + type;
        responseMessage.style.display = 'block';
        
        // Hide message after 8 seconds
        setTimeout(() => {
            responseMessage.style.display = 'none';
        }, 8000);
    }
});