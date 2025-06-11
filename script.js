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

        // Input validation
        if (!isValidSubdomain(subdomain)) {
            showResponse('error', 'Invalid subdomain. Use alphanumeric characters and hyphens only.');
            return;
        }
        if (!isValidIp(serverAddress)) {
            showResponse('error', 'Invalid server IP address.');
            return;
        }
        if (!isValidPort(serverPort)) {
            showResponse('error', 'Invalid port. Use a number between 1 and 65535.');
            return;
        }

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
                ${error.message || 'Please try again or contact support.'}
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
            await retryApiCall(async () => {
                let response = await fetch(`https://api.cloudflare.com/client/v4/zones/${config.zoneId}/dns_records`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(aRecord)
                });
                
                let result = await response.json();
                
                if (!result.success) {
                    if (result.errors?.[0]?.code === 81053) {
                        // Record exists, update it
                        const listResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${config.zoneId}/dns_records?type=A&name=${fqdn}`, {
                            method: 'GET',
                            headers
                        });
                        
                        const listResult = await listResponse.json();
                        
                        if (listResult.success && listResult.result.length > 0) {
                            response = await fetch(`https://api.cloudflare.com/client/v4/zones/${config.zoneId}/dns_records/${listResult.result[0].id}`, {
                                method: 'PUT',
                                headers,
                                body: JSON.stringify(aRecord)
                            });
                            result = await response.json();
                            if (!result.success) {
                                throw new Error(`Failed to update A record: ${JSON.stringify(result.errors)}`);
                            }
                        } else {
                            throw new Error(`Failed to find existing A record: ${JSON.stringify(listResult.errors)}`);
                        }
                    } else {
                        throw new Error(`Failed to create A record: ${JSON.stringify(result.errors)}`);
                    }
                }
            });
        } catch (e) {
            console.error('A record creation failed:', e);
            throw new Error(`A record processing failed: ${e.message}`);
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
            await retryApiCall(async () => {
                let response = await fetch(`https://api.cloudflare.com/client/v4/zones/${config.zoneId}/dns_records`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(srvRecord)
                });
                
                let result = await response.json();
                
                if (!result.success) {
                    if (result.errors?.[0]?.code === 81053) {
                        const listResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${config.zoneId}/dns_records?type=SRV&name=_minecraft._tcp.${fqdn}`, {
                            method: 'GET',
                            headers
                        });
                        
                        const listResult = await listResponse.json();
                        
                        if (listResult.success && listResult.result.length > 0) {
                            response = await fetch(`https://api.cloudflare.com/client/v4/zones/${config.zoneId}/dns_records/${listResult.result[0].id}`, {
                                method: 'PUT',
                                headers,
                                body: JSON.stringify(srvRecord)
                            });
                            result = await response.json();
                            if (!result.success) {
                                throw new Error(`Failed to update SRV record: ${JSON.stringify(result.errors)}`);
                            }
                        } else {
                            throw new Error(`Failed to find existing SRV record: ${JSON.stringify(listResult.errors)}`);
                        }
                    } else {
                        throw new Error(`Failed to create SRV record: ${JSON.stringify(result.errors)}`);
                    }
                }
            });
        } catch (e) {
            console.error('SRV record creation failed:', e);
            throw new Error(`SRV record processing failed: ${e.message}`);
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

    // Input validation functions
    function isValidSubdomain(subdomain) {
        return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain);
    }

    function isValidIp(ip) {
        return /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ip);
    }

    function isValidPort(port) {
        const portNum = parseInt(port);
        return !isNaN(portNum) && portNum >= 1 && portNum <= 65535;
    }

    // Retry API call with exponential backoff
    async function retryApiCall(fn, maxRetries = 3, delay = 1000) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await fn();
            } catch (e) {
                if (i === maxRetries - 1) throw e;
                await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
            }
        }
    }
});
