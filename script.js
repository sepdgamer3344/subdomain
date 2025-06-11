document.addEventListener('DOMContentLoaded', function () {
    const themeToggle = document.getElementById('themeToggle');
    const body = document.body;
    const savedTheme = localStorage.getItem('theme') || 'dark';
    body.classList.toggle('light-mode', savedTheme === 'light');
    updateThemeButton();

    themeToggle.addEventListener('click', function () {
        body.classList.toggle('light-mode');
        const currentTheme = body.classList.contains('light-mode') ? 'light' : 'dark';
        localStorage.setItem('theme', currentTheme);
        updateThemeButton();
    });

    function updateThemeButton() {
        const isLightMode = body.classList.contains('light-mode');
        themeToggle.innerHTML = isLightMode
            ? '<i class="fas fa-sun"></i> Light Mode'
            : '<i class="fas fa-moon"></i> Dark Mode';
    }

    document.querySelectorAll('.port-preset').forEach(button => {
        button.addEventListener('click', function () {
            document.getElementById('server-port').value = this.dataset.port;
        });
    });

    const subdomainForm = document.getElementById('subdomainForm');
    const responseMessage = document.getElementById('responseMessage');

    subdomainForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const formData = {
            subdomain: document.getElementById('subdomain-name').value.trim().toLowerCase(),
            serverAddress: document.getElementById('server-address').value.trim(),
            serverPort: document.getElementById('server-port').value.trim(),
            email: document.getElementById('email').value.trim(),
            timestamp: new Date().toLocaleString()
        };

        // Only basic validation
        if (!/^[a-z0-9-]+$/.test(formData.subdomain)) {
            showResponse('error', 'Subdomain can only contain lowercase letters, numbers, and hyphens');
            return;
        }

        if (formData.subdomain.length < 3 || formData.subdomain.length > 32) {
            showResponse('error', 'Subdomain must be between 3 and 32 characters');
            return;
        }

        if (formData.serverPort && !/^\d{1,5}$/.test(formData.serverPort)) {
            showResponse('error', 'Port must be a number between 1 and 65535');
            return;
        }

        if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            showResponse('error', 'Please enter a valid email address');
            return;
        }

        const submitBtn = subdomainForm.querySelector('.submit-btn');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

        try {
            await createCloudflareDNSRecord(formData);
            sendToDiscord(formData).catch(console.warn);

            const connectionString = formData.serverPort
                ? `${formData.subdomain}.finitymc.fun:${formData.serverPort}`
                : `${formData.subdomain}.finitymc.fun`;

            showResponse('success', `Subdomain created! Connect via:<br><code>${connectionString}</code>`);
            subdomainForm.reset();
        } catch (error) {
            console.error('Error:', error);
            showResponse('error', 'Error creating subdomain: ' + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create Subdomain';
        }
    });

    async function createCloudflareDNSRecord(data) {
        const cloudflareConfig = {
            apiToken: 'pO12MTiDazKkktAmSGzIAjJ8paftMoxpFoI4W1hU',
            zoneId: 'b38dd3165dd80f7bbeffabd7f691581f',
            domain: 'finitymc.fun'
        };

        // 1. Create A Record
        const aRes = await fetchWithTimeout(
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
                    ttl: 1,
                    proxied: false
                })
            },
            5000
        );

        const aJson = await aRes.json();
        if (!aJson.success) {
            throw new Error(`A record failed: ${JSON.stringify(aJson.errors)}`);
        }

        // 2. Create SRV record (if port given)
        if (data.serverPort) {
            const srvRes = await fetchWithTimeout(
                `https://api.cloudflare.com/client/v4/zones/${cloudflareConfig.zoneId}/dns_records`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${cloudflareConfig.apiToken}`
                    },
                    body: JSON.stringify({
                        type: 'SRV',
                        name: `_minecraft._tcp.${data.subdomain}`,
                        data: {
                            service: '_minecraft',
                            proto: '_tcp',
                            name: data.subdomain,
                            priority: 0,
                            weight: 5,
                            port: parseInt(data.serverPort),
                            target: `${data.subdomain}.${cloudflareConfig.domain}`
                        },
                        ttl: 1
                    })
                },
                5000
            );

            const srvJson = await srvRes.json();
            if (!srvJson.success) {
                throw new Error(`SRV record failed: ${JSON.stringify(srvJson.errors)}`);
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
                { name: 'Subdomain', value: `${data.subdomain}.finitymc.fun`, inline: true },
                { name: 'Points to', value: `${data.serverAddress}:${data.serverPort || '25565'}`, inline: true },
                { name: 'Full Connection', value: `\`${connectionString}\``, inline: false },
                { name: 'Email', value: data.email, inline: true }
            ],
            timestamp: new Date().toISOString(),
            footer: { text: 'Subdomain Request • ' + data.timestamp }
        };

        await fetchWithTimeout(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [embed], username: 'Subdomain Creator' })
        }, 5000);
    }

    function fetchWithTimeout(url, options, timeout) {
        return Promise.race([
            fetch(url, options),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout')), timeout))
        ]);
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
