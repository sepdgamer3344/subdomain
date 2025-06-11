document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('subdomainForm');
    const responseMessage = document.getElementById('responseMessage');

    form.addEventListener('submit', async function (e) {
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

        await createOrUpdateDNS(data);
        sendToDiscord(data).catch(console.warn);

        showResponse('success', `Subdomain created or updated! Connect via:<br><code>${connectionString}</code>`);
        form.reset();
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Subdomain';
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

        // --- A RECORD ---
        try {
            const checkA = await fetch(`https://api.cloudflare.com/client/v4/zones/${config.zoneId}/dns_records?type=A&name=${fqdn}`, {
                method: 'GET',
                headers
            });
            const resultA = await checkA.json();

            if (resultA.result.length > 0) {
                // Update existing A record
                const recordId = resultA.result[0].id;
                await fetch(`https://api.cloudflare.com/client/v4/zones/${config.zoneId}/dns_records/${recordId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({
                        type: 'A',
                        name: data.subdomain,
                        content: data.serverAddress,
                        ttl: 1,
                        proxied: false
                    })
                });
            } else {
                // Create new A record
                await fetch(`https://api.cloudflare.com/client/v4/zones/${config.zoneId}/dns_records`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        type: 'A',
                        name: data.subdomain,
                        content: data.serverAddress,
                        ttl: 1,
                        proxied: false
                    })
                });
            }
        } catch (e) {
            console.warn('A record failed:', e);
        }

        // --- SRV RECORD ---
        if (data.serverPort) {
            const srvName = `_minecraft._tcp.${data.subdomain}`;
            try {
                const checkSRV = await fetch(`https://api.cloudflare.com/client/v4/zones/${config.zoneId}/dns_records?type=SRV&name=${srvName}.${config.domain}`, {
                    method: 'GET',
                    headers
                });
                const resultSRV = await checkSRV.json();

                const srvData = {
                    service: '_minecraft',
                    proto: '_tcp',
                    name: data.subdomain,
                    priority: 0,
                    weight: 5,
                    port: parseInt(data.serverPort),
                    target: fqdn
                };

                if (resultSRV.result.length > 0) {
                    // Update existing SRV
                    const srvId = resultSRV.result[0].id;
                    await fetch(`https://api.cloudflare.com/client/v4/zones/${config.zoneId}/dns_records/${srvId}`, {
                        method: 'PUT',
                        headers,
                        body: JSON.stringify({
                            type: 'SRV',
                            name: srvName,
                            data: srvData,
                            ttl: 1
                        })
                    });
                } else {
                    // Create new SRV
                    await fetch(`https://api.cloudflare.com/client/v4/zones/${config.zoneId}/dns_records`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({
                            type: 'SRV',
                            name: srvName,
                            data: srvData,
                            ttl: 1
                        })
                    });
                }
            } catch (e) {
                console.warn('SRV record failed:', e);
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

        await fetch(webhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [embed] })
        });
    }

    function showResponse(type, msg) {
        const el = document.getElementById('responseMessage');
        el.className = `response-message ${type}`;
        el.innerHTML = msg;
        el.style.display = 'block';
        setTimeout(() => el.style.display = 'none', 8000);
    }
});
