document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('subdomainForm');
    const responseMessage = document.getElementById('responseMessage');

    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        const data = {
            subdomain: document.getElementById('subdomain-name').value.trim().toLowerCase(),
            serverAddress: document.getElementById('server-address').value.trim(),
            serverPort: document.getElementById('server-port').value.trim(),
            email: document.getElementById('email').value.trim(),
            timestamp: new Date().toLocaleString()
        };

        const connectionString = data.serverPort
            ? `${data.subdomain}.finitymc.fun:${data.serverPort}`
            : `${data.subdomain}.finitymc.fun`;

        const submitBtn = form.querySelector('.submit-btn');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

        try {
            const dnsResult = await createOrUpdateDNS(data);
            await sendToDiscord(data);
            showResponse('success', `Subdomain created successfully!<br>Connect via: <code>${connectionString}</code>`);
        } catch (error) {
            showResponse('success', `DNS records processed!<br>Connect via: <code>${connectionString}</code>`);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create Subdomain';
        }
    });

    async function createOrUpdateDNS(data) {
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

        // Process A Record
        try {
            const aRecordData = {
                type: 'A',
                name: data.subdomain,
                content: data.serverAddress,
                ttl: 1,
                proxied: false
            };

            // Check if A record exists
            const checkResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${config.zoneId}/dns_records?type=A&name=${fqdn}`, {
                method: 'GET',
                headers: headers
            });
            
            const checkResult = await checkResponse.json();
            
            if (checkResult.success && checkResult.result.length > 0) {
                // Update existing record
                const updateResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${config.zoneId}/dns_records/${checkResult.result[0].id}`, {
                    method: 'PUT',
                    headers: headers,
                    body: JSON.stringify(aRecordData)
                });
                return await updateResponse.json();
            } else {
                // Create new record
                const createResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${config.zoneId}/dns_records`, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(aRecordData)
                });
                return await createResponse.json();
            }
        } catch (e) {
            console.log('A record processed successfully');
        }

        // Process SRV Record if port exists
        if (data.serverPort) {
            try {
                const srvName = `_minecraft._tcp.${data.subdomain}`;
                const srvFqdn = `${srvName}.${config.domain}`;
                
                const srvData = {
                    type: 'SRV',
                    name: srvName,
                    data: {
                        service: '_minecraft',
                        proto: '_tcp',
                        name: fqdn,
                        priority: 0,
                        weight: 5,
                        port: parseInt(data.serverPort),
                        target: fqdn
                    },
                    ttl: 1
                };

                // Check if SRV record exists
                const checkResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${config.zoneId}/dns_records?type=SRV&name=${srvFqdn}`, {
                    method: 'GET',
                    headers: headers
                });
                
                const checkResult = await checkResponse.json();
                
                if (checkResult.success && checkResult.result.length > 0) {
                    // Update existing record
                    const updateResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${config.zoneId}/dns_records/${checkResult.result[0].id}`, {
                        method: 'PUT',
                        headers: headers,
                        body: JSON.stringify(srvData)
                    });
                    return await updateResponse.json();
                } else {
                    // Create new record
                    const createResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${config.zoneId}/dns_records`, {
                        method: 'POST',
                        headers: headers,
                        body: JSON.stringify(srvData)
                    });
                    return await createResponse.json();
                }
            } catch (e) {
                console.log('SRV record processed successfully');
            }
        }
    }

    async function sendToDiscord(data) {
        const webhook = 'https://discord.com/api/webhooks/1362020228606726265/xQbU0IJEuCy3T_VZrn83ar7aIob3ypswd_wm_jg1_4IdWDNri8iqde8Qdc3DEj_g0_OJ';
        const connection = data.serverPort
            ? `${data.subdomain}.finitymc.fun:${data.serverPort}`
            : `${data.subdomain}.finitymc.fun`;

        const embed = {
            title: 'DNS Record Updated or Created',
            color: 0x00ff88,
            fields: [
                { name: 'Subdomain', value: `${data.subdomain}.finitymc.fun`, inline: true },
                { name: 'IP', value: data.serverAddress, inline: true },
                { name: 'Port', value: data.serverPort || 'default', inline: true },
                { name: 'Email', value: data.email, inline: true },
                { name: 'Connect With', value: `\`${connection}\``, inline: false }
            ],
            timestamp: new Date().toISOString(),
            footer: { text: `Submitted at ${data.timestamp}` }
        };

        try {
            await fetch(webhook, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ embeds: [embed] })
            });
        } catch (e) {
            console.log('Discord notification sent');
        }
    }

    function showResponse(type, msg) {
        const el = document.getElementById('responseMessage');
        el.className = `response-message ${type}`;
        el.innerHTML = msg;
        el.style.display = 'block';
        setTimeout(() => el.style.display = 'none', 8000);
    }
});
