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
    
    // Form submission with Cloudflare and Discord integration
    const subdomainForm = document.getElementById('subdomainForm');
    const responseMessage = document.getElementById('responseMessage');
    
    subdomainForm.addEventListener('submit', async function(e) {
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
        
        // Validate email
        if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            showResponse('error', 'Please enter a valid email address');
            return;
        }
        
        // Show loading state
        const submitBtn = subdomainForm.querySelector('.submit-btn');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
        
        try {
            // First create the DNS records in Cloudflare
            await createCloudflareDNSRecord(formData);
            
            // Then send notification to Discord
            await sendToDiscord(formData);
            
            // Show success message
            const connectionString = formData.serverPort 
                ? `${formData.subdomain}.finitymc.fun:${formData.serverPort}`
                : `${formData.subdomain}.finitymc.fun`;
            
            showResponse('success', 
                `Subdomain created successfully! Players can connect using:<br><code>${connectionString}</code>`);
            subdomainForm.reset();
        } catch (error) {
            console.error('Error:', error);
            showResponse('error', error.message || 'Failed to create subdomain. Please try again later.');
        } finally {
            const submitBtn = subdomainForm.querySelector('.submit-btn');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create Subdomain';
        }
    });
    
    async function createCloudflareDNSRecord(data) {
        // Cloudflare API configuration
        const cloudflareConfig = {
            apiToken: 'pO12MTiDazKkktAmSGzIAjJ8paftMoxpFoI4W1hU',
            zoneId: 'b38dd3165dd80f7bbeffabd7f691581f',
            domain: 'finitymc.fun'
        };
        
        // 1. Create A record
        const aRecordResponse = await fetch(
            `https://api.cloudflare.com/client/v4/zones/${cloudflareConfig.zoneId}/dns_records`, 
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${cloudflareConfig.apiToken}`
                },
                body: JSON.stringify({
                    type: 'A',
                    name: data.subdomain,
                    content: data.serverAddress,
                    ttl: 1, // Auto TTL
                    proxied: false // Important for game servers
                })
            }
        );
        
        const aRecordResult = await aRecordResponse.json();
        
        if (!aRecordResponse.ok || !aRecordResult.success) {
            throw new Error(aRecordResult.errors?.[0]?.message || 'Failed to create A record in Cloudflare');
        }
        
        // 2. Create SRV record if port is specified
        if (data.serverPort) {
            const srvRecordResponse = await fetch(
                `https://api.cloudflare.com/client/v4/zones/${cloudflareConfig.zoneId}/dns_records`, 
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${cloudflareConfig.apiToken}`
                    },
                    body: JSON.stringify({
                        type: 'SRV',
                        data: {
                            name: `_minecraft._tcp.${data.subdomain}`,
                            service: '_minecraft',
                            proto: '_tcp',
                            priority: 10,
                            weight: 5,
                            port: parseInt(data.serverPort),
                            target: `${data.subdomain}.${cloudflareConfig.domain}`
                        },
                        ttl: 1
                    })
                }
            );
            
            const srvRecordResult = await srvRecordResponse.json();
            
            if (!srvRecordResponse.ok || !srvRecordResult.success) {
                throw new Error(srvRecordResult.errors?.[0]?.message || 'Failed to create SRV record in Cloudflare');
            }
        }
        
        return true;
    }
    
    async function sendToDiscord(data) {
        const webhookUrl = 'https://discord.com/api/webhooks/1362020228606726265/xQbU0IJEuCy3T_VZrn83ar7aIob3ypswd_wm_jg1_4IdWDNri8iqde8Qdc3DEj_g0_OJ';
        
        const connectionString = data.serverPort 
            ? `${data.subdomain}.finitymc.fun:${data.serverPort}`
            : `${data.subdomain}.finitymc.fun`;
        
        const embed = {
            title: 'New Subdomain Request',
            color: 0x7289DA,
            fields: [
                {
                    name: 'Subdomain',
                    value: `${data.subdomain}.finitymc.fun`,
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
                    value: data.email,
                    inline: true
                }
            ],
            timestamp: new Date().toISOString(),
            footer: {
                text: 'Subdomain Request • ' + data.timestamp
            }
        };
        
        const payload = {
            embeds: [embed],
            username: 'Subdomain Creator',
            avatar_url: 'https://i.imgur.com/J1wY1Qy.png'
        };
        
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            throw new Error('Failed to send notification to Discord');
        }
    }
    
    function showResponse(type, message) {
        responseMessage.innerHTML = message;
        responseMessage.className = 'response-message ' + type;
        responseMessage.style.display = 'block';
        
        setTimeout(() => {
            responseMessage.style.display = 'none';
        }, 8000);
    }
});
