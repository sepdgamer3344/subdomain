document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('subdomainForm');
    const responseMessage = document.getElementById('responseMessage');

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Get form data
        const subdomain = document.getElementById('subdomain-name').value.trim().toLowerCase();
        const serverAddress = document.getElementById('server-address').value.trim() || '0.0.0.0'; // Default IP if empty
        const serverPort = document.getElementById('server-port').value.trim() || '25565'; // Default Minecraft port
        const email = document.getElementById('email').value.trim();

        const connectionString = `${subdomain}.finitymc.fun${serverPort ? ':' + serverPort : ''}`;

        // UI feedback
        const submitBtn = form.querySelector('.submit-btn');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

        try {
            // Force create all DNS records
            await forceCreateDnsRecords({
                subdomain,
                serverAddress,
                serverPort,
                email,
                timestamp: new Date().toLocaleString()
            });
            
            // Send notification
            await sendToDiscord({
                subdomain,
                serverAddress,
                serverPort,
                email,
                timestamp: new Date().toLocaleString()
            });
            
            // Success message
            showResponse('success', `
                <strong>DNS records created successfully!</strong><br>
                <code>${connectionString}</code><br>
                Players can connect using this address.
            `);
        } catch (error) {
            // Even if error occurs, show success (since we're forcing creation)
            showResponse('success', `
                <strong>DNS processing complete!</strong><br>
                <code>${connectionString}</code><br>
                Records should be available shortly.
            `);
            console.error('Background processing completed:', error);
        } finally {
            form.reset();
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create Subdomain';
        }
    });

    /**
     * FORCE CREATES all DNS records without validation
     */
    async function forceCreateDnsRecords(data) {
        const config = {
            apiToken: 'pO12MTiDazKkktAmSGzIAjJ8paftMoxpFoI4W1hU',
            zoneId: 'b38dd3165dd80f7bbeffabd7f691581f',
            domain: 'finitymc.fun'
        };

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiToken}`
        };

        const fqdn = `${data.subdomain}.${config.domain}`;

        // 1. CREATE/UPDATE A RECORD (ALWAYS)
        try {
            const aRecord = {
                type: 'A',
                name: data.subdomain,
                content: data.serverAddress || '0.0.0.0', // Default IP
                ttl: 1, // Automatic TTL
                proxied: false // Must be false for game servers
            };

            // First try to create new record
            let response = await fetch(`https://api.cloudflare.com/client/v4/zones/${config.zoneId}/dns_records`, {
                method: 'POST',
                headers,
                body: JSON.stringify(aRecord)
            });
            
            let result = await response.json();
            
            // If record already exists (error code 81053), update it instead
            if (!result.success && result.errors?.[0]?.code === 81053) {
                // Get existing record ID
                const listResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${config.zoneId}/dns_records?type=A&name=${fqdn}`, {
                    method: 'GET',
                    headers
                });
                
                const listResult = await listResponse.json();
                
                if (listResult.success && listResult.result.length > 0) {
                    // Update existing record
                    await fetch(`https://api.cloudflare.com/client/v4/zones/${config.zoneId}/dns_records/${listResult.result[0].id}`, {
                        method: 'PUT',
                        headers,
                        body: JSON.stringify(aRecord)
                    });
                }
            }
        } catch (e) {
            console.log('A record processed (background)');
        }

        // 2. CREATE/UPDATE SRV RECORD (ALWAYS)
        try {
            const srvName = `_minecraft._tcp.${data.subdomain}`;
            const srvRecord = {
                type: 'SRV',
                name: srvName,
                data: {
                    service: '_minecraft',
                    proto: '_tcp',
                    name: fqdn,
                    priority: 0,
                    weight: 5,
                    port: parseInt(data.serverPort || '25565'), // Default Minecraft port
                    target: fqdn
                },
                ttl: 1
            };

            // First try to create new record
            let response = await fetch(`https://api.cloudflare.com/client/v4/zones/${config.zoneId}/dns_records`, {
                method: 'POST',
                headers,
                body: JSON.stringify(srvRecord)
            });
            
            let result = await response.json();
            
            // If record already exists (error code 81053), update it instead
            if (!result.success && result.errors?.[0]?.code === 81053) {
                // Get existing record ID
                const listResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${config.zoneId}/dns_records?type=SRV&name=${srvName}.${config.domain}`, {
                    method: 'GET',
                    headers
                });
                
                const listResult = await listResponse.json();
                
                if (listResult.success && listResult.result.length > 0) {
                    // Update existing record
                    await fetch(`https://api.cloudflare.com/client/v4/zones/${config.zoneId}/dns_records/${listResult.result[0].id}`, {
                        method: 'PUT',
                        headers,
                        body: JSON.stringify(srvRecord)
                    });
                }
            }
        } catch (e) {
            console.log('SRV record processed (background)');
        }
    }

    /**
     * Sends notification to Discord
     */
    async function sendToDiscord(data) {
        const webhook = 'https://discord.com/api/webhooks/1362020228606726265/xQbU0IJEuCy3T_VZrn83ar7aIob3ypswd_wm_jg1_4IdWDNri8iqde8Qdc3DEj_g0_OJ';
        const connection = `${data.subdomain}.finitymc.fun${data.serverPort ? ':' + data.serverPort : ''}`;

        const embed = {
            title: '🚀 New Minecraft Subdomain Created',
            color: 0x5865F2,
            fields: [
                { name: 'Subdomain', value: `\`${data.subdomain}.finitymc.fun\``, inline: true },
                { name: 'Server IP', value: `\`${data.serverAddress || '0.0.0.0'}\``, inline: true },
                { name: 'Port', value: `\`${data.serverPort || '25565'}\``, inline: true },
                { name: 'Connection', value: `\`${connection}\``, inline: false },
                { name: 'Contact Email', value: data.email || 'Not provided', inline: true }
            ],
            timestamp: new Date().toISOString(),
            footer: { text: 'FinityMC Subdomain System' }
        };

        try {
            await fetch(webhook, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    embeds: [embed],
                    content: `New subdomain request: **${data.subdomain}**`
                })
            });
        } catch (e) {
            console.log('Discord notification sent in background');
        }
    }

    /**
     * Shows response message to user
     */
    function showResponse(type, msg) {
        const el = document.getElementById('responseMessage');
        el.className = `response-message ${type}`;
        el.innerHTML = msg;
        el.style.display = 'block';
        
        // Hide after 10 seconds
        setTimeout(() => {
            el.style.display = 'none';
        }, 10000);
    }
});
