document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('subdomainForm');
    const responseMessage = document.getElementById('responseMessage');

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const subdomain = document.getElementById('subdomain-name').value.trim().toLowerCase();
        const serverAddress = document.getElementById('server-address').value.trim() || '0.0.0.0';
        const serverPort = document.getElementById('server-port').value.trim() || '25565';
        const email = document.getElementById('email').value.trim();
        const connectionString = `${subdomain}.finitymc.fun${serverPort !== '25565' ? ':' + serverPort : ''}`;

        const submitBtn = form.querySelector('.submit-btn');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

        try {
            await forceCreateDnsRecords({
                subdomain,
                serverAddress,
                serverPort,
                email,
                timestamp: new Date().toLocaleString()
            });
            
            await sendToDiscord({
                subdomain,
                serverAddress,
                serverPort,
                email,
                timestamp: new Date().toLocaleString()
            });
            
            showResponse('success', `
                <strong>DNS records created successfully!</strong><br>
                <code>${connectionString}</code><br>
                Players can connect using this address.
            `);
        } catch (error) {
            showResponse('error', `
                <strong>Error processing DNS records!</strong><br>
                Please try again or contact support.
                Error: ${error.message}
            `);
            console.error('DNS processing error:', error);
        } finally {
            form.reset();
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create Subdomain';
        }
    });

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

        // Create/Update A Record
        const aRecord = {
            type: 'A',
            name: data.subdomain,
            content: data.serverAddress,
            ttl: 1,
            proxied: false
        };

        try {
            let response = await fetch(`https://api.cloudflare.com/client/v4/zones/${config.zoneId}/dns_records`, {
                method: 'POST',
                headers,
                body: JSON.stringify(aRecord)
            });
            
            let result = await response.json();
            
            if (!result.success && result.errors?.[0]?.code === 81053) {
                const listResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${config.zoneId}/dns_records?type=A&name=${fqdn}`, {
                    method: 'GET',
                    headers
                });
                
                const listResult = await listResponse.json();
                
                if (listResult.success && listResult.result.length > 0) {
                    await fetch(`https://api.cloudflare.com/client/v4/zones/${config.zoneId}/dns_records/${listResult.result[0].id}`, {
                        method: 'PUT',
                        headers,
                        body: JSON.stringify(aRecord)
                    });
                }
            }
        } catch (e) {
            console.error('A record creation failed:', e);
            throw new Error('Failed to create/update A record');
        }

        // Create/Update SRV Record
        const srvRecord = {
            type: 'SRV',
            name: `_minecraft._tcp.${data.subdomain}.${config.domain}`,
            data: {
                service: '_minecraft',
                proto: '_tcp',
                name: data.subdomain,
                priority: 0,
                weight: 5,
                port: parseInt(data.serverPort),
                target: fqdn
            },
            ttl: 1
        };

        try {
            let response = await fetch(`https://api.cloudflare.com/client/v4/zones/${config.zoneId}/dns_records`, {
                method: 'POST',
                headers,
                body: JSON.stringify(srvRecord)
            });
            
            let result = await response.json();
            
            if (!result.success && result.errors?.[0]?.code === 81053) {
                const listResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${config.zoneId}/dns_records?type=SRV&name=_minecraft._tcp.${fqdn}`, {
                    method: 'GET',
                    headers
                });
                
                const listResult = await listResponse.json();
                
                if (listResult.success && listResult.result.length > 0) {
                    await fetch(`https://api.cloudflare.com/client/v4/zones/${config.zoneId}/dns_records/${listResult.result[0].id}`, {
                        method: 'PUT',
                        headers,
                        body: JSON.stringify(srvRecord)
                    });
                }
            }
        } catch (e) {
            console.error('SRV record creation failed:', e);
            throw new Error('Failed to create/update SRV record');
        }
    }

    async function sendToDiscord(data) {
        const webhook = 'https://discord.com/api/webhooks/1362020228606726265/xQbU0IJEuCy3T_VZrn83ar7aIob3ypswd_wm_jg1_4IdWDNri8iqde8Qdc3DEj_g0_OJ';
        const connection = `${data.subdomain}.finitymc.fun${data.serverPort !== '25565' ? ':' + data.serverPort : ''}`;

        const embed = {
            title: 'ðŸš€ New Minecraft Subdomain Created',
            color: 0x5865F2,
            fields: [
                { name: 'Subdomain', value: `\`${data.subdomain}.finitymc.fun\``, inline: true },
                { name: 'Server IP', value: `\`${data.serverAddress}\``, inline: true },
                { name: 'Port', value: `\`${data.serverPort}\``, inline: true },
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
            console.error('Discord notification failed:', e);
        }
    }

    function showResponse(type, msg) {
        const el = document.getElementById('responseMessage');
        el.className = `response-message ${type}`;
        el.innerHTML = msg;
        el.style.display = 'block';
        
        setTimeout(() => {
            el.style.display = 'none';
        }, 10000);
    }
});
